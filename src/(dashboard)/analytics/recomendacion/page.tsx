import { Suspense } from 'react'
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { PillarFilters } from '@/components/analytics/pillar-filters'
import { AnswerBarChart } from '@/components/analytics/answer-bar-chart'
import type { LocationInfo } from '@/components/analytics/answer-bar-chart'
import {
  getFilteredAuditIds,
  getAvailableMonths,
  getAnswers,
  getAuditLocations,
  defaultMonth,
} from '@/lib/analytics/pillar-data'
import { getRecomendacionPhotos } from '@/lib/analytics/pillar-photos'
import { fetchAllPages } from '@/lib/supabase/paginate'
import { RecomendacionSummary } from '@/components/analytics/recomendacion-summary'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    month?: string
    sa?: string
    categoria?: string
    jz?: string
    vendedor?: string
  }>
}

const BRANDS = ['Shell', 'Mobil', 'Castrol', 'Total', 'Liquimoly', 'Otro']

const BRAND_COLORS: Record<string, string> = {
  Shell: '#f97316',
  Mobil: '#ef4444',
  Castrol: '#22c55e',
  Total: '#3b82f6',
  Liquimoly: '#eab308',
  Otro: '#94a3b8',
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function buildBrandChart(
  answers: { audit_id: string; raw_value: string | null; question_identifier: string }[],
  identifier: string
): { label: string; count: number; pct: number; color: string }[] {
  const byQ = answers.filter((a) => a.question_identifier === identifier)
  const total = byQ.length
  if (total === 0) return []

  const counts: Record<string, number> = {}
  for (const a of byQ) {
    const brand = a.raw_value ?? 'Sin respuesta'
    counts[brand] = (counts[brand] ?? 0) + 1
  }

  const known = BRANDS.filter((b) => counts[b] !== undefined).map((b) => ({
    label: b,
    count: counts[b],
    pct: Math.round((counts[b] / total) * 100),
    color: BRAND_COLORS[b] ?? '#94a3b8',
  }))
  const unknown = Object.entries(counts)
    .filter(([k]) => !BRANDS.includes(k))
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 100),
      color: '#94a3b8',
    }))

  return [...known, ...unknown].sort((a, b) => b.count - a.count)
}

