import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { AuditsTable } from '@/components/audits/audits-table'
import { AuditsFilters } from '@/components/audits/audits-filters'
import type { Audit, AuditReview } from '@/types'

const PAGE_SIZE = 50

const MONTHS_ES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}

interface PageProps {
  searchParams: Promise<{
    q?: string
    status?: string
    month?: string
    auditor?: string
    reviewer?: string
    page?: string
  }>
}

export default async function AuditsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  // Shared setup queries
  const [{ data: stubLocs }, { data: monthRows }, { data: auditorRows }] = await Promise.all([
    supabase.from('locations').select('id').ilike('name', 'Local ENEX %'),
    supabase.from('audits').select('audited_at, effective_month').in('datascope_form_id', ['664005', '649132']),
    supabase.from('audits').select('auditor_name').in('datascope_form_id', ['664005', '649132']).not('auditor_name', 'is', null),
  ])

  const stubLocIds = (stubLocs ?? []).map((l) => l.id)

  // Available months dropdown — incluye months de audited_at y de effective_month
  const monthSet = new Set<string>()
  for (const r of monthRows ?? []) {
    if (r.effective_month) monthSet.add(r.effective_month)
    else if (r.audited_at) monthSet.add(r.audited_at.slice(0, 7))
  }
  const availableMonths = [...monthSet].sort((a, b) => b.localeCompare(a)).map((m) => {
    const [y, mo] = m.split('-').map(Number)
    return { value: m, label: `${MONTHS_ES[mo]} ${y}` }
  })

  // Available auditors dropdown (distinct, sorted)
  const auditorOptions = [...new Set((auditorRows ?? []).map((a) => a.auditor_name).filter(Boolean) as string[])].sort((a, b) => a.trim().localeCompare(b.trim()))

  // Meses al que el usuario quiere filtrar (supports CSV: "2026-04,2026-03")
  // El filtro por mes se aplica en memoria usando effective_month ?? audited_at.slice(0,7),
  // porque una visita reasignada puede tener audited_at fuera de ese mes.
  const targetMonths = params.month
    ? params.month.split(',').filter(m => m.length > 0)
    : []

  // Text search → matching location IDs
  let matchingLocationIds: string[] | null = null
  if (params.q) {
    const q = `%${params.q}%`
    const { data: matchingLocs } = await supabase.from('locations').select('id').or(`name.ilike.${q},code.ilike.${q}`)
    matchingLocationIds = (matchingLocs ?? []).map((l) => l.id)
  }

  let query = supabase
    .from('audits')
    .select('*, form_answer_id:raw_data->>form_answer_id, datascope_code:raw_data->>code, datascope_form_id_raw:raw_data->>form_id, location:locations(id,name,code,region)', { count: 'exact' })
    .order('audited_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (stubLocIds.length > 0) query = query.not('location_id', 'in', `(${stubLocIds.join(',')})`)
  query = query.is('suspended_at', null)

  // Filter by status — supports CSV: "pre_aprobado,aprobado,pre_rechazado"
  if (params.status) {
    const statuses = params.status.split(',').filter(s => s.length > 0)
    if (statuses.length > 0) {
      query = query.in('status', statuses)
    }
  }

  // Filter by auditor — supports CSV
  if (params.auditor) {
    const auditors = params.auditor.split(',').filter(a => a.length > 0)
    if (auditors.length > 0) {
      query = query.in('auditor_name', auditors)
    }
  }

  if (params.q && matchingLocationIds !== null) {
    const locIdList = matchingLocationIds.length > 0 ? `location_id.in.(${matchingLocationIds.join(',')})` : ''
    const orParts = [...(locIdList ? [locIdList] : [])]
    if (orParts.length > 0) query = query.or(orParts.join(','))
    else if (matchingLocationIds.length === 0) query = query.eq('location_id', 'no-match')
  }

  // Fetch all matching audits paginated — Supabase hard limit is 1000 rows/request
  // (ignora .limit(5000)). Paginamos con .range() hasta traer todo.
  const rawAudits: unknown[] = []
  {
    const PAGE = 1000
    let offset = 0
    while (true) {
      const { data } = await query.range(offset, offset + PAGE - 1)
      if (!data || data.length === 0) break
      rawAudits.push(...data)
      if (data.length < PAGE) break
      offset += PAGE
    }
  }

  const allAudits = (rawAudits ?? []) as (Audit & {
    location: { id: string; name: string; code: string }
    form_answer_id: string | null
  })[]

  // Reviews para saber cuáles ya tienen IA/humano (usado en dedup y filtro reviewer)
  const allAuditIds = allAudits.map((a) => a.id)
  const { data: reviewsForDedupe } = allAuditIds.length > 0
    ? await supabase.from('audit_reviews').select('audit_id, reviewed_by_ai').in('audit_id', allAuditIds)
    : { data: [] as { audit_id: string; reviewed_by_ai: boolean }[] }

  const reviewByAuditId = new Map<string, { reviewed_by_ai: boolean }>(
    (reviewsForDedupe ?? []).map((r) => [r.audit_id, { reviewed_by_ai: r.reviewed_by_ai }]),
  )

  // Filter by month(s) FIRST (using effective_month if set, else audited_at month)
  // so we don't dedupe a local's January visit away because it also visited in April.
  let filteredByMonth = allAudits
  if (targetMonths.length > 0) {
    filteredByMonth = allAudits.filter((a) => {
      const em = a.effective_month ?? (a.audited_at ? a.audited_at.slice(0, 7) : null)
      return em && targetMonths.includes(em)
    })
  }

  // Dedup WITHIN the selected month: one visit per location_id.
  // Prefer the one that already has a review, then the most recent.
  const byLocation = new Map<string, typeof allAudits[number]>()
  for (const a of filteredByMonth) {
    const existing = byLocation.get(a.location_id)
    if (!existing) {
      byLocation.set(a.location_id, a)
      continue
    }
    const existingHasReview = reviewByAuditId.has(existing.id)
    const currentHasReview = reviewByAuditId.has(a.id)
    if (currentHasReview && !existingHasReview) {
      byLocation.set(a.location_id, a)
      continue
    }
    if (!currentHasReview && existingHasReview) continue
    const existingDate = existing.audited_at ?? existing.created_at ?? ''
    const currentDate = a.audited_at ?? a.created_at ?? ''
    if (currentDate > existingDate) byLocation.set(a.location_id, a)
  }

  let dedupedAudits = [...byLocation.values()].sort((x, y) => {
    const dx = x.audited_at ?? x.created_at ?? ''
    const dy = y.audited_at ?? y.created_at ?? ''
    return dx < dy ? 1 : dx > dy ? -1 : 0
  })

  // Filtro reviewer aplicado sobre el set deduplicado completo — supports CSV
  if (params.reviewer) {
    const reviewers = params.reviewer.split(',').filter(r => r.length > 0)
    if (reviewers.length > 0) {
      dedupedAudits = dedupedAudits.filter((a) => {
        const r = reviewByAuditId.get(a.id)
        return reviewers.some(reviewer => {
          if (reviewer === 'sin') return !r
          if (reviewer === 'ia') return !!r && r.reviewed_by_ai
          if (reviewer === 'humano') return !!r && !r.reviewed_by_ai
          return false
        })
      })
    }
  }

  const totalCount = dedupedAudits.length
  const audits = dedupedAudits.slice(offset, offset + PAGE_SIZE)

  const auditIds = audits.map((a) => a.id)

  const [{ data: scores }, { data: auditAnswers }, { data: reviewsRaw }] = await Promise.all([
    auditIds.length > 0
      ? supabase
          .from('scores')
          .select('audit_id, total_score, calculated_at, pillar_scores')
          .in('audit_id', auditIds)
      : { data: [] as { audit_id: string; total_score: number | null; calculated_at: string | null; pillar_scores: { pillar_name: string; score: number }[] | null }[] },
    auditIds.length > 0
      ? supabase
          .from('audit_answers')
          .select('audit_id')
          .in('audit_id', auditIds)
      : { data: [] as { audit_id: string }[] },
    auditIds.length > 0
      ? supabase
          .from('audit_reviews')
          .select('*')
          .in('audit_id', auditIds)
      : { data: [] as AuditReview[] },
  ])

  const scoreByAuditId = new Map(
    (scores ?? []).map((score) => [score.audit_id, score])
  )

  const reviewsByAuditId: Record<string, AuditReview> = {}
  for (const r of reviewsRaw ?? []) {
    reviewsByAuditId[r.audit_id] = r as AuditReview
  }

  const answerCountByAuditId = new Map<string, number>()
  for (const answer of auditAnswers ?? []) {
    answerCountByAuditId.set(
      answer.audit_id,
      (answerCountByAuditId.get(answer.audit_id) ?? 0) + 1
    )
  }

  const enrichedAudits = audits.map((audit) => {
    const score = scoreByAuditId.get(audit.id)
    const answerCount = answerCountByAuditId.get(audit.id) ?? 0
    const totalScore = score?.total_score != null ? Number(score.total_score) : null

    let scoreLabel = '-'
    if (totalScore != null) {
      scoreLabel = `${totalScore.toFixed(0)}%`
    } else if (answerCount === 0) {
      scoreLabel = 'Sin respuestas'
    } else if (audit.status === 'pending') {
      scoreLabel = 'Pendiente de cálculo'
    } else {
      scoreLabel = 'Error de cálculo'
    }

    let dateLabel = '-'
    if (audit.audited_at) {
      const d = new Date(audit.audited_at)
      const dd = String(d.getUTCDate()).padStart(2, '0')
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      const yy = d.getUTCFullYear()
      const hh = String(d.getUTCHours()).padStart(2, '0')
      const mi = String(d.getUTCMinutes()).padStart(2, '0')
      dateLabel = `${dd}-${mm}-${yy}, ${hh}:${mi}`
    }

    const pillars = (score?.pillar_scores ?? []) as { pillar_name: string; score: number }[]
    const pillarBy = (needle: string) =>
      pillars.find(p => p.pillar_name?.toLowerCase().includes(needle))?.score ?? null

    // "Corresponde mes": effective_month si está seteado, si no el mes de audited_at
    const effMonth = audit.effective_month ?? (audit.audited_at ? audit.audited_at.slice(0, 7) : null)
    let effMonthLabel = '—'
    if (effMonth) {
      const [y, mo] = effMonth.split('-').map(Number)
      effMonthLabel = `${MONTHS_ES[mo]} ${y}`
    }

    // Show the short Datascope sequential code (e.g. 753). Sources in priority:
    //   1) raw_data.code  (set by the live webhook)
    //   2) raw_data.form_id  (set by the Maestra Excel backfill — stores the code here)
    //   3) raw_data.form_answer_id  (fallback: the large Datascope uid)
    // Skip values that look like the form-template id (664005) or are large fa_ids.
    const extra = audit as { datascope_code?: string | null; datascope_form_id_raw?: string | null }
    const rawCandidates = [extra.datascope_code, extra.datascope_form_id_raw, audit.form_answer_id]
    const answerCode = rawCandidates.find(v => v && v !== '664005' && v !== '649132' && v.length <= 8) ?? null

    return {
      ...audit,
      answer_count: answerCount,
      score_total: totalScore,
      score_calculated_at: score?.calculated_at ?? null,
      score_label: scoreLabel,
      audited_at_label: dateLabel,
      effective_month_label: effMonthLabel,
      effective_month_reassigned: audit.effective_month !== null,
      form_answer_code: answerCode,
      score_disponibilidad: pillarBy('disponibilidad'),
      score_pop: pillarBy('exhibi'),
      score_precio: pillarBy('precio'),
    }
  })

  const hasActiveFilters = !!(
    params.q ||
    params.status ||
    params.month ||
    params.auditor ||
    params.reviewer
  )

  const total = totalCount ?? enrichedAudits.length
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">Auditorías</h1>
        <span className="text-sm text-muted-foreground">
          {total} resultado{total !== 1 ? 's' : ''}
          {totalPages > 1 && ` · Pág. ${page}/${totalPages}`}
        </span>
      </div>

      <Suspense fallback={<div className="h-[88px] rounded-lg border bg-card animate-pulse" />}>
        <AuditsFilters availableMonths={availableMonths} auditorOptions={auditorOptions} />
      </Suspense>

      <AuditsTable
        audits={enrichedAudits}
        reviews={reviewsByAuditId}
        hasActiveFilters={hasActiveFilters}
        showPillarColumns
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          {page > 1 && (
            <a
              href={`?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors"
            >
              Anterior
            </a>
          )}
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors"
            >
              Siguiente
            </a>
          )}
        </div>
      )}
    </div>
  )
}
