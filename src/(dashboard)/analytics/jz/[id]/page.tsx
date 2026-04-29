import { createClient } from '@/lib/supabase/server'
import { fetchAllPages } from '@/lib/supabase/paginate'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getMonthAudits, buildMonthRange, getAvailableMonths, defaultMonth } from '@/lib/analytics/pillar-data'
import { Suspense } from 'react'
import { MonthFilter } from '@/components/dashboard/month-filter'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string }>
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function scoreColor(score: number) {
  if (score >= 70) return { text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' }
  if (score >= 50) return { text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' }
  return { text: 'text-red-600', badge: 'bg-red-100 text-red-800', dot: 'bg-red-500' }
}

function avg(arr: number[]) {
  return arr.length === 0 ? 0 : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

export default async function JZDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const month = sp.month ?? defaultMonth()
  const [selYear, selMonth] = month.split('-').map(Number)
  const monthLabel = `${MONTHS[selMonth - 1]} ${selYear}`

  const supabase = await createClient()

  const [staffRes, availableMonths] = await Promise.all([
    supabase.from('staff').select('id, first_name, last_name').eq('id', id).single(),
    getAvailableMonths(),
  ])

  const staff = staffRes.data
  const staffName = staff ? `${staff.first_name} ${staff.last_name}` : id

  // Fetch locations assigned to this JZ
  const { data: locs } = await supabase
    .from('locations')
    .select('id, name, code, region, sa_status')
    .eq('staff_jz_id', id)
    .eq('is_active', true)

  const locList = locs ?? []
  const locIds = locList.map((l) => l.id)

  // Fetch audits for the month
  const { monthStart, monthEnd } = buildMonthRange(month)
  const auditRows = await getMonthAudits(monthStart, monthEnd)

  // Collect ALL audit IDs per location (no arbitrary first-pick)
  const auditIdsByLoc = new Map<string, string[]>()
  for (const a of auditRows) {
    if (locIds.includes(a.location_id)) {
      const existing = auditIdsByLoc.get(a.location_id) ?? []
      existing.push(a.id)
      auditIdsByLoc.set(a.location_id, existing)
    }
  }

  const auditIds = [...new Set([...auditIdsByLoc.values()].flat())]

  // Fetch scores with calculated_at to pick latest per location — paginated
  type ScoreRow = { audit_id: string; total_score: number | null; pillar_scores: { pillar_name: string; score: number }[] | null; calculated_at: string | null }
  const scoresData = auditIds.length > 0
    ? await fetchAllPages<ScoreRow>((from, to) =>
        supabase.from('scores').select('audit_id, total_score, pillar_scores, calculated_at').in('audit_id', auditIds).range(from, to)
      )
    : []

  // Pick latest score per location (across all its audits in the month)
  const scoreByLoc = new Map<string, ScoreRow>()
  for (const s of scoresData as ScoreRow[]) {
    // find which location this audit belongs to
    for (const [locId, ids] of auditIdsByLoc) {
      if (ids.includes(s.audit_id)) {
        const existing = scoreByLoc.get(locId)
        if (!existing || (s.calculated_at ?? '') > (existing.calculated_at ?? '')) {
          scoreByLoc.set(locId, s)
        }
        break
      }
    }
  }

  // Build per-location rows
  const rows = locList.map((loc) => {
    const score = scoreByLoc.get(loc.id)
    const auditId = score?.audit_id ?? [...(auditIdsByLoc.get(loc.id) ?? [])][0]
    return {
      ...loc,
      auditId,
      total: score?.total_score ?? null,
      pillars: score?.pillar_scores ?? [],
    }
  }).sort((a, b) => {
    // Sort: with scores first (desc), then without
    if (a.total !== null && b.total !== null) return b.total - a.total
    if (a.total !== null) return -1
    if (b.total !== null) return 1
    return a.name.localeCompare(b.name)
  })

  const scoredRows = rows.filter((r) => r.total !== null)
  const overallAvg = avg(scoredRows.map((r) => r.total as number))

  const PILLAR_ORDER = ['Disponibilidad', 'Exhibición y POP', 'Precio', 'Recomendación']

  // Collect all pillar names present
  const allPillarNames = PILLAR_ORDER.filter((pName) =>
    scoredRows.some((r) => r.pillars.some((p) => p.pillar_name === pName))
  )

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/analytics?month=${month}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" />
            Resultados
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">{staffName}</h1>
            <p className="text-sm text-muted-foreground">Jefe de Zona · {monthLabel}</p>
          </div>
          <Suspense>
            <MonthFilter value={month} availableMonths={availableMonths} />
          </Suspense>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Locales</p>
          <p className="text-3xl font-bold">{locList.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Auditados</p>
          <p className="text-3xl font-bold text-blue-600">{scoredRows.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Promedio</p>
          {scoredRows.length > 0
            ? <p className={`text-3xl font-bold ${scoreColor(overallAvg).text}`}>{overallAvg}%</p>
            : <p className="text-3xl font-bold text-muted-foreground">—</p>
          }
        </div>
      </div>

      {/* Pillar averages */}
      {allPillarNames.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Promedios por Pilar</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allPillarNames.map((pName) => {
              const vals = scoredRows
                .flatMap((r) => r.pillars)
                .filter((p) => p.pillar_name === pName)
                .map((p) => p.score)
              const pillarAvg = avg(vals)
              const { text } = scoreColor(pillarAvg)
              return (
                <div key={pName} className="text-center">
                  <p className="text-xs text-muted-foreground truncate mb-0.5">{pName}</p>
                  <p className={`text-2xl font-bold ${text}`}>{vals.length > 0 ? `${pillarAvg}%` : '—'}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Location table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-4 py-3">
          <p className="text-sm font-bold text-white">Locales ({locList.length})</p>
        </div>
        <div className="divide-y">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin locales asignados</p>
          ) : rows.map((loc) => {
            const total = loc.total
            const { badge, dot } = total !== null ? scoreColor(total) : { badge: 'bg-muted text-muted-foreground', dot: 'bg-muted' }
            return (
              <div key={loc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{loc.code} — {loc.name}</p>
                  <p className="text-xs text-muted-foreground">{loc.region ?? 'Sin región'} {loc.sa_status ? '· SA' : ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {total !== null ? (
                    <>
                      <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${badge}`}>{total}%</span>
                      <Link href={`/locations/${loc.id}`} className="text-muted-foreground hover:text-foreground transition-colors">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin auditoría</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
