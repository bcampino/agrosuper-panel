import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Configuration ───────────────────────────────────────────────────────
const campaigns = [
  {
    path: './Campaña bandera muro y rutera.xlsx',
    campaignName: 'Bandera Muro y Rutera-Ene26',
    idCol: 28,
    nameCol: 30,
  },
  {
    path: './Rptas Naipes y Calculadoras.xlsx',
    campaignName: 'Naipes y Calculadors Dic25-Ene26',
    idCol: 21,
    nameCol: 23,
  },
  {
    path: './Rpta fiambres en almacenes.xlsx',
    campaignName: 'Fiambres en Almacenes - Dic 25',
    idCol: 8,
    nameCol: 7,
  },
]

// ── Helpers ───────────────────────────────────────────────────────────
function isYes(v) {
  return v != null && String(v).trim().toLowerCase() === 'si'
}

function hasPhoto(v) {
  return v != null && String(v).startsWith('http')
}

function parseDate(v) {
  if (!v) return new Date().toISOString()
  const s = String(v).trim()

  // Handle Excel numeric date format (days since 1900)
  if (!isNaN(v) && Number(v) > 30000 && Number(v) < 50000) {
    const excelDate = Number(v)
    const date = new Date((excelDate - 25569) * 86400 * 1000)
    return date.toISOString()
  }

  if (s.includes('/')) {
    const match = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (match) {
      const [, dd, mm, yyyy] = match
      return new Date(`${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`).toISOString()
    }
  }
  if (s.includes('-') && /^\d{2}-\d{2}-\d{4}/.test(s)) {
    const [dd, mm, yyyy] = s.split('-')
    return new Date(`${yyyy}-${mm}-${dd}`).toISOString()
  }
  try {
    return new Date(s).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

// ── Process Campaign ────────────────────────────────────────────────────
async function processCampaign(config) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`📊 Campaña: ${config.campaignName}`)
  console.log('='.repeat(70))

  // Get campaign ID
  const { data: campaign, error: campErr } = await supabase
    .from('agrosuper_campaigns')
    .select('id')
    .eq('name', config.campaignName)
    .single()

  if (campErr || !campaign) {
    console.error(`❌ Campaña no encontrada: ${config.campaignName}`)
    return
  }

  console.log(`Campaign ID: ${campaign.id}`)

  // Read Excel
  const wb = XLSX.readFile(config.path)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })

  console.log(`Filas leídas: ${rows.length}`)

  // Parse audits
  const audits = []
  const dataRows = rows.slice(1)

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const locationId = String(row[config.idCol] || '').trim()
    const locationName = String(row[config.nameCol] || '').trim()

    if (!locationId || !locationName) continue

    const audit = {
      location_id: locationId,
      location_name: locationName,
      submitted_at: parseDate(row[0]),
      form_number: i + 1,
      implementer_name: String(row[5] || row[4] || 'Auditor').trim(),
      answers: {},
    }

    // Extract answers from row (all columns that have yes/no or photos)
    for (let j = 0; j < row.length; j++) {
      const header = String(rows[0][j] || '').toLowerCase()

      // Skip non-answer columns
      if (!header.includes('se') && !header.includes('¿')) continue

      const value = row[j]

      // Check if it's a yes/no answer or photo
      if (isYes(value) || hasPhoto(value)) {
        const key = header.substring(0, 30).replace(/[^a-z0-9]/g, '_')
        audit.answers[key] = {
          implementado: isYes(value) || hasPhoto(value),
          ...(hasPhoto(value) && { foto: String(value) }),
        }
      }
    }

    audits.push(audit)
  }

  console.log(`Auditorías parseadas: ${audits.length}`)

  // Upsert locations
  const uniqueLocs = [...new Map(audits.map(a => [a.location_id, { external_id: a.location_id, name: a.location_name }])).values()]

  const { error: locErr } = await supabase.from('locations').upsert(uniqueLocs, { onConflict: 'external_id' })
  if (locErr) {
    console.error('❌ Error guardando locales:', locErr.message)
    return
  }
  console.log(`✅ ${uniqueLocs.length} locales guardados`)

  // Get location IDs (in batches to avoid limits)
  const locMap = new Map()
  const locIds = uniqueLocs.map(l => l.external_id)
  const batchSize = 500

  for (let i = 0; i < locIds.length; i += batchSize) {
    const batch = locIds.slice(i, i + batchSize)
    const { data: locations } = await supabase
      .from('locations')
      .select('id, external_id')
      .in('external_id', batch)

    for (const loc of (locations || [])) {
      locMap.set(loc.external_id, loc.id)
    }
  }

  // Build audit inserts
  const auditInserts = []
  let skipped = 0

  for (const audit of audits) {
    const locationId = locMap.get(audit.location_id)
    if (!locationId) {
      skipped++
      continue
    }

    const implementados = Object.values(audit.answers).filter(a => a?.implementado).length
    const total = Object.keys(audit.answers).length
    const implementationRate = total > 0 ? Math.round((implementados / total) * 100) : 0

    auditInserts.push({
      location_id: locationId,
      implementer_name: audit.implementer_name,
      submitted_at: audit.submitted_at,
      form_number: audit.form_number,
      company: 'Treid SpA',
      status: 'calculated',
      implementation_rate: implementationRate,
      raw_payload: audit,
    })
  }

  console.log(`Auditorías a insertar: ${auditInserts.length}, omitidas: ${skipped}`)

  // Insert audits
  const { data: inserted, error: auditErr } = await supabase
    .from('agrosuper_audits')
    .insert(auditInserts)
    .select('id')

  if (auditErr) {
    console.error('❌ Error guardando auditorías:', auditErr.message)
    return
  }
  console.log(`✅ ${inserted?.length || 0} auditorías insertadas`)

  // Insert materials
  const allMats = []
  for (let i = 0; i < (inserted || []).length; i++) {
    const audit = audits[i]
    for (const [material, answer] of Object.entries(audit.answers)) {
      if (answer?.implementado !== undefined) {
        allMats.push({
          audit_id: inserted[i].id,
          material: material.toUpperCase(),
          implemented: answer.implementado,
        })
      }
    }
  }

  for (let i = 0; i < allMats.length; i += 500) {
    const { error: mErr } = await supabase.from('agrosuper_materials').insert(allMats.slice(i, i + 500))
    if (mErr) {
      console.error('❌ Error guardando materiales:', mErr.message)
      return
    }
  }
  console.log(`✅ ${allMats.length} materiales insertados`)
}

// ── Main ────────────────────────────────────────────────────────────
console.log('🚀 Importando resultados de campañas...\n')

for (const config of campaigns) {
  await processCampaign(config)
}

console.log('\n' + '='.repeat(70))
console.log('✨ ¡Importación completada!')
console.log('='.repeat(70))
