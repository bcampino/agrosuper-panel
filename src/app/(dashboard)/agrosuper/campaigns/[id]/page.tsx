import { MetricCard } from '@/components/agrosuper/metric-card'
import { PanaderiaChart, FachadaChart, ImplementationDistributionChart, AllMaterialsChart } from '@/components/agrosuper/implementation-charts'
import { AuditsTable } from '@/components/agrosuper/audits-table'
import { AbrilAuditsTable } from '@/components/agrosuper/abril-audits-table'
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

    const fiambresAudits = allFiambresData.map((a: any) => ({
      id: `fiambres-${a.location_code}-${a.date_submitted}`,
      location_code: a.location_code,
      location_name: a.location_name,
      submitted_at: a.date_submitted,
      implementer_name: a.implementer_name,
      colgantes_3_lc: a.colgantes_3_lc,
      reloj_lc: a.reloj_lc,
      bandejas_2_jamon_lc: a.bandejas_2_jamon_lc,
      logo_2_vitrina_lc: a.logo_2_vitrina_lc,
      carteles_4_jamon_lc: a.carteles_4_jamon_lc,
      afiches_2_sc: a.afiches_2_sc,
      marcos_2_precio_sc: a.marcos_2_precio_sc,
      huinchas_2_precio_sc: a.huinchas_2_precio_sc,
    }))
    const audits = fiambresAudits
    const total = audits.length

    // Calculate metrics - all use 1430 as denominator (those who permit POP)
    const popPermit = countSi(audits, 'implementa_pop')
    const opened = (audits || []).filter((r: any) => r.opened?.toLowerCase?.() === 'visitado').length
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

        {/* Detalle de todas las auditorías */}
        <AuditsTable audits={audits} isFiambres={true} />
      </div>
    )
  }

  // Check if this is Abril campaign
  const isAbril = campaign.name.toLowerCase().includes('abril') || campaign.name.toLowerCase().includes('april') || campaign.name.toLowerCase().includes('abr 26')

  if (isAbril) {
    // Load data from abril table
    let allAbrilData: any[] = []
    let offset = 0
    const pageSize = 1000

    while (true) {
      const { data: pageData } = await supabase
        .from('agrosuper_abril_audits')
        .select('*')
        .range(offset, offset + pageSize - 1)
        .order('submitted_at', { ascending: false })

      if (!pageData || pageData.length === 0) break
      allAbrilData = allAbrilData.concat(pageData)
      offset += pageSize
    }

    const total = allAbrilData.length

    // Convert boolean columns → AgrosuperMaterial[] for reuse in charts
    const ABRIL_MATERIAL_MAP: { col: string; key: string; brand: string | null; space: string }[] = [
      { col: 'bandeja_jamon_lc',          key: 'BANDEJA_JAMON_LC',          brand: 'LA_CRIANZA',   space: 'INTERIOR' },
      { col: 'logo_vitrina_lc',           key: 'LOGO_VITRINA_LC',           brand: 'LA_CRIANZA',   space: 'INTERIOR' },
      { col: 'colgante_recomendacion_lc', key: 'COLGANTE_RECOMENDACION_LC', brand: 'LA_CRIANZA',   space: 'INTERIOR' },
      { col: 'marca_precio_sc',           key: 'MARCA_PRECIO_SC',           brand: 'SUPER_CERDO',  space: 'INTERIOR' },
      { col: 'huincha_precio_sc',         key: 'HUINCHA_PRECIO_SC',         brand: 'SUPER_CERDO',  space: 'INTERIOR' },
      { col: 'cartel_panaderia',          key: 'CARTEL_PANADERIA',          brand: null,           space: 'PANADERIA' },
      { col: 'portabolsas',               key: 'PORTABOLSAS',               brand: null,           space: 'PANADERIA' },
      { col: 'bolsas_papel',              key: 'BOLSAS_PAPEL',              brand: null,           space: 'PANADERIA' },
      { col: 'tenazas_2',                 key: 'TENAZAS_2',                 brand: null,           space: 'PANADERIA' },
      { col: 'paloma',                    key: 'PALOMA',                    brand: null,           space: 'FACHADA_EXTERNA' },
      { col: 'cenefa_lc',                 key: 'CENEFA_LC',                 brand: null,           space: 'FACHADA_EXTERNA' },
      { col: 'bandera_muro_lc',           key: 'BANDERA_MURO_LC',           brand: null,           space: 'FACHADA_EXTERNA' },
      { col: 'bandera_rutera_lc',         key: 'BANDERA_RUTERA_LC',         brand: null,           space: 'FACHADA_EXTERNA' },
    ]

    const mats: any[] = []
    for (const row of allAbrilData) {
      for (const m of ABRIL_MATERIAL_MAP) {
        if (row[m.col] !== null && row[m.col] !== undefined) {
          mats.push({ material: m.key, implemented: !!row[m.col], brand: m.brand, space: m.space, id: '', audit_id: '', created_at: '' })
        }
      }
    }

    // KPI metrics
    const implementedCount = allAbrilData.filter((a: any) => (a.implementation_rate ?? 0) > 0).length
    const implementedPct = total > 0 ? Math.round((implementedCount / total) * 100) : 0
    const avgRate = total > 0 ? Math.round(allAbrilData.reduce((s: number, a: any) => s + (a.implementation_rate ?? 0), 0) / total) : 0

    const lcRates = allAbrilData.map((a: any) => {
      const vals = [a.bandeja_jamon_lc, a.logo_vitrina_lc, a.colgante_recomendacion_lc].filter((v: any) => v !== null && v !== undefined)
      return vals.length > 0 ? Math.round((vals.filter(Boolean).length / vals.length) * 100) : 0
    })
    const laCrianza = lcRates.length > 0 ? Math.round(lcRates.reduce((s: number, v: number) => s + v, 0) / lcRates.length) : 0

    const scRates = allAbrilData.map((a: any) => {
      const vals = [a.marca_precio_sc, a.huincha_precio_sc].filter((v: any) => v !== null && v !== undefined)
      return vals.length > 0 ? Math.round((vals.filter(Boolean).length / vals.length) * 100) : 0
    })
    const superCerdo = scRates.length > 0 ? Math.round(scRates.reduce((s: number, v: number) => s + v, 0) / scRates.length) : 0

    const success  = allAbrilData.filter((a: any) => (a.implementation_rate ?? 0) >= 80).length
    const partial  = allAbrilData.filter((a: any) => { const r = a.implementation_rate ?? 0; return r >= 50 && r < 80 }).length
    const low      = allAbrilData.filter((a: any) => { const r = a.implementation_rate ?? 0; return r > 0 && r < 50 }).length
    const none     = allAbrilData.filter((a: any) => (a.implementation_rate ?? 0) === 0).length

    // Top 5 comunas via locations table lookup
    const locationCodes = [...new Set(allAbrilData.map((a: any) => String(a.location_code)).filter(Boolean))]
    const { data: locationsData } = locationCodes.length > 0
      ? await supabase.from('locations').select('external_id, region').in('external_id', locationCodes)
      : { data: [] }
    const locationRegionMap = new Map((locationsData || []).map((l: any) => [l.external_id, l.region]))

    const comunaMap: Record<string, { total: number; sum: number }> = {}
    for (const a of allAbrilData) {
      const region = locationRegionMap.get(String(a.location_code)) || null
      if (!region) continue
      if (!comunaMap[region]) comunaMap[region] = { total: 0, sum: 0 }
      comunaMap[region].total += 1
      comunaMap[region].sum += a.implementation_rate ?? 0
    }
    const topComunas = Object.entries(comunaMap)
      .map(([name, { total, sum }]) => ({ name, total, avg: Math.round(sum / total) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5)

    // Insight: modo de cantidad de POP instalados por local
    const perfectCount = allAbrilData.filter((a: any) => (a.implementation_rate ?? 0) === 100).length
    const popCountHistogram: Record<number, number> = {}
    for (const a of allAbrilData) {
      const count = ABRIL_MATERIAL_MAP.filter(m => a[m.col] === true).length
      popCountHistogram[count] = (popCountHistogram[count] || 0) + 1
    }
    const [modalCount, modalLocales] = Object.entries(popCountHistogram)
      .filter(([count]) => Number(count) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))[0] ?? ['0', 0]
    const insight = `La cantidad de POP más común instalada fue ${modalCount} material${Number(modalCount) !== 1 ? 'es' : ''}, ` +
      `presente en ${modalLocales} local${Number(modalLocales) !== 1 ? 'es' : ''}. ` +
      `${perfectCount} local${perfectCount !== 1 ? 'es' : ''} lograron implementación perfecta (100%).`

    const abrilAudits = allAbrilData.map((a: any) => ({
      id: `abril-${a.form_code}`,
      form_code: a.form_code,
      location_code: a.location_code,
      location_name: a.location_name,
      submitted_at: a.submitted_at,
      implementer_name: a.implementer_name,
      implementation_rate: a.implementation_rate,
      pdf_url: a.pdf_url ?? null,
    }))

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

        {/* Top 5 Comunas + Distribución */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">🏆 Top 5 Comunas</h3>
            <div className="space-y-3">
              {topComunas.length > 0 ? (
                topComunas.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between pb-3 border-b last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{i + 1}. {c.name}</p>
                      <p className="text-xs text-gray-500">{c.total} local{c.total !== 1 ? 'es' : ''}</p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="font-semibold text-lg">{c.avg}%</p>
                      {statusBadge(c.avg)}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">Sin datos de comunas disponibles</p>
              )}
            </div>
          </Card>
          <ImplementationDistributionChart success={success} partial={partial} low={low} none={none} insight={insight} />
        </div>

        {/* Detalle de todas las auditorías */}
        <AbrilAuditsTable audits={abrilAudits} />
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
      <AuditsTable audits={audits} isFiambres={false} />
    </div>
  )
}
