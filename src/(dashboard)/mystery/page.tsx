import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { AuditsTable, MYSTERY_SCORE_CONFIG } from '@/components/audits/audits-table'
import { AuditsFilters } from '@/components/audits/audits-filters'
import type { Audit, AuditReview } from '@/types'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

const MONTHS_ES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril', 5: 'Mayo', 6: 'Junio',
  7: 'Julio', 8: 'Agosto', 9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}

const STATUS_OPTIONS = [
  { value: 'pending_review', label: 'Pendiente revisión' },
  { value: 'pre_aprobado',   label: 'Pre-aprobado' },
  { value: 'pre_rechazado',  label: 'Pre-rechazado' },
  { value: 'aprobado',       label: 'Aprobado' },
  { value: 'rechazado',      label: 'Rechazado' },
  { value: 'accepted',       label: 'Aceptada' },
]

// Form IDs for mystery/recommendation
// Nota: '652647' sin prefijo es basura (fue borrado en dedupe). Solo 'rec-652647' es válido.
const MYSTERY_FORM_IDS = ['rec-652647']

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

export default async function MysteryPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  // Shared setup in parallel
  const [{ data: monthRows }, { data: auditorRows }] = await Promise.all([
    supabase.from('audits').select('audited_at, effective_month')
      .in('datascope_form_id', MYSTERY_FORM_IDS),
    supabase.from('audits').select('auditor_name')
      .in('datascope_form_id', MYSTERY_FORM_IDS)
      .not('auditor_name', 'is', null),
  ])

  // Available months — include months from audited_at AND effective_month
  const monthSet = new Set<string>()
  for (const r of monthRows ?? []) {
    if (r.effective_month) monthSet.add(r.effective_month)
    else if (r.audited_at) monthSet.add(r.audited_at.slice(0, 7))
  }
  const availableMonths = [...monthSet].sort((a, b) => b.localeCompare(a)).map((m) => {
    const [y, mo] = m.split('-').map(Number)
    return { value: m, label: `${MONTHS_ES[mo]} ${y}` }
  })

  // Available auditors
  const auditorOptions = [
    ...new Set((auditorRows ?? []).map((a) => a.auditor_name).filter(Boolean) as string[])
  ].sort((a, b) => a.trim().localeCompare(b.trim()))

  // Mes efectivo (se filtra en memoria usando effective_month ?? audited_at.slice(0,7))
  const targetMonth = params.month && params.month !== 'all' ? params.month : null

  // Text search → location IDs
  let matchingLocationIds: string[] | null = null
  if (params.q) {
    const q = `%${params.q}%`
    const { data: locs } = await supabase.from('locations').select('id').or(`name.ilike.${q},code.ilike.${q}`)
    matchingLocationIds = (locs ?? []).map((l) => l.id)
  }

  let query = supabase
    .from('audits')
    .select('*, form_answer_id:raw_data->>form_answer_id, location:locations(id,name,code,region)', { count: 'exact' })
    .in('datascope_form_id', MYSTERY_FORM_IDS)
    .is('suspended_at', null)
    .order('audited_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (params.status && params.status !== 'all') query = query.eq('status', params.status)
  if (params.auditor && params.auditor !== 'all') query = query.eq('auditor_name', params.auditor)

  if (params.q && matchingLocationIds !== null) {
    if (matchingLocationIds.length > 0) {
      query = query.or(`location_id.in.(${matchingLocationIds.join(',')})`)
    } else {
      query = query.eq('location_id', 'no-match')
    }
  }

  // Fetch all matching mystery audits paginated — Supabase hard limit es 1000 rows/request.
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

  const allAuditIds = allAudits.map((a) => a.id)
  const { data: reviewsForDedupe } = allAuditIds.length > 0
    ? await supabase.from('audit_reviews').select('audit_id, reviewed_by_ai').in('audit_id', allAuditIds)
    : { data: [] as { audit_id: string; reviewed_by_ai: boolean }[] }

  const reviewByAuditId = new Map<string, { reviewed_by_ai: boolean }>(
    (reviewsForDedupe ?? []).map((r) => [r.audit_id, { reviewed_by_ai: r.reviewed_by_ai }]),
  )

  // Dedup: una visita por location_id — preferir la que YA tiene review, luego más reciente
  const byLocation = new Map<string, typeof allAudits[number]>()
  for (const a of allAudits) {
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

  // Filtro por mes efectivo (usa effective_month si está seteado, si no el mes de audited_at)
  if (targetMonth) {
    dedupedAudits = dedupedAudits.filter((a) => {
      const em = a.effective_month ?? (a.audited_at ? a.audited_at.slice(0, 7) : null)
      return em === targetMonth
    })
  }

  // Filtro reviewer aplicado sobre el set deduplicado completo (para paginar bien)
  if (params.reviewer && params.reviewer !== 'all') {
    dedupedAudits = dedupedAudits.filter((a) => {
      const r = reviewByAuditId.get(a.id)
      if (params.reviewer === 'sin') return !r
      if (params.reviewer === 'ia') return !!r && r.reviewed_by_ai
      if (params.reviewer === 'humano') return !!r && !r.reviewed_by_ai
      return true
    })
  }

  const totalCount = dedupedAudits.length
  const audits = dedupedAudits.slice(offset, offset + PAGE_SIZE)

  const auditIds = audits.map((a) => a.id)

  const [{ data: scores }, { data: auditAnswers }, { data: reviewsRaw }] = await Promise.all([
    auditIds.length > 0
      ? supabase.from('scores').select('audit_id, total_score, calculated_at').in('audit_id', auditIds)
      : { data: [] as { audit_id: string; total_score: number | null; calculated_at: string | null }[] },
    auditIds.length > 0
      ? supabase.from('audit_answers').select('audit_id').in('audit_id', auditIds)
      : { data: [] as { audit_id: string }[] },
    auditIds.length > 0
      ? supabase.from('audit_reviews').select('*').in('audit_id', auditIds)
      : { data: [] as AuditReview[] },
  ])

  const scoreByAuditId = new Map((scores ?? []).map((s) => [s.audit_id, s]))

  const reviewsByAuditId: Record<string, AuditReview> = {}
  for (const r of reviewsRaw ?? []) reviewsByAuditId[r.audit_id] = r as AuditReview

  const answerCountByAuditId = new Map<string, number>()
  for (const answer of auditAnswers ?? []) {
    answerCountByAuditId.set(answer.audit_id, (answerCountByAuditId.get(answer.audit_id) ?? 0) + 1)
  }

  const enrichedAudits = audits.map((audit) => {
    const score = scoreByAuditId.get(audit.id)
    const answerCount = answerCountByAuditId.get(audit.id) ?? 0
    const totalScore = score?.total_score != null ? Number(score.total_score) : null

    let scoreLabel = '-'
    if (totalScore != null) scoreLabel = `${totalScore.toFixed(0)}%`
    else if (answerCount === 0) scoreLabel = 'Sin respuestas'
    else scoreLabel = '-'

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

    // "Corresponde mes": effective_month si está seteado, si no el mes de audited_at
    const effMonth = audit.effective_month ?? (audit.audited_at ? audit.audited_at.slice(0, 7) : null)
    let effMonthLabel = '—'
    if (effMonth) {
      const [y, mo] = effMonth.split('-').map(Number)
      effMonthLabel = `${MONTHS_ES[mo]} ${y}`
    }

    // form_answer_id = código de visita de Datascope (extraído en la query vía raw_data->>form_answer_id)
    const answerCode = audit.form_answer_id ?? null

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
    }
  })

  const hasActiveFilters = !!(params.q || params.status || params.month || params.auditor || params.reviewer)
  const total = totalCount ?? enrichedAudits.length
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">Revisión Mystery</h1>
        <span className="text-sm text-muted-foreground">
          {total} resultado{total !== 1 ? 's' : ''}
          {totalPages > 1 && ` · Pág. ${page}/${totalPages}`}
        </span>
      </div>

      <Suspense fallback={<div className="h-[60px] rounded-lg border bg-card animate-pulse" />}>
        <AuditsFilters
          availableMonths={availableMonths}
          auditorOptions={auditorOptions}
          statusOptions={STATUS_OPTIONS}
        />
      </Suspense>

      <AuditsTable
        audits={enrichedAudits}
        reviews={reviewsByAuditId}
        hasActiveFilters={hasActiveFilters}
        scoreConfig={MYSTERY_SCORE_CONFIG}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          {page > 1 && (
            <a href={`?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors">
              Anterior
            </a>
          )}
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          {page < totalPages && (
            <a href={`?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-muted transition-colors">
              Siguiente
            </a>
          )}
        </div>
      )}
    </div>
  )
}
