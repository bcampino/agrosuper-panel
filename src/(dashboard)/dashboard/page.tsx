import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SectionHeader } from '@/components/ui/section-header'
import { getPillarColor } from '@/lib/pillar-colors'
import { ClipboardCheck, Search, Target, MapPin, ChevronRight } from 'lucide-react'
import { MonthFilter } from '@/components/dashboard/month-filter'
import PillarTrendChart from '@/components/dashboard/pillar-trend-chart-wrapper'
import { getMonthlyAverages, getMonthAudits } from '@/lib/analytics/pillar-data'
import { getMonthAggregates, aggregate, type LocalMonthly, type Pillar } from '@/lib/analytics/month-aggregates'
import GeoMap, { type GeoPoint } from '@/components/dashboard/geo-map'

// ─── Shell Lubricantes brand colors (Pantone oficiales del logo) ──────────
const SHELL = {
  yellow: '#FFCD00',    // PANTONE 116 C
  red:    '#DA291C',    // PANTONE 485 C
  blue:   '#005EB8',    // PANTONE 2945 C
  navy:   '#0A1929',    // dark hero bg
}

function getScoreColor(score: number) {
  if (score >= 70) return 'text-green-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

function getScoreBg(score: number) {
  if (score >= 70) return 'bg-green-100 text-green-800'
  if (score >= 40) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

function getBarColor(score: number) {
  if (score >= 70) return 'bg-green-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

// Trend arrow: compares current vs prev value
function TrendArrow({ curr, prev }: { curr: number; prev: number | null }) {
  if (prev === null) return <span className="text-muted-foreground text-xs">—</span>
  const diff = curr - prev
  if (diff >= 2) return <span className="text-green-600 text-sm font-bold">↑</span>
  if (diff <= -2) return <span className="text-red-500 text-sm font-bold">↓</span>
  return <span className="text-muted-foreground text-sm">→</span>
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ month?: string }>
}


type LocationData = {
  id: string
  name: string
  region: string | null
  sa_status: boolean
}


/** Paginate a Supabase query to bypass the 1000-row default limit */
async function fetchAllPages<T>(
  queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const PAGE = 1000
  let offset = 0
  const all: T[] = []
  while (true) {
    const { data } = await queryFn(offset, offset + PAGE - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()

  // Default: previous month
  const now = new Date()
  const defaultMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const selectedMonth =
    params.month ??
    `${defaultMonth.getFullYear()}-${String(defaultMonth.getMonth() + 1).padStart(2, '0')}`

  const isAllMonths = selectedMonth === 'all'

  // Date ranges in UTC (Biblia convention — match month-aggregates.ts).
  const [selYear, selMonth] = isAllMonths ? [0, 0] : selectedMonth.split('-').map(Number)
  const monthStart = isAllMonths ? '' : new Date(Date.UTC(selYear, selMonth - 1, 1)).toISOString()
  const monthEndExtended = isAllMonths ? '' : new Date(Date.UTC(selYear, selMonth, 1, 5, 0, 0)).toISOString()
  const monthEnd = monthEndExtended

  const prevYear = isAllMonths ? 0 : (selMonth === 1 ? selYear - 1 : selYear)
  const prevMonth = isAllMonths ? 0 : (selMonth === 1 ? 12 : selMonth - 1)
  const prevMonthStart = isAllMonths ? '' : new Date(Date.UTC(prevYear, prevMonth - 1, 1)).toISOString()
  const prevMonthEndExtended = isAllMonths ? '' : new Date(Date.UTC(prevYear, prevMonth, 1, 5, 0, 0)).toISOString()
  const prevMonthEnd = prevMonthEndExtended

  // Smart form selection: 2026+ → 664005 (form 3.0 since January 2026);
  // 2025 and earlier → 649132 (historical 2.0).
  const monthFormId = (!isAllMonths && selYear >= 2026) ? '664005' : '649132'
  const prevMonthFormId = (!isAllMonths && prevYear >= 2026) ? '664005' : '649132'

  // Filtros OR: (effective_month = mes) OR (effective_month IS NULL AND audited_at ∈ rango)
  // Incluye visitas reasignadas a este mes, excluye reasignadas a OTRO mes.
  const monthOrFilter = isAllMonths ? '' :
    `effective_month.eq.${selectedMonth},and(effective_month.is.null,audited_at.gte.${monthStart},audited_at.lte.${monthEndExtended})`
  const prevMonthKey = isAllMonths ? '' : `${prevYear}-${String(prevMonth).padStart(2, '0')}`
  const prevMonthOrFilter = isAllMonths ? '' :
    `effective_month.eq.${prevMonthKey},and(effective_month.is.null,audited_at.gte.${prevMonthStart},audited_at.lte.${prevMonthEndExtended})`

  // Build audit queries — contamos TODAS las visitas (no solo aprobadas) para reflejar:
  //  - reasignaciones (visitas en pre_* / pending_review también deben aparecer)
  //  - cerrados / no encontrados (también son visitas que ocurrieron)
  // Excluimos solo las suspendidas y las rechazadas por el revisor humano.
  type AuditOutcome = { id: string; location_id: string; status: string; form_state?: string | null }
  type MysteryRowPaged = { id: string; location_id: string; form_state: string | null }

  // NOTE: incluimos TODAS las visitas (incl. status=rechazado, form_state
  // malo) para poder contar "no logrados" correctamente. La Biblia filtra
  // después al calcular notas; este query es solo para cobertura.
  const buildAuditQuery = (formIds: string[], orFilter: string) => {
    let q = supabase
      .from('audits')
      .select('id, location_id, status, form_state:raw_data->>form_state')
      .in('datascope_form_id', formIds)
      .is('suspended_at', null)
    if (orFilter) q = q.or(orFilter)
    return q
  }

  const fetchAuditOutcomes = () => {
    if (isAllMonths) {
      return fetchAllPages<AuditOutcome>((from, to) =>
        buildAuditQuery(['664005', '649132'], '').range(from, to)
      )
    }
    return fetchAllPages<AuditOutcome>((from, to) =>
      buildAuditQuery([monthFormId], monthOrFilter).range(from, to)
    )
  }

  const fetchPrevAuditOutcomes = () => {
    if (isAllMonths) return Promise.resolve([] as AuditOutcome[])
    return fetchAllPages<AuditOutcome>((from, to) =>
      buildAuditQuery([prevMonthFormId], prevMonthOrFilter).range(from, to)
    )
  }

  const fetchMysteryRows = async () => {
    if (isAllMonths) {
      const { count } = await supabase
        .from('audits')
        .select('*', { count: 'exact', head: true })
        .in('datascope_form_id', ['rec-652647'])
        .is('suspended_at', null)
      return { rows: [] as MysteryRowPaged[], count: count ?? 0 }
    }
    const rows = await fetchAllPages<MysteryRowPaged>((from, to) =>
      supabase
        .from('audits')
        .select('id, location_id, form_state:raw_data->>form_state')
        .in('datascope_form_id', ['rec-652647'])
        .is('suspended_at', null)
        .or(monthOrFilter)
        .range(from, to)
    )
    return { rows, count: rows.length }
  }

  const [
    auditOutcomes,
    prevAuditOutcomes,
    mysteryResult,
    locationsRes,
    geoLocsRes,
    allMonthlyAverages,
  ] = await Promise.all([
    fetchAuditOutcomes(),
    fetchPrevAuditOutcomes(),
    fetchMysteryRows(),
    supabase
      .from('locations')
      .select('id, name, region, sa_status')
      .eq('is_active', true),
    // Coordenadas para el mapa de calor (solo locales con lat/lng registrados)
    supabase
      .from('locations')
      .select('id, name, code, region, latitude, longitude')
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null),
    // Current month: both forms (664005 + 649132 backfilled)
    getMonthlyAverages(),
  ])

  // Derive available months from already-fetched averages (avoids a 2nd getMonthlyAverages() call)
  const availableMonths = (() => {
    const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const list = [...allMonthlyAverages].reverse().map((m) => ({ value: m.month, label: m.fullLabel }))
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    if (!list.find((m) => m.value === currentMonth)) {
      list.unshift({ value: currentMonth, label: `${MONTHS_ES[now.getMonth()]} ${now.getFullYear()}` })
    }
    return list
  })()

  // Shim para mantener la forma de { data, count } del código posterior
  const rec01QRes = { data: mysteryResult.rows, count: mysteryResult.count }

  // Helpers para clasificar por form_state
  const isCerrado = (fs: string | null | undefined) => (fs ?? '').toLowerCase().trim().includes('cerrado')
  const isNoEncontrado = (fs: string | null | undefined) => {
    const t = (fs ?? '').toLowerCase().trim()
    return t.includes('no encontrado') || t.includes('noencontrado')
  }
  const isNoPermite = (fs: string | null | undefined) => {
    const t = (fs ?? '').toLowerCase().trim()
    return t.includes('no permite')
  }
  // Lifting se hizo: form_state válido Y el revisor no la rechazó
  const liftingDone = (a: AuditOutcome) =>
    !isCerrado(a.form_state) &&
    !isNoEncontrado(a.form_state) &&
    !isNoPermite(a.form_state) &&
    a.status !== 'rechazado'

  // Dedup por local: una sola visita cuenta por local (elegir la mejor: con lifting done > sin lifting).
  // Un local visitado 2 veces (ej. primero cerrado, después aprobado) se cuenta como logrado.
  const locationBest = new Map<string, AuditOutcome>()
  for (const a of auditOutcomes) {
    const existing = locationBest.get(a.location_id)
    if (!existing) { locationBest.set(a.location_id, a); continue }
    // Preferir lifting done sobre no lifting
    if (liftingDone(a) && !liftingDone(existing)) locationBest.set(a.location_id, a)
  }
  const uniqueLocationAudits = [...locationBest.values()]

  // Breakdown — "No logrados" = locales donde NINGUNA visita fue lifting done
  const auditNoLogrados = uniqueLocationAudits.filter(a => !liftingDone(a)).length

  // Mystery: dedup 1 por local (regla Biblia) — preferir la visita LOGRADA
  // sobre cerrado/no encontrado/no permite, y reciente sobre vieja.
  type MysteryRow = { id: string; location_id: string; form_state: string | null }
  const mysteryRows = (rec01QRes.data ?? []) as unknown as MysteryRow[]
  const mysteryLiftingDone = (r: MysteryRow) =>
    !isCerrado(r.form_state) && !isNoEncontrado(r.form_state) && !isNoPermite(r.form_state)
  const mysteryByLoc = new Map<string, MysteryRow>()
  for (const r of mysteryRows) {
    const existing = mysteryByLoc.get(r.location_id)
    if (!existing) { mysteryByLoc.set(r.location_id, r); continue }
    if (mysteryLiftingDone(r) && !mysteryLiftingDone(existing)) mysteryByLoc.set(r.location_id, r)
  }
  const mysteryUnique = [...mysteryByLoc.values()]
  // All-months: use exact count from DB; single month: unique locations
  let mysteryCount = isAllMonths ? (rec01QRes.count ?? 0) : mysteryUnique.length
  // "No logrados" = locales donde la visita representativa NO se pudo levantar
  let mysteryCerrados = isAllMonths ? 0 : mysteryUnique.filter((r) => !mysteryLiftingDone(r)).length

  // Contador de visitas = locales únicos visitados este mes (incluye cerrados/no encontrados/pendientes)
  const auditCount = uniqueLocationAudits.length
  // Total de visitas individuales (puede ser > locales si hubo revisitas, ej. cerrado y luego aprobado)
  const totalVisits = auditOutcomes.length
  const totalLocations = locationsRes.data?.length ?? 0
  const totalRegions = new Set((locationsRes.data ?? []).map((l) => l.region).filter(Boolean)).size

  // Build location map
  const locationMap = new Map<string, LocationData>(
    (locationsRes.data ?? []).map((l) => [l.id, l as LocationData])
  )

  // Score calc: SOLO visitas donde se hizo el levantamiento (excluye cerrados, no encontrados, no permite).
  const scoredOutcomes = auditOutcomes.filter(liftingDone)
  const prevScoredOutcomes = prevAuditOutcomes.filter(liftingDone)

  // KPI averages
  const auditTarget = totalLocations
  const mysteryTarget = totalLocations
  const auditPct = auditTarget > 0 ? Math.round((auditCount / auditTarget) * 100) : 0
  const mysteryPct = mysteryTarget > 0 ? Math.round((mysteryCount / mysteryTarget) * 100) : 0

  // ── BIBLIA DEL CÁLCULO ────────────────────────────────────────────────────
  // Todos los promedios que se muestran abajo salen de getMonthAggregates,
  // que materializa una sola lista 1 fila por (local, mes). Ver CLAUDE.md.
  const prevMonthAggKey = isAllMonths ? null : `${prevYear}-${String(prevMonth).padStart(2, '0')}`
  const [canonicalCurr, canonicalPrev] = await Promise.all([
    getMonthAggregates(isAllMonths ? 'all' : selectedMonth),
    prevMonthAggKey ? getMonthAggregates(prevMonthAggKey) : Promise.resolve({ locales: [] as LocalMonthly[] }),
  ])
  const canonLocs = canonicalCurr.locales
  const canonPrev = canonicalPrev.locales

  const PILLAR_CANONICAL_ORDER = ['Disponibilidad', 'Exhibición y POP', 'Recomendación', 'Precio']
  const PILLAR_CANONICAL_WEIGHT: Record<string, number> = {
    'Disponibilidad': 30, 'Exhibición y POP': 30, 'Recomendación': 25, 'Precio': 15,
  }
  const PILLAR_FIELD: Record<string, Pillar> = {
    'Disponibilidad': 'disp', 'Exhibición y POP': 'exh', 'Recomendación': 'rec', 'Precio': 'prc',
  }

  // Total del mes
  const totalAvg = aggregate(canonLocs, () => true, 'total')
  const avgTotal = totalAvg == null ? '-' : totalAvg.toFixed(1)

  // Promedios por pilar (orden canónico)
  const pillarAverages = PILLAR_CANONICAL_ORDER.map((name) => {
    const field = PILLAR_FIELD[name]
    const a = aggregate(canonLocs, () => true, field)
    return { name, avg: a == null ? 0 : parseFloat(a.toFixed(1)), weight: PILLAR_CANONICAL_WEIGHT[name] ?? 0 }
  }).filter((p) => canonLocs.some((l) => l[PILLAR_FIELD[p.name]] != null))

  // Mes anterior — para flechas de tendencia
  const prevTotal = aggregate(canonPrev, () => true, 'total')
  const prevAvgTotal = prevTotal == null ? null : Math.round(prevTotal)
  const prevPillarMap: Record<string, number> = {}
  for (const name of PILLAR_CANONICAL_ORDER) {
    const a = aggregate(canonPrev, () => true, PILLAR_FIELD[name])
    if (a != null) prevPillarMap[name] = Math.round(a)
  }

  // SA / No SA (el segment expected por UI: { count, total, pillars: [{name, avg}] })
  const buildSegment = (arr: LocalMonthly[], isSa: boolean) => {
    const seg = arr.filter((l) => l.sa === isSa)
    const total = aggregate(seg, () => true, 'total')
    const pillars = PILLAR_CANONICAL_ORDER.map((name) => ({
      name,
      avg: Math.round(aggregate(seg, () => true, PILLAR_FIELD[name]) ?? 0),
    }))
    return { count: seg.length, total: total == null ? 0 : Math.round(total), pillars }
  }
  const saCurrent = buildSegment(canonLocs, true)
  const noSaCurrent = buildSegment(canonLocs, false)
  const saPrev = buildSegment(canonPrev, true)
  const noSaPrev = buildSegment(canonPrev, false)

  // Region averages desde la Biblia (canonLocs = lista canónica locales del mes)
  const regionBuckets = new Map<string, LocalMonthly[]>()
  for (const l of canonLocs) {
    const r = l.region ?? 'Sin Región'
    if (!regionBuckets.has(r)) regionBuckets.set(r, [])
    regionBuckets.get(r)!.push(l)
  }
  const prevRegionBuckets = new Map<string, LocalMonthly[]>()
  for (const l of canonPrev) {
    const r = l.region ?? 'Sin Región'
    if (!prevRegionBuckets.has(r)) prevRegionBuckets.set(r, [])
    prevRegionBuckets.get(r)!.push(l)
  }
  const regionAverages = [...regionBuckets.entries()]
    .map(([region, arr]) => {
      const a = aggregate(arr, () => true, 'total')
      const prevArr = prevRegionBuckets.get(region)
      const prev = prevArr ? aggregate(prevArr, () => true, 'total') : null
      return {
        region,
        avg: a == null ? 0 : parseFloat(a.toFixed(1)),
        count: arr.filter((l) => l.total != null).length,
        prevAvg: prev == null ? null : Math.round(prev),
      }
    })
    .sort((a, b) => b.avg - a.avg)

  // Chart months come from getMonthlyAverages() (already fetched in Promise.all)
  const chartMonths = allMonthlyAverages.map(({ mes, disp, exh, precio, rec }) => ({ mes, disp, exh, precio, rec }))

  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const monthLabel = isAllMonths ? 'Todos los meses' : `${MONTHS[selMonth - 1]} ${selYear}`

  const PILLAR_SHORT: Record<string, string> = {
    'Disponibilidad': 'Disponibilidad',
    'Exhibición y POP': 'Exhibición',
    'Precio': 'Precio',
    'Recomendación': 'Recomendación',
  }

  // Fixed pillar colors — fuente única en @/lib/pillar-colors (paleta Shell)
  // Mapeo: Disp=azul, Exh=rojo, Rec=amarillo, Precio=gris

  const PILLAR_SLUG: Record<string, string> = {
    'Disponibilidad': 'disponibilidad',
    'Exhibición y POP': 'exhibicion',
    'Precio': 'precio',
    'Recomendación': 'recomendacion',
  }

  // ── MAPA DE CALOR — puntos georeferenciados del mes ───────────────────────
  const canonLocById = new Map(canonLocs.map((l) => [l.loc_id, l]))
  const geoPoints: GeoPoint[] = (geoLocsRes.data ?? []).map((gl) => {
    const canon = canonLocById.get(gl.id as string)
    return {
      lat: gl.latitude as number,
      lng: gl.longitude as number,
      name: gl.name as string,
      code: gl.code as string,
      region: gl.region as string | null,
      score: canon?.total != null ? parseFloat(Number(canon.total).toFixed(1)) : null,
    }
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Panel de Perfect Store</p>
          <h2 className="text-2xl font-black tracking-tight">{monthLabel}</h2>
        </div>
        <Suspense>
          <MonthFilter value={selectedMonth} availableMonths={availableMonths} showAll />
        </Suspense>
      </div>

      {/* KPI row — 4 cards en una fila, compactos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Promedio General (hero dark) */}
        <div
          className="relative overflow-hidden rounded-xl p-4 text-white"
          style={{ background: `linear-gradient(135deg, ${SHELL.navy} 0%, #111c2e 70%, ${SHELL.red} 200%)` }}
        >
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: SHELL.yellow }} />
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20"
            style={{ background: `radial-gradient(circle, ${SHELL.yellow} 0%, transparent 70%)` }}
          />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Nota Tienda Perfecta Shell</span>
              <Target className="h-4 w-4" style={{ color: SHELL.yellow }} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-3xl font-black tracking-tight"
                style={{ color: avgTotal !== '-' ? SHELL.yellow : '#94a3b8' }}
              >
                {avgTotal}{avgTotal !== '-' ? '%' : ''}
              </span>
              {!isAllMonths && avgTotal !== '-' && prevAvgTotal !== null && (
                <TrendArrow curr={parseFloat(avgTotal)} prev={prevAvgTotal} />
              )}
            </div>
            <div className="mt-1.5 space-y-0.5 text-[11px] text-white/60">
              <p>{canonLocs.filter(l => l.total != null).length} locales con puntaje</p>
              {!isAllMonths && prevAvgTotal !== null && (
                <p>Mes anterior <span className="font-semibold text-white/80">{prevAvgTotal}%</span></p>
              )}
            </div>
          </div>
        </div>

        {/* Auditorías */}
        <Card className="overflow-hidden relative border-l-4" style={{ borderLeftColor: SHELL.red }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Auditorías</span>
              <ClipboardCheck className="h-4 w-4" style={{ color: SHELL.red }} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black tracking-tight">{auditCount}</span>
              {!isAllMonths && <span className="text-sm text-muted-foreground">/ {auditTarget}</span>}
            </div>
            {!isAllMonths ? (
              <>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(auditPct, 100)}%`, background: SHELL.red }}
                  />
                </div>
                <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                  <p>{auditPct}% del mes</p>
                  <p>{auditCount} visita{auditCount !== 1 ? 's' : ''}</p>
                  <p title="Cerrados, no encontrados y no permite. No cuentan para el cálculo de nota.">
                    {auditNoLogrados} no logrado{auditNoLogrados !== 1 ? 's' : ''}
                  </p>
                </div>
              </>
            ) : (
              <p className="mt-1.5 text-[11px] text-muted-foreground">visitas acumuladas</p>
            )}
          </CardContent>
        </Card>

        {/* Mystery */}
        <Card className="overflow-hidden relative border-l-4" style={{ borderLeftColor: SHELL.blue }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mystery Shopper</span>
              <Search className="h-4 w-4" style={{ color: SHELL.blue }} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black tracking-tight">{mysteryCount}</span>
              {!isAllMonths && <span className="text-sm text-muted-foreground">/ {mysteryTarget}</span>}
            </div>
            {!isAllMonths ? (
              <>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(mysteryPct, 100)}%`, background: SHELL.blue }}
                  />
                </div>
                <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                  <p>{mysteryPct}% del mes</p>
                  <p>{mysteryCount} visita{mysteryCount !== 1 ? 's' : ''}</p>
                  <p>{mysteryCerrados} no logrado{mysteryCerrados !== 1 ? 's' : ''}</p>
                </div>
              </>
            ) : (
              <p className="mt-1.5 text-[11px] text-muted-foreground">visitas acumuladas</p>
            )}
          </CardContent>
        </Card>

        {/* Locales Activos */}
        <Card className="overflow-hidden relative border-l-4" style={{ borderLeftColor: SHELL.yellow }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Locales Activos</span>
              <MapPin className="h-4 w-4" style={{ color: '#9a7a00' }} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black tracking-tight">{totalLocations}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{totalRegions} regiones</p>
          </CardContent>
        </Card>
      </div>

      {/* Resultados por Pilar */}
      {pillarAverages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <SectionHeader eyebrow="Resultados" title="Por Pilar" accent="yellow" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {pillarAverages.map((p) => {
                const slug = PILLAR_SLUG[p.name]
                const href = slug ? `/analytics/${slug}?month=${selectedMonth}` : null
                const pc = getPillarColor(p.name)
                const inner = (
                  <>
                    {/* Fill bar — % pintado desde abajo */}
                    <div
                      className="absolute bottom-0 left-0 right-0 transition-all duration-700 pointer-events-none"
                      style={{ height: `${Math.min(p.avg, 100)}%`, background: pc.hexSoft }}
                      aria-hidden
                    />

                    {/* Chip de peso */}
                    <span className="relative text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/70 rounded-full px-2 py-0.5 w-fit inline-block">
                      {p.weight}%
                    </span>

                    {/* Chevron solo si tiene detalle */}
                    {href && (
                      <div
                        className="absolute top-2 right-2 rounded-full p-1.5 z-10"
                        style={{ background: `${pc.hex}22` }}
                      >
                        <ChevronRight className="h-4 w-4" strokeWidth={2.5} style={{ color: pc.hex }} />
                      </div>
                    )}

                    {/* Score + nombre abajo */}
                    <div className="absolute bottom-3 left-4 right-4">
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-3xl font-black tracking-tight leading-none" style={{ color: pc.hex }}>
                          {p.avg}%
                        </p>
                        <TrendArrow curr={p.avg} prev={prevPillarMap[p.name] ?? null} />
                      </div>
                      <p className="text-xs font-semibold text-foreground truncate mt-1">{p.name}</p>
                    </div>
                  </>
                )
                const commonClass = 'relative rounded-2xl border-2 p-4 overflow-hidden bg-card h-32'
                if (href) {
                  return (
                    <Link
                      key={p.name}
                      href={href}
                      prefetch={false}
                      className={`${commonClass} block hover:shadow-md transition-shadow`}
                      style={{ borderColor: pc.hex }}
                    >
                      {inner}
                    </Link>
                  )
                }
                return (
                  <div key={p.name} className={commonClass} style={{ borderColor: pc.hex }}>
                    {inner}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {canonLocs.filter(l => l.total != null).length === 0 && (
        <Card>
          <CardContent className="py-12">
            <p className="text-sm text-muted-foreground text-center">Sin resultados aún</p>
          </CardContent>
        </Card>
      )}

      {/* Gráfico de tendencia por pilar */}
      {chartMonths.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <SectionHeader eyebrow="Evolución" title="Tendencia por Pilar" accent="red" />
          </CardHeader>
          <CardContent>
            <PillarTrendChart months={chartMonths} />
          </CardContent>
        </Card>
      )}

      {/* SA vs No SA */}
      {(saCurrent.count > 0 || noSaCurrent.count > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'SA', data: saCurrent, prev: saPrev, accent: SHELL.blue },
            { label: 'No SA', data: noSaCurrent, prev: noSaPrev, accent: SHELL.yellow },
          ].map(({ label, data, prev, accent }) => (
            <Card key={label} className="overflow-hidden relative border-t-[3px]" style={{ borderTopColor: accent }}>
              <CardHeader className="pb-2">
                <SectionHeader
                  eyebrow="Segmento"
                  title={label}
                  accent={accent === SHELL.blue ? 'blue' : 'yellow'}
                  right={<span className="text-xs text-muted-foreground font-semibold">{data.count} locales</span>}
                />
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Total */}
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-sm font-semibold">Nota Total</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${getScoreColor(data.total)}`}>
                      {data.total}%
                    </span>
                    <TrendArrow curr={data.total} prev={prev.count > 0 ? prev.total : null} />
                  </div>
                </div>
                {/* Pillars */}
                {data.pillars.map((p) => {
                  const prevP = prev.pillars.find((pp) => pp.name === p.name)
                  return (
                    <div key={p.name} className="flex items-center justify-between px-1">
                      <span className="text-sm text-muted-foreground">
                        {PILLAR_SHORT[p.name] ?? p.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${getScoreColor(p.avg)}`}>
                          {p.avg}%
                        </span>
                        <TrendArrow curr={p.avg} prev={prevP?.avg ?? null} />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* LÍNEA 5 — Geografía: Regiones + Mapa lado a lado */}
      {regionAverages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <SectionHeader eyebrow="Geografía" title="Distribución Geográfica" accent="blue" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Izquierda — Resultados por Región */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Por Región</p>
                {regionAverages.map((r) => (
                  <div key={r.region} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.region}</span>
                        <span className="text-xs text-muted-foreground">
                          ({r.count} {r.count === 1 ? 'local' : 'locales'})
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendArrow curr={r.avg} prev={r.prevAvg} />
                        <Badge className={getScoreBg(r.avg)}>{r.avg}%</Badge>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${getBarColor(r.avg)}`}
                        style={{ width: `${Math.min(r.avg, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Derecha — Mapa de Locales */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mapa de Locales</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />≥70%</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" />50–69%</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />&lt;50%</span>
                  </div>
                </div>
                <GeoMap points={geoPoints} />
                {geoPoints.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {geoPoints.length} local{geoPoints.length !== 1 ? 'es' : ''} con coordenadas · Clic en un punto para ver detalle
                  </p>
                )}
              </div>

            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
