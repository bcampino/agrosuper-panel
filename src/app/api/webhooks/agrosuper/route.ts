import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  // Validar secret
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.AGROSUPER_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json()
  const supabase = createAdminClient()

  const {
    location_id: externalId,
    location_name,
    address,
    implementer_name,
    submitted_at,
    form_number,
    company,
    phone,
    pdf_url,
    answers = {},
  } = payload

  // 1. Crear o encontrar location
  let locationId: string
  const { data: existingLocation } = await supabase
    .from('locations')
    .select('id')
    .eq('external_id', externalId)
    .single()

  if (existingLocation) {
    locationId = existingLocation.id
  } else {
    const { data: newLocation, error: locationError } = await supabase
      .from('locations')
      .insert({ external_id: externalId, name: location_name, address })
      .select('id')
      .single()

    if (locationError) {
      return NextResponse.json({ error: 'Error creating location', details: locationError.message }, { status: 500 })
    }
    locationId = newLocation.id
  }

  // 2. Calcular métricas
  const materials: { brand: string | null; space: string; material: string; implemented: boolean; vende?: boolean; tiene_stock?: boolean }[] = []

  const lc = answers.la_crianza || {}
  if (lc.bandeja_jamon_lc)        materials.push({ brand: 'LA_CRIANZA', space: 'INTERIOR', material: 'BANDEJA_JAMON_LC',        implemented: !!lc.bandeja_jamon_lc.implementado,        vende: !!lc.vende, tiene_stock: !!lc.tiene_stock })
  if (lc.logo_vitrina_lc)         materials.push({ brand: 'LA_CRIANZA', space: 'INTERIOR', material: 'LOGO_VITRINA_LC',         implemented: !!lc.logo_vitrina_lc.implementado,         vende: !!lc.vende, tiene_stock: !!lc.tiene_stock })
  if (lc.colgante_recomendacion_lc) materials.push({ brand: 'LA_CRIANZA', space: 'INTERIOR', material: 'COLGANTE_RECOMENDACION_LC', implemented: !!lc.colgante_recomendacion_lc.implementado, vende: !!lc.vende, tiene_stock: !!lc.tiene_stock })

  const sc = answers.super_cerdo || {}
  if (sc.marca_precio_sc)  materials.push({ brand: 'SUPER_CERDO', space: 'INTERIOR', material: 'MARCA_PRECIO_SC',  implemented: !!sc.marca_precio_sc.implementado,  vende: !!sc.vende, tiene_stock: !!sc.tiene_stock })
  if (sc.huincha_precio_sc) materials.push({ brand: 'SUPER_CERDO', space: 'INTERIOR', material: 'HUINCHA_PRECIO_SC', implemented: !!sc.huincha_precio_sc.implementado, vende: !!sc.vende, tiene_stock: !!sc.tiene_stock })

  const pan = answers.pan || {}
  if (pan.cartel_panaderia) materials.push({ brand: null, space: 'PANADERIA', material: 'CARTEL_PANADERIA', implemented: !!pan.cartel_panaderia.implementado, vende: !!pan.vende })
  if (pan.portabolsas)      materials.push({ brand: null, space: 'PANADERIA', material: 'PORTABOLSAS',      implemented: !!pan.portabolsas.implementado,      vende: !!pan.vende })
  if (pan.bolsas_papel)     materials.push({ brand: null, space: 'PANADERIA', material: 'BOLSAS_PAPEL',     implemented: !!pan.bolsas_papel.implementado,     vende: !!pan.vende })
  if (pan.tenazas_2)        materials.push({ brand: null, space: 'PANADERIA', material: 'TENAZAS_2',        implemented: !!pan.tenazas_2.implementado,        vende: !!pan.vende })

  const fe = answers.fachada_externa || {}
  if (fe.paloma)           materials.push({ brand: null, space: 'FACHADA_EXTERNA', material: 'PALOMA',           implemented: !!fe.paloma.implementado })
  if (fe.cenefa_lc)        materials.push({ brand: null, space: 'FACHADA_EXTERNA', material: 'CENEFA_LC',        implemented: !!fe.cenefa_lc.implementado })
  if (fe.bandera_muro_lc)  materials.push({ brand: null, space: 'FACHADA_EXTERNA', material: 'BANDERA_MURO_LC',  implemented: !!fe.bandera_muro_lc.implementado })
  if (fe.bandera_rutera_lc) materials.push({ brand: null, space: 'FACHADA_EXTERNA', material: 'BANDERA_RUTERA_LC', implemented: !!fe.bandera_rutera_lc.implementado })

  const total = materials.length
  const implemented = materials.filter(m => m.implemented).length
  const implementationRate = total > 0 ? Math.round((implemented / total) * 100) : 0

  const lcMaterials = materials.filter(m => m.brand === 'LA_CRIANZA')
  const scMaterials = materials.filter(m => m.brand === 'SUPER_CERDO')
  const panMaterials = materials.filter(m => m.space === 'PANADERIA')
  const feMaterials = materials.filter(m => m.space === 'FACHADA_EXTERNA')

  const pct = (arr: typeof materials) => arr.length > 0 ? Math.round((arr.filter(m => m.implemented).length / arr.length) * 100) : 0

  const metricsByBrand = { la_crianza: pct(lcMaterials), super_cerdo: pct(scMaterials) }
  const metricsBySpace = { panaderia: pct(panMaterials), fachada_externa: pct(feMaterials) }

  // 3. Crear auditoría
  const { data: audit, error: auditError } = await supabase
    .from('agrosuper_audits')
    .insert({
      location_id: locationId,
      implementer_name,
      submitted_at,
      form_number,
      company,
      phone,
      pdf_url,
      status: 'calculated',
      implementation_rate: implementationRate,
      metrics_by_brand: metricsByBrand,
      metrics_by_space: metricsBySpace,
      raw_payload: payload,
    })
    .select('id')
    .single()

  if (auditError) {
    return NextResponse.json({ error: 'Error creating audit', details: auditError.message }, { status: 500 })
  }

  // 4. Guardar materiales
  if (materials.length > 0) {
    const { error: materialsError } = await supabase
      .from('agrosuper_materials')
      .insert(materials.map(m => ({ ...m, audit_id: audit.id })))

    if (materialsError) {
      return NextResponse.json({ error: 'Error saving materials', details: materialsError.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    success: true,
    audit_id: audit.id,
    implementation_rate: implementationRate,
    metrics_by_brand: metricsByBrand,
    metrics_by_space: metricsBySpace,
  })
}
