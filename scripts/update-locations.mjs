import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const xlsx = require('xlsx')

const SUPABASE_URL = 'https://gsqmdlirbsthphtakryn.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'

const wb = xlsx.readFile('C:/Users/berni/Downloads/ESTATUS IMPLEMENTACIÓN LC RM.xlsx')
const ws = wb.Sheets[wb.SheetNames[wb.SheetNames.length - 1]] // "Base Agrosuper"
const rows = xlsx.utils.sheet_to_json(ws, { header: 1 })

// Row 0 = weird header, Row 1 = real headers, Row 2+ = data
const dataRows = rows.slice(2).filter(r => r && r[1])

// cols: 1=CÓD.CLIENTE, 3=CLIENTE, 6=DIRECCIÓN, 7=COMUNA
const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }

async function updateLocation(externalId, address, commune) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/locations?external_id=eq.${externalId}`,
    { method: 'PATCH', headers, body: JSON.stringify({ address, region: commune }) }
  )
  return res.status
}

async function main() {
  console.log(`Actualizando ${dataRows.length} ubicaciones...`)
  let updated = 0, skipped = 0

  for (const row of dataRows) {
    const externalId = String(row[1]).trim()
    const address    = String(row[6] || '').trim()
    const commune    = String(row[7] || '').trim()

    if (!externalId) { skipped++; continue }

    const status = await updateLocation(externalId, address, commune)
    if (status === 204) {
      updated++
      console.log(`✓ ${externalId} → ${commune} | ${address}`)
    } else {
      skipped++
      console.log(`- ${externalId} no encontrado (no auditado en Abril)`)
    }
  }

  console.log(`\nResultado: ${updated} actualizadas, ${skipped} sin match`)
}

main()
