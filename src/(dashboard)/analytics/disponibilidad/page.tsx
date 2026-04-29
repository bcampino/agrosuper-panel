import { Suspense } from 'react'
import { PillarFilters } from '@/components/analytics/pillar-filters'
import { AnswerBarChart } from '@/components/analytics/answer-bar-chart'
import type { LocationInfo } from '@/components/analytics/answer-bar-chart'
import {
  getFilteredAuditIds,
  getAnswers,
  countAnswers,
  defaultMonth,
  getAuditLocations,
  getAvailableMonths,
} from '@/lib/analytics/pillar-data'
import { getDisponibilidadPhotos, DISPONIBILIDAD_BUCKETS } from '@/lib/analytics/pillar-photos'

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

const DISP_COLOR_MAP: Record<string, string> = {
  'Si, está visible en gondola': '#22c55e',
  'Si, pero no esta visible (en bodega)': '#eab308',
  'Si, pero no tiene stock (quebrado)': '#f97316',
  'No vende': '#ef4444',
  'Quiebre total': '#dc2626',
}

const SKU_LABELS: Record<string, string> = {
  'DISP-01': 'Shell Helix HX7 SP 10W40',
  'DISP-02': 'Shell Helix HX8 PRO AG 5W30',
  'DISP-03': 'Shell Helix Ultra PRO AG 5W30',
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default async function DisponibilidadPage({ searchParams }: PageProps) {
  const params = await searchParams
  const month = params.month ?? defaultMonth()
  const monthLabel = month === 'all'
    ? 'Todos los meses'
    : (() => { const [y, m] = month.split('-').map(Number); return `${MONTHS[m - 1]} ${y}` })()

  const [{ auditIds, totalAudits, jzOptions, vendedorOptions, categoriaOptions }, availableMonths] =
    await Promise.all([
      getFilteredAuditIds({
        month,
        sa: params.sa,
        categoria: params.categoria,
        jz: params.jz,
        vendedor: params.vendedor,
      }),
      getAvailableMonths(),
    ])

  const [answers, auditLocations] = await Promise.all([
    getAnswers(auditIds, ['DISP-01', 'DISP-02', 'DISP-03']),
    getAuditLocations(auditIds),
  ])

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

  // Denominator = audits that actually measured this pilar (have at least one DISP answer)
  const pilarAudits = new Set(answers.map((a) => a.audit_id))
  const pilarAuditCount = pilarAudits.size

  // Summary: % with at least one SKU visible in gondola
  const auditWithAnyVisible = new Set(
    answers
      .filter((a) => a.raw_value === 'Si, está visible en gondola')
      .map((a) => a.audit_id)
  )
  const pctAnyVisible =
    pilarAuditCount > 0 ? Math.round((auditWithAnyVisible.size / pilarAuditCount) * 100) : 0

  // Summary: % with ALL 3 SKUs visible in gondola
  const VISIBLE = 'Si, está visible en gondola'
  const answersByAudit = new Map<string, Map<string, string>>()
  for (const a of answers) {
    if (!answersByAudit.has(a.audit_id)) answersByAudit.set(a.audit_id, new Map())
    answersByAudit.get(a.audit_id)!.set(a.question_identifier, a.raw_value ?? '')
  }
  const auditsWithAll3 = [...answersByAudit.entries()].filter(([, qMap]) =>
    qMap.get('DISP-01') === VISIBLE &&
    qMap.get('DISP-02') === VISIBLE &&
    qMap.get('DISP-03') === VISIBLE
  ).length
  const pctAll3Visible = pilarAuditCount > 0 ? Math.round((auditsWithAll3 / pilarAuditCount) * 100) : 0

  const charts = ['DISP-01', 'DISP-02', 'DISP-03'].map((id) => ({
    id,
    title: `${id} — ${SKU_LABELS[id]}`,
    data: countAnswers(answers, id, DISP_COLOR_MAP),
    total: answers.filter((a) => a.question_identifier === id).length,
    locationsByAnswer: locationsByQuestion[id] ?? {},
  }))

  // Photos of HX7/HX8/Ultra on shelf (3 buckets, ~16 per product, Shell-only)
  const photos = await getDisponibilidadPhotos(auditIds)

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
            basePath="/analytics/disponibilidad"
            availableMonths={availableMonths}
          />
        </Suspense>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Disponibilidad</h1>
          <p className="text-sm text-muted-foreground">Pilar 30% · {monthLabel}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Auditorías</p>
          <p className="text-3xl font-bold mt-1">{pilarAuditCount}</p>
          <p className="text-xs text-muted-foreground">con info levantada{totalAudits > pilarAuditCount ? ` · ${totalAudits - pilarAuditCount} sin levantamiento` : ''}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Con al menos 1 SKU en góndola</p>
          <p className="text-3xl font-bold mt-1 text-emerald-600">{pctAnyVisible}%</p>
          <p className="text-xs text-muted-foreground">{auditWithAnyVisible.size} locales</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Con los 3 SKU en góndola</p>
          <p className="text-3xl font-bold mt-1 text-emerald-700">{pctAll3Visible}%</p>
          <p className="text-xs text-muted-foreground">{auditsWithAll3} locales</p>
        </div>
      </div>

      {/* Charts per SKU */}
      <div className="space-y-6">
        {charts.map((chart) => (
          <div key={chart.id} className="rounded-xl border bg-card p-4">
            {chart.data.length === 0 ? (
              <div>
                <p className="text-sm font-semibold mb-2">{chart.title}</p>
                <p className="text-xs text-muted-foreground">Sin datos para el período seleccionado.</p>
              </div>
            ) : (
              <AnswerBarChart
                title={chart.title}
                data={chart.data}
                total={chart.total}
                locationsByAnswer={chart.locationsByAnswer}
              />
            )}
          </div>
        ))}
      </div>

      {/* Photos grouped by product */}
      {photos.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold">Fotos en góndola ({photos.length})</p>
          {[...DISPONIBILIDAD_BUCKETS, { key: 'otros', label: 'Otras fotos' }].map((bucket) => {
            const bucketPhotos = photos.filter((p) => p.bucket_key === bucket.key)
            if (bucketPhotos.length === 0) return null
            return (
              <div key={bucket.key}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  {bucket.label} ({bucketPhotos.length})
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {bucketPhotos.map((p, i) => (
                    <a key={i} href={p.photo_url} target="_blank" rel="noopener noreferrer" className="group" title={p.location_name ?? ''}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.photo_url}
                        alt={p.label ?? 'Producto en góndola'}
                        className="w-full h-20 object-cover rounded-lg border group-hover:opacity-90 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
