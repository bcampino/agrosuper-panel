import { Suspense } from 'react'
import { PillarFilters } from '@/components/analytics/pillar-filters'
import {
  getFilteredAuditIds,
  getAvailableMonths,
  getAnswers,
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


const SKU_LABELS: Record<string, string> = {
  'PRC-01': 'Shell Helix HX7 SP 10W40 4L',
  'PRC-02': 'Shell Helix HX8 Pro AG 5W30 4L',
  'PRC-03': 'Shell Helix Ultra PRO AG 5W30 4L',
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const MOBIL_LABELS: Record<string, string> = {
  'PRC-01-COMP': 'Mobil Super 2000 Formula P X1 10W40 4L',
  'PRC-02-COMP': 'Mobil Super 3000 XE4 5W30 4L',
  'PRC-03-COMP': 'Mobil 1 ESP 5W30 4L',
}

function parsePrice(val: string | null): number | null {
  if (!val) return null
  const n = parseFloat(val.replace(/[^0-9.,]/g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

function median(vals: number[]): number | null {
  if (vals.length === 0) return null
  const sorted = [...vals].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

export default async function PrecioPage({ searchParams }: PageProps) {
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

  const allIds = [
    'PRC-01', 'PRC-02', 'PRC-03',
    'PRC-04', 'PRC-05', 'PRC-06',
    'PRC-01-COMP', 'PRC-02-COMP', 'PRC-03-COMP',
  ]
  const answers = await getAnswers(auditIds, allIds)
  const pilarAuditCount = new Set(answers.map((a) => a.audit_id)).size

  // Price pairs: Shell (PRC-01/02/03) vs Mobil (PRC-01-COMP/02-COMP/03-COMP)
  const skuPairs = [
    { shellId: 'PRC-01', mobilId: 'PRC-01-COMP', sku: SKU_LABELS['PRC-01'], mobilSku: MOBIL_LABELS['PRC-01-COMP'], visId: 'PRC-04' },
    { shellId: 'PRC-02', mobilId: 'PRC-02-COMP', sku: SKU_LABELS['PRC-02'], mobilSku: MOBIL_LABELS['PRC-02-COMP'], visId: 'PRC-05' },
    { shellId: 'PRC-03', mobilId: 'PRC-03-COMP', sku: SKU_LABELS['PRC-03'], mobilSku: MOBIL_LABELS['PRC-03-COMP'], visId: 'PRC-06' },
  ].map(({ shellId, mobilId, sku, mobilSku, visId }) => {
    const shellVals = answers
      .filter((a) => a.question_identifier === shellId)
      .map((a) => parsePrice(a.raw_value))
      .filter((n): n is number => n !== null && n > 0)
    const mobilVals = answers
      .filter((a) => a.question_identifier === mobilId)
      .map((a) => parsePrice(a.raw_value))
      .filter((n): n is number => n !== null && n > 0)
    const visAnswers = answers.filter((a) => a.question_identifier === visId)
    const visYes = visAnswers.filter((a) => a.raw_value === 'Si').length
    const visPct = visAnswers.length > 0 ? Math.round((visYes / visAnswers.length) * 100) : null
    return {
      shellId, mobilId, visId,
      sku, mobilSku,
      shellMedian: median(shellVals),
      mobilMedian: median(mobilVals),
      shellCount: shellVals.length,
      mobilCount: mobilVals.length,
      visTotal: visAnswers.length,
      visPct,
      visYes,
    }
  })

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
            basePath="/analytics/precio"
          />
        </Suspense>
        <div>
          <h1 className="text-2xl font-black tracking-tight">Precio</h1>
          <p className="text-sm text-muted-foreground">Pilar 15% · {monthLabel}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Auditorías</p>
        <p className="text-3xl font-bold mt-1">{pilarAuditCount}</p>
        <p className="text-xs text-muted-foreground">con precios levantados{totalAudits > pilarAuditCount ? ` · ${totalAudits - pilarAuditCount} sin info` : ''}</p>
      </div>

      {/* Per-SKU cards: distribution + median comparison + visibility */}
      <div className="space-y-6">
        {skuPairs.map((pair) => (
          <div key={pair.shellId} className="rounded-xl border bg-card overflow-hidden">
            {/* SKU header */}
            <div className="px-4 pt-4 pb-2 border-b bg-muted/30">
              <p className="text-xs text-muted-foreground font-mono">{pair.shellId}</p>
              <p className="text-sm font-semibold leading-tight">{pair.sku}</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Median comparison */}
              {(pair.shellMedian !== null || pair.mobilMedian !== null) ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#f97316]/10 border border-[#f97316]/20 px-3 py-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Mediana Shell</p>
                    <p className="text-2xl font-bold text-orange-700">
                      {pair.shellMedian !== null ? `$${pair.shellMedian.toLocaleString('es-CL')}` : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{pair.shellCount} precios</p>
                    {pair.shellMedian !== null && pair.mobilMedian !== null && (() => {
                      const diff = Math.round(((pair.shellMedian - pair.mobilMedian) / pair.mobilMedian) * 100)
                      const sign = diff > 0 ? '+' : ''
                      const color = diff <= 0 ? 'text-emerald-600' : diff <= 10 ? 'text-yellow-600' : 'text-red-600'
                      return <p className={`text-xs font-semibold mt-1 ${color}`}>{sign}{diff}% vs Mobil</p>
                    })()}
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5 truncate">Mediana {pair.mobilSku.split(' ').slice(0, 2).join(' ')}</p>
                    <p className="text-2xl font-bold text-slate-600">
                      {pair.mobilMedian !== null ? `$${pair.mobilMedian.toLocaleString('es-CL')}` : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{pair.mobilCount} precios</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin datos de precio.</p>
              )}

              {/* Price visibility */}
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-xs text-muted-foreground">Exhibición de precio</p>
                {pair.visPct !== null ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pair.visPct}px`, minWidth: 4, maxWidth: 80 }} />
                      <span className="text-sm font-bold text-emerald-700">{pair.visPct}%</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{pair.visYes}/{pair.visTotal} locales</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Sin datos</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
