import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

// Use hardcoded credentials or env vars
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gsqmdlirbsthphtakryn.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY no está configurada')
  console.error('Define la variable de entorno o ejecúta: npm run dev primero')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Configuration ───────────────────────────────────────────────────────────
const baseMaestraPath = './Base locales Plan Verano Agrosuper.xlsx'

const campaigns = [
  {
    path: './Campaña bandera muro y rutera.xlsx',
    name: 'Bandera Muro y Rutera-Ene26',
    type: 'la_crianza',
    sheetIndex: 0,
    idCol: 28, // Assign ID (0-indexed)
    nameCol: 30, // Assign Location
  },
  {
    path: './Rptas Naipes y Calculadoras.xlsx',
    name: 'Naipes y Calculadors Dic25-Ene26',
    type: 'la_crianza',
    sheetIndex: 0,
    idCol: 21, // Assign ID
    nameCol: 23, // Assign Location
  },
  {
    path: './Rpta fiambres en almacenes.xlsx',
    name: 'Fiambres en Almacenes - Dic 25',
    type: 'la_crianza',
    sheetIndex: 0,
    idCol: 8, // assigned_location_code
    nameCol: 7, // assigned_location
  },
]

// ── Load master base ────────────────────────────────────────────────────────
console.log('📖 Cargando base maestra de locales...')
const wbMaestra = XLSX.readFile(baseMaestraPath)
const wsMaestra = wbMaestra.Sheets[wbMaestra.SheetNames[0]]
const masterData = XLSX.utils.sheet_to_json(wsMaestra, { header: 1 })

// Crear mapa: codigo -> {nombre, dirección, ciudad}
const masterMap = new Map()
masterData.slice(1).forEach(row => {
  const codigo = String(row[0] || '').trim()
  if (codigo) {
    masterMap.set(codigo, {
      nombre: String(row[2] || '').trim(), // NOMBRE (col 3)
      direccion: String(row[3] || '').trim(), // Dirección (col 4)
      ciudad: String(row[4] || '').trim(), // Ciudad (col 5)
      region: String(row[5] || '').trim(), // Region (col 6)
    })
  }
})
console.log(`✅ Base maestra cargada: ${masterMap.size} locales\n`)

// ── Process each campaign ───────────────────────────────────────────────────
for (const campaign of campaigns) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`📊 Campaña: ${campaign.name}`)
  console.log('='.repeat(70))

  // Read campaign file
  const wb = XLSX.readFile(campaign.path)
  const ws = wb.Sheets[wb.SheetNames[campaign.sheetIndex]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

  // Extract unique locations
  const locationsMap = new Map()
  rows.slice(1).forEach(row => {
    const id = String(row[campaign.idCol] || '').trim()
    const nameRaw = String(row[campaign.nameCol] || '').trim()

    if (!id || !nameRaw) return

    // Parse name: "3200243629-Inversiones Au" -> code, name
    const [codeFromName, nameFromDescr] = nameRaw.includes('-')
      ? nameRaw.split('-').map(s => s.trim())
      : [id, nameRaw]

    // Try to enrich with master base
    const masterInfo = masterMap.get(id) || masterMap.get(codeFromName)
    const location = {
      external_id: id,
      name: masterInfo?.nombre || nameFromDescr || nameRaw,
      address: masterInfo?.direccion || undefined,
      region: masterInfo?.ciudad || masterInfo?.region || undefined,
    }

    locationsMap.set(id, location)
  })

  console.log(`Locales extraídos: ${locationsMap.size}`)

  // ── Create campaign ────────────────────────────────────────────────────
  console.log(`Creando campaña: ${campaign.name}...`)
  const { data: createdCampaign, error: campErr } = await supabase
    .from('agrosuper_campaigns')
    .insert({
      name: campaign.name,
      column_type: campaign.type,
      month: new Date().toISOString().slice(0, 7), // Current month (adjust if needed)
    })
    .select('id')
    .single()

  if (campErr) {
    console.error('❌ Error creando campaña:', campErr.message)
    continue
  }
  const campaignId = createdCampaign.id
  console.log(`✅ Campaña creada: ${campaignId}`)

  // ── Upsert locations ───────────────────────────────────────────────────
  console.log('Guardando locales...')
  const locUpserts = Array.from(locationsMap.values())
  const { error: locErr } = await supabase.from('locations').upsert(locUpserts, { onConflict: 'external_id' })

  if (locErr) {
    console.error('❌ Error guardando locales:', locErr.message)
    continue
  }
  console.log(`✅ ${locationsMap.size} locales guardados`)

  // ── Get location IDs ──────────────────────────────────────────────────
  const { data: locations } = await supabase
    .from('locations')
    .select('id, external_id')
    .in('external_id', Array.from(locationsMap.keys()))

  const locMap = new Map((locations || []).map(l => [l.external_id, l.id]))

  // ── Import scopes ────────────────────────────────────────────────────
  console.log('Importando scope de campaña...')
  const scopeInserts = Array.from(locationsMap.keys())
    .map(extId => ({
      campaign_id: campaignId,
      location_id: locMap.get(extId),
      base_number: 1,
    }))
    .filter(s => s.location_id)

  const { error: scopeErr } = await supabase
    .from('agrosuper_campaign_scopes')
    .upsert(scopeInserts, { onConflict: 'campaign_id,location_id,base_number' })

  if (scopeErr) {
    console.error('❌ Error importando scope:', scopeErr.message)
    continue
  }
  console.log(`✅ Scope importado: ${scopeInserts.length} locales`)
}

console.log('\n' + '='.repeat(70))
console.log('✨ ¡Campañas creadas exitosamente!')
console.log('='.repeat(70))
