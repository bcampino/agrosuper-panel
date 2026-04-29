import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'
);

// Map of photo columns from Excel
const photoMappings = {
  'Toma fotografía de la fachada externa del local': 'foto_fachada_externa',
  'Toma fotografía del KIT de Bienvenida entregado': 'foto_kit_bienvenida',
  'Toma fotografía de Colgantes recomendación La Crianza implementado': 'foto_colgantes_lc',
  'Toma fotografía de Reloj (con pila y clavo) implementado': 'foto_reloj_lc',
  'Toma fotografía de Bandejas jamones La Crianza implementado': 'foto_bandejas_lc',
  'Toma fotografía de Logo La Crianza vitrina implementado': 'foto_logo_lc',
  'Toma fotografía de Cartel La Crianza jamón implementado': 'foto_carteles_lc',
  'Toma fotografía de Afiches Super Cerdo implementado': 'foto_afiches_sc',
  'Toma fotografía de Marcos precio implementado': 'foto_marcos_sc',
  'Toma fotografía de Huinchas precios implementados': 'foto_huinchas_sc',
  'Toma fotografía de Paloma implementada': 'foto_paloma',
  'Toma fotografía de Cartel panadería (con dos cáncamo abierto) implementado': 'foto_cartel_panaderia',
  'Toma fotografía de Porta bolsa + resma implementado': 'foto_portabolsas',
  'Toma fotografía de Tenazas (con cadena cortada, una amarra plastica, apertura de cadena por un lado y un cáncamo cerrado)': 'foto_tenazas'
};

// Read Excel
const wb = XLSX.readFile('./Rpta fiambres en almacenes.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const excelData = XLSX.utils.sheet_to_json(ws, { defval: '' });

console.log('Total rows in Excel:', excelData.length);

// Prepare data with correct column mappings
const dataToImport = excelData.map((row) => {
  const auditData = {
    location_code: row['assigned_location_code'] ? parseInt(row['assigned_location_code']) : null,
    location_name: row['assigned_location'] || '',
    implementer_name: row['Nombre Impl'] || '',
    date_submitted: row['Fecha'] || new Date().toISOString(),
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

  // Add photo URLs
  Object.entries(photoMappings).forEach(([excelCol, dbCol]) => {
    auditData[dbCol] = row[excelCol] || '';
  });

  return auditData;
});

console.log('Sample row:', JSON.stringify(dataToImport[0], null, 2));

// Delete existing data
const { error: deleteErr } = await supabase
  .from('agrosuper_fiambres_audits')
  .delete()
  .neq('id', '00000000-0000-0000-0000-000000000000');

if (!deleteErr) {
  console.log('Cleared existing data');
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
    console.log(`Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
    break;
  }
  imported += batch.length;
  console.log(`✓ Imported ${imported}/${dataToImport.length} records`);
}

console.log('✓ Import complete!');
