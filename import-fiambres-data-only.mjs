import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'
);

// Convert Excel date to ISO string
const excelDateToISO = (excelDate) => {
  if (typeof excelDate === 'string') {
    // Already a string, try to parse
    if (excelDate.includes('-')) return excelDate;
    excelDate = parseFloat(excelDate);
  }
  if (typeof excelDate !== 'number' || isNaN(excelDate)) {
    return new Date().toISOString();
  }
  // Excel epoch is 1899-12-30
  const excelEpoch = new Date(1899, 11, 30);
  const date = new Date(excelEpoch.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000);
  return date.toISOString();
};

// Read Excel
const wb = XLSX.readFile('./Rpta fiambres en almacenes.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const excelData = XLSX.utils.sheet_to_json(ws, { defval: '' });

console.log('Total rows in Excel:', excelData.length);

// Prepare data WITHOUT photos (for now)
const dataToImport = excelData.map((row) => {
  return {
    location_code: row['assigned_location_code'] ? parseInt(row['assigned_location_code']) : null,
    location_name: row['assigned_location'] || '',
    implementer_name: row['Nombre Impl'] || '',
    date_submitted: excelDateToISO(row['Fecha']),
    opened: row['Estatus'] || '',
    kit_bienvenida: row['¿Se entregó KIT de bienvenida?'] || '',
    programa_fidelizacion: row['¿Existe programa de fidelización de clientes?'] || '',
    implementa_pop: row['¿Implementa POP?'] || '',
    pop_basico: row['¿POP básico implementado?'] || '',
    colgantes_3_lc: row['¿3 Colgantes La Crianza implementados?'] || '',
    reloj_lc: row['¿Reloj La Crianza implementado?'] || '',
    bandejas_2_jamon_lc: row['¿2 Bandejas jamones La Crianza implementadas?'] || '',
    logo_2_vitrina_lc: row['¿2 Logo vitrina La Crianza implementados?'] || '',
    carteles_4_jamon_lc: row['¿4 Carteles jamón La Crianza implementados?'] || '',
    afiches_2_sc: row['¿2 Afiches Super Cerdo implementados?'] || '',
    marcos_2_precio_sc: row['¿2 Marcos precio Super Cerdo implementados?'] || '',
    huinchas_2_precio_sc: row['¿2 Huinchas precios implementadas?'] || '',
    zona: row['ZONA'] || ''
  };
});

// Delete existing data
const { error: deleteErr } = await supabase
  .from('agrosuper_fiambres_audits')
  .delete()
  .neq('id', '00000000-0000-0000-0000-000000000000');

if (!deleteErr) {
  console.log('✓ Cleared existing data');
}

// Import in batches
const batchSize = 500;
let imported = 0;

for (let i = 0; i < dataToImport.length; i += batchSize) {
  const batch = dataToImport.slice(i, i + batchSize);
  const { error } = await supabase
    .from('agrosuper_fiambres_audits')
    .insert(batch);

  if (error) {
    console.log(`✗ Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
    break;
  }
  imported += batch.length;
  console.log(`✓ Imported ${imported}/${dataToImport.length} records`);
}

console.log('\n✓ Base data import complete!');
