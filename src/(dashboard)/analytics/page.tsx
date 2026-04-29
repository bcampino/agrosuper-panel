import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { MonthFilter } from '@/components/dashboard/month-filter'
import AnalyticsGrid from '@/components/analytics/analytics-grid'
import type { PillarData, StaffData, Top10Local } from '@/components/analytics/analytics-grid'
import { getAvailableMonths } from '@/lib/analytics/pillar-data'
import { getMonthAggregates, aggregate, type Pillar } from '@/lib/analytics/month-aggregates'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ month?: string }>
}

const PILLAR_WEIGHT: Record<string, number> = {
  'Disponibilidad': 30,
  'Exhibición y POP': 30,
  'Precio': 15,
  'Recomendación': 25,
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()

  const now = new Date()
  const defaultMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const selectedMonth =
    params.month ??
    `${defaultMonth.getFullYear()}-${String(defaultMonth.getMonth() + 1).padStart(2, '0')}`

  const [selYear, selMonth] = selectedMonth.split('-').map(Number)

  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const monthLabel = `${MONTHS[selMonth - 1]} ${selYear}`

  // ── BIBLIA DEL CÁLCULO ────────────────────────────────────────────────────
  // Single source of truth: todos los KPIs salen de `locales` (1 fila por
  // local/mes con {disp, exh, prc, rec, total}). Ver src/lib/analytics/
  // month-aggregates.ts y la sección BIBLIA DEL CÁLCULO en CLAUDE.md.
  const [monthData, staffRes, availableMonths] = await Promise.all([
    getMonthAggregates(selectedMonth),
    supabase.from('staff').select('id, first_name, last_name, staff_type').eq('is_active', true),
    getAvailableMonths(),
  ])
  const locales = monthData.locales

  const staffMap = new Map(
    (staffRes.data ?? []).map((s) => [
      s.id,
      { name: `${s.first_name} ${s.last_name}`, type: s.staff_type as string },
    ])
  )

  // ── PILARES ──────────────────────────────────────────────────────────────
  const PILLAR_DEFS: { name: string; field: Pillar }[] = [
    { name: 'Disponibilidad',   field: 'disp' },
    { name: 'Exhibición y POP', field: 'exh'  },
    { name: 'Recomendación',    field: 'rec'  },
    { name: 'Precio',           field: 'prc'  },
  ]
  const round = (n: number | null): number => (n == null ? 0 : Math.round(n))

  const pillars: PillarData[] = PILLAR_DEFS.map(({ name, field }) => {
    const globalAvg = round(aggregate(locales, () => true, field))

    const jzBuckets = new Map<string, typeof locales>()
    for (const l of locales) {
      const k = l.jz_id ?? 'sin_jz'
      if (!jzBuckets.has(k)) jzBuckets.set(k, [])
      jzBuckets.get(k)!.push(l)
    }
    const byJZ = [...jzBuckets.entries()]
      .map(([id, arr]) => ({
        name: staffMap.get(id)?.name ?? id,
        avg: round(aggregate(arr, () => true, field)),
        cnt: arr.filter((l) => l[field] != null).length,
      }))
      .filter((x) => x.cnt > 0)
      .sort((a, b) => b.avg - a.avg)

    const regionBuckets = new Map<string, typeof locales>()
    for (const l of locales) {
      const r = l.region ?? 'Sin Región'
      if (!regionBuckets.has(r)) regionBuckets.set(r, [])
      regionBuckets.get(r)!.push(l)
    }
    const byRegion = [...regionBuckets.entries()]
      .map(([r, arr]) => ({
        name: r,
        avg: round(aggregate(arr, () => true, field)),
        cnt: arr.filter((l) => l[field] != null).length,
      }))
      .filter((x) => x.cnt > 0)
      .sort((a, b) => b.avg - a.avg)

    const saLocs = locales.filter((l) => l.sa)
    const noSaLocs = locales.filter((l) => !l.sa)
    const bySA = [
      { label: 'SA',    avg: round(aggregate(saLocs,   () => true, field)), cnt: saLocs.filter((l) => l[field] != null).length },
      { label: 'No SA', avg: round(aggregate(noSaLocs, () => true, field)), cnt: noSaLocs.filter((l) => l[field] != null).length },
    ].filter((s) => s.cnt > 0)

    return { name, avg: globalAvg, weight: PILLAR_WEIGHT[name] ?? 0, byJZ, byRegion, bySA }
  })

  // ── JZ y VENDEDORES (tabla con detalle de locales) ──────────────────────
  const buildStaffList = (
    kind: 'jz' | 'seller',
    getId: (l: typeof locales[number]) => string | null
  ): StaffData[] => {
    const buckets = new Map<string, typeof locales>()
    for (const l of locales) {
      const id = getId(l)
      if (!id) continue
      if (!buckets.has(id)) buckets.set(id, [])
      buckets.get(id)!.push(l)
    }
    return [...buckets.entries()]
      .map(([id, arr]) => ({
        id,
        name: staffMap.get(id)?.name ?? id,
        avg: round(aggregate(arr, () => true, 'total')),
        cnt: arr.filter((l) => l.total != null).length,
        type: kind,
        locations: arr.map((l) => ({
          name: l.loc_name,
          code: l.loc_code || '-',
          avg: Math.round(l.total ?? 0),
          region: l.region ?? '-',
        })),
      }))
      .sort((a, b) => b.avg - a.avg)
  }

  const jzList = buildStaffList('jz', (l) => l.jz_id)
  const sellerList = buildStaffList('seller', (l) => l.vendedor_id)

  // Cantidad de salas con información (tienen al menos un pilar calculado)
  const localesCount = locales.filter((l) => l.total != null).length

  // Top 10 locales del mes — ordenados por total desc
  const top10: Top10Local[] = [...locales]
    .filter((l) => l.total != null)
    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
    .slice(0, 10)
    .map((l) => ({
      id: l.loc_id,
      name: l.loc_name,
      code: l.loc_code,
      region: l.region,
      total: Math.round(l.total ?? 0),
    }))

  const powerBiUrl =
    process.env.NEXT_PUBLIC_POWERBI_EMBED_URL ||
    'https://app.powerbi.com/view?r=eyJrIjoiM2M5YjVmYjMtNjk5Zi00ZGRhLTlmZjgtMzhjNDNhM2Y3MjRkIiwidCI6Ijg3NTRiMzAwLTBlNGEtNGYxYS1hNDE4LWMwMjVhNGIyM2NiYSJ9&pageName=3f59b5cd1bd89af929d1'

  const airtableUrl =
    process.env.NEXT_PUBLIC_AIRTABLE_EMBED_URL ||
    'https://airtable.com/embed/appFrvRGx7Dn939tQ/shrxQfoU4Am7H2se5'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Perfect Store</p>
          <h1 className="text-2xl font-black tracking-tight">Resultados</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{monthLabel}</p>
        </div>
        <Suspense>
          <MonthFilter value={selectedMonth} availableMonths={availableMonths} />
        </Suspense>
      </div>

      <AnalyticsGrid
        pillars={pillars}
        jzList={jzList}
        sellerList={sellerList}
        top10={top10}
        localesCount={localesCount}
        powerBiUrl={powerBiUrl}
        airtableUrl={airtableUrl}
        selectedMonth={selectedMonth}
      />
    </div>
  )
}
