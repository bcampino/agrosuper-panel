import { Suspense } from 'react'
import { PillarFilters } from '@/components/analytics/pillar-filters'
import { AnswerBarChart } from '@/components/analytics/answer-bar-chart'
import { getExhibicionPhotos, EXHIBICION_BUCKETS } from '@/lib/analytics/pillar-photos'
import {
  getFilteredAuditIds,
  getAvailableMonths,
  getAnswers,
  countAnswers,
  defaultMonth,
} from '@/lib/analytics/pillar-data'

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

const BINARY_COLOR_MAP: Record<string, string> = {
  'Si': '#22c55e',
  'No': '#ef4444',
}

const EXH01_COLOR_MAP: Record<string, string> = {
  'Si, bastidor principal Shell': '#22c55e',
  'Si, bastidor secundario Shell': '#84cc16',
  'Mobil': '#ef4444',
  'Liquimoly': '#ef4444',
  'Castrol': '#ef4444',
  'Total': '#ef4444',
  'Otro': '#f97316',
  'No': '#ef4444',
}

const EXH07_COLOR_MAP: Record<string, string> = {
  'Si en buen estado todos': '#22c55e',
  'Si no todos': '#eab308',
  'No': '#ef4444',
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const QUESTION_LABELS: Record<string, string> = {
  'EXH-01': 'Bastidor externo',
  'EXH-02': 'Letrero externo',
  'EXH-03': 'Payloader / Exhibidor Enex',
  'EXH-08': 'Todos en buen estado',
  'EXH-05': 'Pendón Shell Helix',
  'EXH-06': 'Pendón Shell Rímula',
  'EXH-07': 'Pack Ideal completo',
}

export default async function ExhibicionPage({ searchParams }: PageProps) {
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

  const allIds = ['EXH-01', 'EXH-02', 'EXH-03', 'EXH-05', 'EXH-06', 'EXH-07', 'EXH-08']
  const answers = await getAnswers(auditIds, allIds)
  // Only count audits that actually measured this pilar
  const pilarAuditCount = new Set(answers.map((a) => a.audit_id)).size

  // Fetch photos with bucket quotas (~5 per sub-category: cartel, letrero, pendón, etc.)
  const photos = await getExhibicionPhotos(auditIds)

  const charts = allIds.map((id) => {
    const colorMap =
      id === 'EXH-01' ? EXH01_COLOR_MAP : id === 'EXH-07' ? EXH07_COLOR_MAP : BINARY_COLOR_MAP
    return {
      id,
      title: `${id} — ${QUESTION_LABELS[id]}`,
      data: countAnswers(answers, id, colorMap),
      total: answers.filter((a) => a.question_identifier === id).length,
    }
  })

  // Quick summary: % with bastidor Shell and % with Pack Ideal
  const exh01Answers = answers.filter((a) => a.question_identifier === 'EXH-01')
  const bastidorShell = exh01Answers.filter(
    (a) =>
      a.raw_value === 'Si, bastidor principal Shell' ||
      a.raw_value === 'Si, bastidor secundario Shell'
  ).length
  const pctBastidor =
    exh01Answers.length > 0 ? Math.round((bastidorShell / exh01Answers.length) * 100) : 0

  const exh07Answers = answers.filter((a) => a.question_identifier === 'EXH-07')
  const packIdealCompleto = exh07Answers.filter((a) => a.raw_value === 'Si en buen estado todos').length
  const pctPackIdeal =
    exh07Answers.length > 0 ? Math.round((packIdealCompleto / exh07Answers.length) * 100) : 0

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
            basePath="/analytics/exhibicion"
          />
        </Suspense>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Exhibición y POP</h1>
          <p className="text-sm text-muted-foreground">Pilar 30% · {monthLabel}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Auditorías</p>
          <p className="text-3xl font-bold mt-1">{pilarAuditCount}</p>
          <p className="text-xs text-muted-foreground">con info levantada{totalAudits > pilarAuditCount ? ` · ${totalAudits - pilarAuditCount} sin levantamiento` : ''}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Pack Ideal completo</p>
          <p className="text-3xl font-bold mt-1 text-emerald-600">{pctPackIdeal}%</p>
          <p className="text-xs text-muted-foreground">{packIdealCompleto} tiendas</p>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-4">
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
              />
            )}
          </div>
        ))}
      </div>

      {/* Photo gallery grouped by sub-category */}
      {photos.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm font-semibold">Fotos ({photos.length})</p>
          {EXHIBICION_BUCKETS.map((bucket) => {
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
                        alt={p.label ?? 'Foto de auditoría'}
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
