import { MetricCard } from '@/components/agrosuper/metric-card'
import { ImplementationDistributionChart } from '@/components/agrosuper/implementation-charts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createAdminClient } from '@/lib/supabase/admin'
import { MonthlyLineChart } from '@/components/agrosuper/monthly-line-chart'

export const revalidate = 0

const statusBadge = (rate: number) => {
  if (rate >= 80) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>
  if (rate >= 50) return <Badge className="bg-yellow-100 text-yellow-800">Parcial</Badge>
  return <Badge className="bg-red-100 text-red-800">Bajo</Badge>
}

export default async function AgrosuperDashboard() {
  const supabase = createAdminClient()

  // Campañas
  const { data: campaigns } = await supabase
    .from('agrosuper_campaigns')
    .select('id, name, month, column_type')
    .order('month', { ascending: false })

  const totalCampaigns = (campaigns || []).length

  // Auditorías de agrosuper_audits (campañas genéricas)
  const { data: auditsRaw } = await supabase
    .from('agrosuper_audits')
    .select('id, submitted_at, implementation_rate, metrics_by_brand, location_id, locations(name, region)')
    .order('submitted_at', { ascending: false })

  const audits = (auditsRaw || []).map((a: any) => ({
    ...a,
    location_name: a.locations?.name ?? 'Sin nombre',
    commune: a.locations?.region ?? '',
  }))

  // Auditorías de abril (tabla separada)
  const { data: abrilRaw } = await supabase
    .from('agrosuper_abril_audits')
    .select('id, submitted_at, implementation_rate, location_name')

  const abrilAudits = (abrilRaw || []).map((a: any) => ({
    id: a.id,
    submitted_at: a.submitted_at,
    implementation_rate: a.implementation_rate ?? 0,
    location_name: a.location_name ?? '',
    commune: '',
    metrics_by_brand: null,
  }))

  const allAudits = [...audits, ...abrilAudits]
  const totalVisitas = allAudits.length

  const implementedAudits = allAudits.filter(a => (a.implementation_rate ?? 0) > 0)
  const totalImplementados = implementedAudits.length
  const pctImplementados = totalVisitas > 0 ? Math.round((totalImplementados / totalVisitas) * 100) : 0
  const avgRate = totalVisitas > 0
    ? Math.round(allAudits.reduce((s, a) => s + (a.implementation_rate ?? 0), 0) / totalVisitas)
    : 0

  const success = allAudits.filter(a => (a.implementation_rate ?? 0) >= 80).length
  const partial  = allAudits.filter(a => { const r = a.implementation_rate ?? 0; return r >= 50 && r < 80 }).length
  const low      = allAudits.filter(a => { const r = a.implementation_rate ?? 0; return r > 0 && r < 50 }).length
  const none     = allAudits.filter(a => (a.implementation_rate ?? 0) === 0).length

  // Datos mensuales para gráfico de líneas
  const monthMap: Record<string, { visitas: number; implementados: number; sumRate: number }> = {}
  for (const a of allAudits) {
    const m = (a.submitted_at as string)?.slice(0, 7)
    if (!m) continue
    if (!monthMap[m]) monthMap[m] = { visitas: 0, implementados: 0, sumRate: 0 }
    monthMap[m].visitas += 1
    if ((a.implementation_rate ?? 0) > 0) monthMap[m].implementados += 1
    monthMap[m].sumRate += a.implementation_rate ?? 0
  }

  const MONTH_LABEL: Record<string, string> = {
    '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
    '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
    '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
  }

  const monthlyData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, { visitas, implementados, sumRate }]) => {
      const [year, mon] = ym.split('-')
      return {
        mes: `${MONTH_LABEL[mon] ?? mon} ${year.slice(2)}`,
        visitas,
        implementados,
        avgRate: Math.round(sumRate / visitas),
      }
    })

  // Top 5 comunas (solo de audits con región)
  const communeMap: Record<string, { sum: number; count: number }> = {}
  for (const a of audits) {
    if (!a.commune) continue
    if (!communeMap[a.commune]) communeMap[a.commune] = { sum: 0, count: 0 }
    communeMap[a.commune].sum += a.implementation_rate ?? 0
    communeMap[a.commune].count += 1
  }
  const topComunas = Object.entries(communeMap)
    .map(([name, { sum, count }]) => ({ name, avg: Math.round(sum / count), count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-secondary)' }}>
          Resultados Generales
        </h1>
        <p className="text-sm text-gray-500 mt-1">Canal Tradicional RM — Todas las campañas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Campañas"
          value={totalCampaigns}
          unit=""
          description="campañas registradas"
        />
        <MetricCard
          label="Locales Visitados"
          value={totalVisitas.toLocaleString('es-CL')}
          unit=""
          description="visitas en total"
        />
        <MetricCard
          label="Locales Implementados"
          value={pctImplementados}
          unit="%"
          description={`${totalImplementados.toLocaleString('es-CL')} de ${totalVisitas.toLocaleString('es-CL')} visitas`}
          trend={pctImplementados >= 80 ? 'up' : pctImplementados >= 50 ? 'neutral' : 'down'}
        />
        <MetricCard
          label="Promedio Implementación"
          value={avgRate}
          unit="%"
          description="promedio por local"
          trend={avgRate >= 80 ? 'up' : avgRate >= 50 ? 'neutral' : 'down'}
        />
      </div>

      {/* Gráfico de líneas mensual */}
      <MonthlyLineChart data={monthlyData} />

      {/* Top comunas + Distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-secondary)' }}>
            🏆 Top 5 Comunas
          </h3>
          <div className="space-y-3">
            {topComunas.length > 0 ? topComunas.map((c, i) => (
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
            )) : (
              <p className="text-sm text-gray-400">Sin datos de comunas</p>
            )}
          </div>
        </Card>

        <ImplementationDistributionChart
          success={success}
          partial={partial}
          low={low}
          none={none}
        />
      </div>
    </div>
  )
}
