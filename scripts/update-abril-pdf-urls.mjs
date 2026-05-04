/**
 * Lee PDF visitas abril.xlsx y actualiza pdf_url en agrosuper_abril_audits
 * La columna pdf_url debe existir antes de correr este script.
 *
 * SQL previo (ejecutar en Supabase Dashboard):
 *   ALTER TABLE agrosuper_abril_audits ADD COLUMN IF NOT EXISTS pdf_url TEXT;
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/update-abril-pdf-urls.mjs
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const xlsx = require('xlsx')
import { createClient } from '@supabase/supabase-js'

const EXCEL_PATH = 'C:/Users/berni/Documentos/Pag Agrosuper/PDF visitas abril.xlsx'
const SUPABASE_URL = 'https://gsqmdlirbsthphtakryn.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_KEY) {
  console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function main() {
  // Leer Excel
  const wb = xlsx.readFile(EXCEL_PATH)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(ws)

  console.log(`📄 Excel cargado: ${rows.length} filas`)
  console.log(`   Columnas: ${Object.keys(rows[0]).join(', ')}`)

  // Verificar estructura esperada
  const firstRow = rows[0]
  if (!('CODE' in firstRow) || !('URL' in firstRow)) {
    console.error('❌ El Excel no tiene las columnas CODE y URL esperadas.')
    console.error('   Columnas encontradas:', Object.keys(firstRow))
    process.exit(1)
  }

  console.log(`\n🔗 Actualizando pdf_url en agrosuper_abril_audits...`)

  let updated = 0
  let notFound = 0
  let errors = 0

  for (const row of rows) {
    const formCode = Number(row['CODE'])
    const pdfUrl = String(row['URL'] || '').trim()

    if (!formCode || !pdfUrl) {
      console.warn(`⚠️  Fila inválida: CODE=${row['CODE']} URL=${row['URL']}`)
      continue
    }

    const { error } = await supabase
      .from('agrosuper_abril_audits')
      .update({ pdf_url: pdfUrl })
      .eq('form_code', formCode)

    if (error) {
      console.error(`✗ [${formCode}] Error: ${error.message}`)
      errors++
    } else {
      console.log(`✓ [${formCode}] PDF linkeado`)
      updated++
    }
  }

  console.log(`\n═══════════════════════════════`)
  console.log(`✅ Actualizados: ${updated}`)
  console.log(`⚠️  No encontrados: ${notFound}`)
  console.log(`❌ Errores: ${errors}`)
  console.log(`═══════════════════════════════`)
}

main().catch(console.error)