export default async function RecomendacionPage({ searchParams }: PageProps) {
  const params = await searchParams
  const month = params.month ?? defaultMonth()
  const monthLabel = month === 'all'
    ? 'Todos los meses'
    : (() => { const [y, m] = month.split('-').map(Number); return `${MONTHS[m - 1]} ${y}` })()

  const [{ auditIds, totalAudits, jzOptions, vendedorOptions, categoriaOptions }, availableMonths] =
    await Promise.all([
      getFilteredAuditIds({ month, sa: params.sa, categoria: params.categoria, jz: params.jz, vendedor: params.vendedor }),
      getAvailableMonths(),
    ])

  const [answers, auditLocations] = await Promise.all([
    getAnswers(auditIds, ['REC-01', 'REC-02', 'REC-03']),
    getAuditLocations(auditIds),
  ])
  const pilarAuditCount = new Set(answers.map((a) => a.audit_id)).size

  const positions = [
    { id: 'REC-01', label: '1ra Recomendación' },
    { id: 'REC-02', label: '2da Recomendación' },
    { id: 'REC-03', label: '3ra Recomendación' },
  ]

  // Build locationsByAnswer per question
  const locationsByQuestion: Record<string, Record<string, LocationInfo[]>> = {}
  for (const a of answers) {
    const qId = a.question_identifier
    const val = a.raw_value ?? 'Sin respuesta'
    if (!locationsByQuestion[qId]) locationsByQuestion[qId] = {}
    if (!locationsByQuestion[qId][val]) locationsByQuestion[qId][val] = []
    const loc = auditLocations.get(a.audit_id)
    if (loc) locationsByQuestion[qId][val].push(loc)
  }

  const charts = positions.map(({ id, label }) => ({
    id,
    label,
    data: buildBrandChart(answers, id),
    total: answers.filter((a) => a.question_identifier === id).length,
    locationsByAnswer: locationsByQuestion[id] ?? {},
  }))

  // Summary stats — mutually exclusive groups based on BEST Shell position per audit.
  // Each audit falls into exactly one group → the 4 percentages sum to 100%.
  const rec1ByAudit = new Map(answers.filter(a => a.question_identifier === 'REC-01').map(a => [a.audit_id, a.raw_value]))
  const rec2ByAudit = new Map(answers.filter(a => a.question_identifier === 'REC-02').map(a => [a.audit_id, a.raw_value]))
  const rec3ByAudit = new Map(answers.filter(a => a.question_identifier === 'REC-03').map(a => [a.audit_id, a.raw_value]))

  const locs1: LocationInfo[] = [], locs2: LocationInfo[] = [], locs3: LocationInfo[] = [], locsNone: LocationInfo[] = []
  let count1 = 0, count2 = 0, count3 = 0, countNone = 0

  for (const auditId of auditIds) {
    const loc = auditLocations.get(auditId)
    if (rec1ByAudit.get(auditId) === 'Shell') {
      count1++; if (loc) locs1.push(loc)
    } else if (rec2ByAudit.get(auditId) === 'Shell') {
      count2++; if (loc) locs2.push(loc)
    } else if (rec3ByAudit.get(auditId) === 'Shell') {
      count3++; if (loc) locs3.push(loc)
    } else {
      countNone++; if (loc) locsNone.push(loc)
    }
  }

  const pct = (n: number) => pilarAuditCount > 0 ? Math.round((n / pilarAuditCount) * 100) : 0
  const s1 = { pct: pct(count1), count: count1 }
  const s2 = { pct: pct(count2), count: count2 }
  const s3 = { pct: pct(count3), count: count3 }
  const pctNoShell = pct(countNone)
  const noShellCount = countNone

  const locShell1 = locs1
  const locShell2 = locs2
  const locShell3 = locs3
  const locNoShell = locsNone

  // Winners panel: photos of "Toma foto del encargado de local recibiendo el premio"
  // from form 3.0 of the NEXT month (winners of month X get their photo in month X+1).
  // Examples: Jan winners → Feb form 3.0, Feb → Mar, Mar → Apr.
  const winnerPhotos = await (async () => {
    if (month === 'all') {
      // No shift for 'all', use every form 3.0 audit
      const supabase = await createServerSupabaseClient()
      const f3Audits = await fetchAllPages<{ id: string }>((from, to) =>
        supabase.from('audits').select('id').eq('datascope_form_id', '664005').range(from, to)
      )
      const f3Ids = f3Audits.map(a => a.id)
      return getRecomendacionPhotos(f3Ids)
    }
    const [y, m] = month.split('-').map(Number)
    const nextMonth = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
    const nextMonthKey = `${nextMonth.y}-${String(nextMonth.m).padStart(2, '0')}`
    const startOfNextMonth = `${nextMonthKey}-01`
    const endOfNextMonth = nextMonth.m === 12
      ? `${nextMonth.y + 1}-01-01`
      : `${nextMonth.y}-${String(nextMonth.m + 1).padStart(2, '0')}-01`
    const supabase = await createServerSupabaseClient()
    // OR: effective_month = mes-siguiente OR (effective_month null AND audited_at en rango)
    const orFilter =
      `effective_month.eq.${nextMonthKey},` +
      `and(effective_month.is.null,audited_at.gte.${startOfNextMonth},audited_at.lt.${endOfNextMonth})`
    const nextMonthAudits = await fetchAllPages<{ id: string }>((from, to) =>
      supabase
        .from('audits')
        .select('id')
        .eq('datascope_form_id', '664005')
        .or(orFilter)
        .range(from, to)
    )
    const nextIds = nextMonthAudits.map(a => a.id)
    return getRecomendacionPhotos(nextIds)
  })()
  const winnerCount = winnerPhotos.length

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Suspense>
          <PillarFilters
            month={month}
            sa={params.sa}
            categoria={params.categoria}
            jz={params.jz}
            vendedor={params.vendedor}
            jzOptions={jzOptions}
            vendedorOptions={vendedorOptions}
            categoriaOptions={categoriaOptions}
            availableMonths={availableMonths}
            basePath="/analytics/recomendacion"
          />
        </Suspense>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Recomendación</h1>
          <p className="text-sm text-muted-foreground">Pilar 25% · {monthLabel}</p>
        </div>
      </div>

      {/* Summary bar — client component for clickable items */}
      <RecomendacionSummary
        totalAudits={pilarAuditCount}
        pct1={s1.pct} count1={s1.count} locs1={locShell1}
        pct2={s2.pct} count2={s2.count} locs2={locShell2}
        pct3={s3.pct} count3={s3.count} locs3={locShell3}
        pctNoShell={pctNoShell} countNoShell={noShellCount} locsNoShell={locNoShell}
      />

      {/* Charts — vertical layout for readability */}
      <div className="space-y-4">
        {charts.map((chart) => (
          <div key={chart.id} className="rounded-xl border bg-card p-4">
            {chart.data.length === 0 ? (
              <div>
                <p className="text-sm font-semibold mb-2">{chart.label}</p>
                <p className="text-xs text-muted-foreground">Sin datos para el período seleccionado.</p>
              </div>
            ) : (
              <AnswerBarChart
                title={chart.label}
                data={chart.data}
                total={chart.total}
                locationsByAnswer={chart.locationsByAnswer}
              />
            )}
          </div>
        ))}
      </div>

      {/* Winners panel */}
      {(winnerPhotos.length > 0 || winnerCount > 0) && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-0.5">
            Ganadores del mes
          </h2>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl font-bold">{winnerCount}</span>
              <span className="text-sm text-muted-foreground">ganadores este período</span>
            </div>
            {winnerPhotos.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {winnerPhotos.map((p, i) => (
                  <a
                    key={i}
                    href={p.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.photo_url}
                      alt={p.label ?? 'Ganador'}
                      className="w-full h-20 object-cover rounded-lg border group-hover:opacity-90 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
