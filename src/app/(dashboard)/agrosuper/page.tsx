import { MetricCard } from '@/components/agrosuper/metric-card'
import { PanaderiaChart, FachadaChart, ImplementationDistributionChart, AllMaterialsChart } from '@/components/agrosuper/implementation-charts'
import { DashboardFilters } from '@/components/agrosuper/dashboard-filters'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createAdminClient } from '@/lib/supabase/admin'
import { Suspense } from 'react'

export const revalidate = 0

const MONTH_LABELS: Record<string, string> = {
  '2026-01': 'Enero 2026',    '2026-02': 'Febrero 2026', '2026-03': 'Marzo 2026',
  '2026-04': 'Abril 2026',    '2026-05': 'Mayo 2026',    '2026-06': 'Junio 2026',
  '2026-07': 'Julio 2026',    '2026-08': 'Agosto 2026',  '2026-09': 'Sep. 2026',
  '2026-10': 'Octubre 2026',  '2026-11': 'Nov. 2026',    '2026-12': 'Dic. 2026',
}

function nextMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export default async function AgrosuperDashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; campaign?: string }>
}) {
  const supabase = createAdminClient()
  const params = await searchParams

  // Fetch all months available
  const { data: allAudits } = await supabase
    .from('agrosuper_audits')
    .select('submitted_at, form_number')
    .order('submitted_at', { ascending: false })

  const months = [...new Set((allAudits || []).map(a => a.submitted_at.slice(0, 7)))].sort().reverse()
  const selectedMonth = params.month || months[0] || '2026-04'

  // Campaigns derived from months
  const campaigns = months.map(m => `Campaña ${MONTH_LABELS[m] ?? m}`)
  const selectedCampaign = params.campaign || campaigns[0] || ''

  // Fetch audits filtered by selected month
  const { data: auditsRaw } = await supabase
    .from('agrosuper_audits')
    .select('*, locations(name, region)')
    .gte('submitted_at', `${selectedMonth}-01T00:00:00`)
    .lt('submitted_at',  `${nextMonth(selectedMonth)}-01T00:00:00`)
    .order('submitted_at', { ascending: false })

  const audits = (auditsRaw || []).map((a: any) => ({
    ...a,
    location_name: a.locations?.name ?? 'Sin nombre',
    commune: a.locations?.region ?? '',
  }))

  // Fetch materials only for the filtered audits
  const auditIds = audits.map((a: any) => a.id)
  const { data: materialsRaw } = auditIds.length > 0
    ? await supabase.from('agrosuper_materials').select('*').in('audit_id', auditIds)
    : { data: [] }
  const mats = materialsRaw || []

  const total = audits.length
  const uniqueCommunes = new Set(audits.map((a: any) => a.commune).filter(Boolean)).size

  const implementedCount = audits.filter((a: any) => (a.implementation_rate ?? 0) > 0).length
  const implementedPct = total > 0 ? Math.round((implementedCount / total) * 100) : 0

  const avgRate = total > 0
    ? Math.round(audits.reduce((s: number, a: any) => s + (a.implementation_rate ?? 0), 0) / total)
    : 0

  const laCrianza = total > 0
    ? Math.round(audits.reduce((s: number, a: any) => s + (a.metrics_by_brand?.la_crianza ?? 0), 0) / total)
    : 0

  const superCerdo = total > 0
    ? Math.round(audits.reduce((s: number, a: any) => s + (a.metrics_by_brand?.super_cerdo ?? 0), 0) / total)
    : 0

  const success = audits.filter((a: any) => a.implementation_rate >= 80).length
  const partial  = audits.filter((a: any) => a.implementation_rate >= 50 && a.implementation_rate < 80).length
  const low      = audits.filter((a: any) => a.implementation_rate < 50).length

  // Top 5 comunas
  const communeMap: Record<string, { total: number; count: number }> = {}
  audits.forEach((a: any) => {
    const c = a.commune
    if (!c) return
    if (!communeMap[c]) communeMap[c] = { total: 0, count: 0 }
    communeMap[c].total += a.implementation_rate ?? 0
    communeMap[c].count += 1
  })
  const topCommunes = Object.entries(communeMap)
    .map(([name, { total: t, count }]) => ({ name, avg: Math.round(t / count), count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)

  const statusBadge = (rate: number) => {
    if (rate >= 80) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>
    if (rate >= 50) return <Badge className="bg-yellow-100 text-yellow-800">Parcial</Badge>
    return <Badge className="bg-red-100 text-red-800">Bajo</Badge>
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header + Filtros */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
          <h1 className="text-3xl font-bold">Implementación POP — Canal Tradicional RM</h1>
          <Suspense>
            <DashboardFilters
              months={months}
              campaigns={campaigns}
              selectedMonth={selectedMonth}
              selectedCampaign={selectedCampaign}
            />
          </Suspense>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Locales Implementados"
          value={implementedPct}
          unit="%"
          description={`${total} locales visitados`}
          trend={implementedPct >= 80 ? 'up' : implementedPct >= 50 ? 'neutral' : 'down'}
        />
        <MetricCard
          label="Promedio de implementación por local"
          value={avgRate}
          unit="%"
          description={`Sobre ${total} locales visitados`}
          trend={avgRate >= 80 ? 'up' : avgRate >= 50 ? 'neutral' : 'down'}
        />
        <MetricCard
          label="La Crianza"
          value={laCrianza}
          unit="%"
          description="Promedio implementación"
          trend={laCrianza >= 80 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="Super Cerdo"
          value={superCerdo}
          unit="%"
          description="Promedio implementación"
          trend={superCerdo >= 80 ? 'up' : 'neutral'}
        />
      </div>

      {/* Panadería + Fachada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PanaderiaChart materials={mats} />
        <FachadaChart materials={mats} />
      </div>

      {/* Todos los materiales */}
      <AllMaterialsChart materials={mats} />

      {/* Top comunas + Distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">🏆 Top 5 Comunas</h3>
          <div className="space-y-3">
            {topCommunes.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between pb-3 border-b last:border-b-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{i + 1}. {c.name}</p>
                  <p className="text-xs text-gray-500">{c.count} local{c.count !== 1 ? 'es' : ''}</p>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <p className="font-semibold text-lg">{c.avg}%</p>
                  {statusBadge(c.avg)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <ImplementationDistributionChart success={success} partial={partial} low={low} />
      </div>
    </div>
  )
}
