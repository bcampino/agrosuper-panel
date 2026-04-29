import { MetricCard } from '@/components/agrosuper/metric-card'
import { PanaderiaChart, FachadaChart, ImplementationDistributionChart, AllMaterialsChart } from '@/components/agrosuper/implementation-charts'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const revalidate = 0

const statusBadge = (rate: number) => {
  if (rate >= 80) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>
  if (rate >= 50) return <Badge className="bg-yellow-100 text-yellow-800">Parcial</Badge>
  return <Badge className="bg-red-100 text-red-800">Bajo</Badge>
}

export default async function CampaignPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient()

  // Get campaign
  const { data: campaign, error: campErr } = await supabase
    .from('agrosuper_campaigns')
    .select('id, name, month, column_type')
    .eq('id', params.id)
    .single()

  if (campErr || !campaign) notFound()

  // Get all audits for this campaign's month
  const { data: auditsRaw } = await supabase
    .from('agrosuper_audits')
    .select('*, locations(name, region)')
    .gte('submitted_at', `${campaign.month}-01T00:00:00`)
    .lt('submitted_at', `${campaign.month}-32T00:00:00`)
    .order('submitted_at', { ascending: false })

  const audits = (auditsRaw || []).map((a: any) => ({
    ...a,
    location_name: a.locations?.name ?? 'Sin nombre',
    commune: a.locations?.region ?? '',
  }))

  // Get materials
  const auditIds = audits.map((a: any) => a.id)
  const { data: materialsRaw } = auditIds.length > 0
    ? await supabase.from('agrosuper_materials').select('*').in('audit_id', auditIds)
    : { data: [] }
  const mats = materialsRaw || []

  // Calculate metrics
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
  const partial = audits.filter((a: any) => a.implementation_rate >= 50 && a.implementation_rate < 80).length
  const low = audits.filter((a: any) => a.implementation_rate < 50).length

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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/agrosuper/campaigns" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Campaña — {campaign.month}</p>
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
            {topCommunes.length > 0 ? (
              topCommunes.map((c, i) => (
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
              ))
            ) : (
              <p className="text-sm text-gray-500">Sin datos de comunas</p>
            )}
          </div>
        </Card>

        <ImplementationDistributionChart success={success} partial={partial} low={low} />
      </div>

      {/* Detalle de todas las auditorías */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">📋 Todas las Visitas ({total})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Local</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Comuna</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Implementador</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Fecha</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">%</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {audits.map((audit: any) => (
                <tr key={audit.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-900">{audit.location_name}</td>
                  <td className="px-4 py-3 text-gray-600">{audit.commune || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{audit.implementer_name}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(audit.submitted_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-semibold">{audit.implementation_rate}%</span>
                      {statusBadge(audit.implementation_rate)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
