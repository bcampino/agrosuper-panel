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

const countSi = (data: any[], column: string) => {
  return (data || []).filter((row: any) => row[column]?.toLowerCase?.() === 'si').length
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  // Get campaign
  const { data: campaign, error: campErr } = await supabase
    .from('agrosuper_campaigns')
    .select('id, name, month, column_type')
    .eq('id', id)
    .single()

  if (campErr || !campaign) notFound()

  // Check if this is Fiambres campaign (has fiambres in name or use specific ID)
  const isFiambres = campaign.name.toLowerCase().includes('fiambres')

  if (isFiambres) {
    // Load data from fiambres table with pagination (Supabase has 1000 row limit per query)
    let allFiambresData: any[] = []
    let offset = 0
    const pageSize = 1000

    while (true) {
      const { data: pageData } = await supabase
        .from('agrosuper_fiambres_audits')
        .select('*')
        .range(offset, offset + pageSize - 1)
        .order('date_submitted', { ascending: false })

      if (!pageData || pageData.length === 0) break
      allFiambresData = allFiambresData.concat(pageData)
      offset += pageSize
    }

    const audits = allFiambresData
    const total = audits.length

    // Calculate metrics - all use 1430 as denominator (those who permit POP)
    const popPermit = countSi(audits, 'implementa_pop')
    const opened = (audits || []).filter((r: any) => r.opened?.toLowerCase?.() === 'abierto').length
    const kitBienvenida = countSi(audits, 'kit_bienvenida')
    const programaFidelizacion = countSi(audits, 'programa_fidelizacion')
    const popBasico = countSi(audits, 'pop_basico')

    // Materials
    const colgantes = countSi(audits, 'colgantes_3_lc')
    const reloj = countSi(audits, 'reloj_lc')
    const bandejas = countSi(audits, 'bandejas_2_jamon_lc')
    const logos = countSi(audits, 'logo_2_vitrina_lc')
    const carteles = countSi(audits, 'carteles_4_jamon_lc')
    const afiches = countSi(audits, 'afiches_2_sc')
    const marcos = countSi(audits, 'marcos_2_precio_sc')
    const huinchas = countSi(audits, 'huinchas_2_precio_sc')

    // Denominator: locales that permit POP
    const denominator = popPermit || 1430
    const pct = (count: number) => denominator > 0 ? Math.round((count / denominator) * 100) : 0

    const kitPct = pct(kitBienvenida)
    const fidelizacionPct = pct(programaFidelizacion)
    const popBasicoPct = pct(popBasico)
    const colgantesPct = pct(colgantes)
    const relojPct = pct(reloj)
    const bandejasPct = pct(bandejas)
    const logosPct = pct(logos)
    const cartelesPct = pct(carteles)
    const afichesPct = pct(afiches)
    const marcosPct = pct(marcos)
    const huinchasPct = pct(huinchas)

    // Calculate by zona
    const zonaMap: Record<string, { count: number; implCount: number }> = {}
    audits.forEach((audit: any) => {
      const zone = audit.zona || 'Sin zona'
      if (!zonaMap[zone]) zonaMap[zone] = { count: 0, implCount: 0 }
      zonaMap[zone].count += 1
      const implCount = [
        audit.colgantes_3_lc,
        audit.reloj_lc,
        audit.bandejas_2_jamon_lc,
        audit.logo_2_vitrina_lc,
        audit.carteles_4_jamon_lc,
        audit.afiches_2_sc,
        audit.marcos_2_precio_sc,
        audit.huinchas_2_precio_sc
      ].filter(m => m?.toLowerCase?.() === 'si').length
      if (implCount > 0) zonaMap[zone].implCount += 1
    })

    const zonaStats = Object.entries(zonaMap)
      .map(([name, { count, implCount }]) => ({
        name,
        total: count,
        impl: Math.round((implCount / count) * 100)
      }))
      .sort((a, b) => b.impl - a.impl)

    // Prepare POP data for chart
    const popData = [
      { name: '3 Colgantes', value: colgantesPct },
      { name: 'Reloj', value: relojPct },
      { name: '2 Bandejas', value: bandejasPct },
      { name: '2 Logo', value: logosPct },
      { name: '4 Carteles', value: cartelesPct },
      { name: '2 Afiches', value: afichesPct },
      { name: '2 Marcos', value: marcosPct },
      { name: '2 Huinchas', value: huinchasPct }
    ].sort((a, b) => b.value - a.value)

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

        {/* Total stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-gray-600">Total de Visitas</p>
            <p className="text-3xl font-bold text-blue-900">{total}</p>
          </Card>
          <Card className="p-4 bg-green-50 border-green-200">
            <p className="text-sm text-gray-600">Locales Abiertos</p>
            <p className="text-3xl font-bold text-green-900">{opened}</p>
          </Card>
        </div>

        {/* La Crianza + Super Cerdo side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* La Crianza */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">🏆 La Crianza</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2">
                <p className="text-sm font-medium">3 Colgantes: {colgantesPct}%</p>
                {statusBadge(colgantesPct)}
              </div>
              <div className="flex items-center justify-between pb-2">
                <p className="text-sm font-medium">Reloj: {relojPct}%</p>
                {statusBadge(relojPct)}
              </div>
              <div className="flex items-center justify-between pb-2">
                <p className="text-sm font-medium">2 Bandejas: {bandejasPct}%</p>
                {statusBadge(bandejasPct)}
              </div>
              <div className="flex items-center justify-between pb-2">
                <p className="text-sm font-medium">2 Logo: {logosPct}%</p>
                {statusBadge(logosPct)}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">4 Carteles: {cartelesPct}%</p>
                {statusBadge(cartelesPct)}
              </div>
            </div>
          </Card>

          {/* Super Cerdo */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">🥩 Super Cerdo</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2">
                <p className="text-sm font-medium">2 Afiches: {afichesPct}%</p>
                {statusBadge(afichesPct)}
              </div>
              <div className="flex items-center justify-between pb-2">
                <p className="text-sm font-medium">2 Marcos: {marcosPct}%</p>
                {statusBadge(marcosPct)}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">2 Huinchas: {huinchasPct}%</p>
                {statusBadge(huinchasPct)}
              </div>
            </div>
          </Card>
        </div>

        {/* All POP materials chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">📊 Todos los POP - % Implementación</h3>
          <div className="space-y-2">
            {popData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-32 h-6 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                  <span className="font-semibold text-sm w-12 text-right">{item.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* % Implementación por Zona */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">🗺️ % Implementación por Zona</h3>
          <div className="space-y-3">
            {zonaStats.map((zona) => (
              <div key={zona.name} className="flex items-center justify-between pb-3 border-b last:border-b-0">
                <div className="flex-1">
                  <p className="font-medium text-sm">{zona.name}</p>
                  <p className="text-xs text-gray-500">{zona.total} local{zona.total !== 1 ? 'es' : ''}</p>
                </div>
                <div className="text-right ml-3">
                  <p className="font-semibold text-lg">{zona.impl}%</p>
                  {statusBadge(zona.impl)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  // Original logic for non-Fiambres campaigns
  const [campYear, campMonth] = campaign.month.split('-')
  const campYearNum = Number(campYear)
  const campMonthNum = Number(campMonth)
  const startDateAudit = `${campaign.month}-01T00:00:00`
  const nextMonthNumAudit = campMonthNum === 12 ? 1 : campMonthNum + 1
  const nextYearNumAudit = campMonthNum === 12 ? campYearNum + 1 : campYearNum
  const nextMonthAudit = String(nextMonthNumAudit).padStart(2, '0')
  const endDateAudit = `${nextYearNumAudit}-${nextMonthAudit}-01T00:00:00`

  const { data: auditsRaw } = await supabase
    .from('agrosuper_audits')
    .select('id, location_id, implementer_name, submitted_at, form_number, implementation_rate, metrics_by_brand')
    .gte('submitted_at', startDateAudit)
    .lt('submitted_at', endDateAudit)
    .order('submitted_at', { ascending: false })

  const locationIds = [...new Set((auditsRaw || []).map(a => a.location_id))]
  const { data: locations } = locationIds.length > 0
    ? await supabase
        .from('locations')
        .select('id, name, region')
        .in('id', locationIds)
    : { data: [] }

  const locationMap = new Map((locations || []).map(l => [l.id, l]))

  const audits = (auditsRaw || []).map((a: any) => ({
    ...a,
    location_name: locationMap.get(a.location_id)?.name ?? 'Sin nombre',
    commune: locationMap.get(a.location_id)?.region ?? '',
  }))

  const auditIds = audits.map((a: any) => a.id)
  const { data: materialsRaw } = auditIds.length > 0
    ? await supabase.from('agrosuper_materials').select('*').in('audit_id', auditIds)
    : { data: [] }
  const mats = materialsRaw || []

  const total = audits.length
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
