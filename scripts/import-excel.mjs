import { readFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const xlsx = require('xlsx')

const EXCEL_PATH = 'C:/Users/berni/Downloads/Agrosuper Abril.xlsx'
const WEBHOOK_URL = 'https://agrosuper-panel.vercel.app/api/webhooks/agrosuper'
const SECRET = 'agrosuper-secret-2026'

const wb = xlsx.readFile(EXCEL_PATH)
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = xlsx.utils.sheet_to_json(ws, { header: 1 })

// foto en cualquiera de las columnas = implementado
const hasPhoto = (...cols) => cols.some(v => v && String(v).startsWith('http'))
const isYes = (v) => v && String(v).trim().toLowerCase() === 'si'

// "06/04/2026 16:47:53" → ISO
const parseDate = (str) => {
  if (!str) return new Date().toISOString()
  const [datePart, timePart = '00:00:00'] = String(str).split(' ')
  const [dd, mm, yyyy] = datePart.split('/')
  return new Date(`${yyyy}-${mm}-${dd}T${timePart}`).toISOString()
}

// Columnas (0-indexed) según el Excel
// 66: Assign ID, 68: Assign Location, 1: Fecha Creación, 2: Código, 9: Nombre implementado
// 17:VendLC 18:StockLC 20:FotoBandeja0 21:FotoBandeja1 23:FotoLogo0 26:FotoColgante0
// 29:VendSC 30:StockSC 32:FotoMarca0  35:FotoHuincha0
// 38:VendPan 40:FotoCartel0 42:FotoPorta0 45:FotoBolsas0 47:FotoTenazas0
// 50:FotoPaloma0 52:FotoCenefa0 56:FotoBanderaMuro0 60:FotoBanderaRutera0

function buildPayload(row) {
  const locationId = String(row[66] || '').trim()
  const assignLocation = String(row[68] || '')
  const locationName = assignLocation.replace(/^\d+-?/, '').trim()

  return {
    location_id: locationId,
    location_name: locationName,
    address: '',
    implementer_name: String(row[9] || row[4] || '').trim(),
    submitted_at: parseDate(row[1]),
    form_number: row[2],
    company: 'Treid SpA',
    phone: '',
    answers: {
      la_crianza: {
        vende:       isYes(row[17]),
        tiene_stock: isYes(row[18]),
        bandeja_jamon_lc:          { implementado: hasPhoto(row[20], row[21]) },
        logo_vitrina_lc:           { implementado: hasPhoto(row[23], row[24]) },
        colgante_recomendacion_lc: { implementado: hasPhoto(row[26], row[27]) },
      },
      super_cerdo: {
        vende:       isYes(row[29]),
        tiene_stock: isYes(row[30]),
        marca_precio_sc:   { implementado: hasPhoto(row[32], row[33]) },
        huincha_precio_sc: { implementado: hasPhoto(row[35], row[36]) },
      },
      pan: {
        vende:            isYes(row[38]),
        cartel_panaderia: { implementado: hasPhoto(row[40]) },
        portabolsas:      { implementado: hasPhoto(row[42], row[43]) },
        bolsas_papel:     { implementado: hasPhoto(row[45]) },
        tenazas_2:        { implementado: hasPhoto(row[47], row[48]) },
      },
      fachada_externa: {
        paloma:            { implementado: hasPhoto(row[50]) },
        cenefa_lc:         { implementado: hasPhoto(row[52], row[53], row[54]) },
        bandera_muro_lc:   { implementado: hasPhoto(row[56], row[57], row[58]) },
        bandera_rutera_lc: { implementado: hasPhoto(row[60], row[61]) },
      },
    },
  }
}

async function importRow(row, index) {
  const payload = buildPayload(row)
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': SECRET },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (json.success) {
    console.log(`✓ [${index}] ${payload.location_name} → ${json.implementation_rate}%`)
  } else {
    console.error(`✗ [${index}] ${payload.location_name}: ${json.error} ${json.details || ''}`)
  }
  return json.success
}

async function main() {
  const dataRows = rows.slice(1).filter(r => r && r[66])
  console.log(`Importando ${dataRows.length} auditorías...`)

  let success = 0, failed = 0
  for (let i = 0; i < dataRows.length; i++) {
    const ok = await importRow(dataRows[i], i + 1)
    ok ? success++ : failed++
    await new Promise(r => setTimeout(r, 150)) // evitar flood
  }

  console.log(`\nResultado: ${success} exitosas, ${failed} fallidas de ${dataRows.length}`)
}

main()
