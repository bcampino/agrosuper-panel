import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'
);

const parseDateTime = (dateStr) => {
  if (!dateStr) return new Date().toISOString();
  // Format: "06/04/2026 16:47:53"
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/');
  const date = new Date(`${year}-${month}-${day}T${timePart}Z`);
  return date.toISOString();
};

const parseLocationName = (assignLocation) => {
  // Format: "3200126217-Sanchez Gutierrez Cirilo Gabriel"
  if (!assignLocation) return '';
  const parts = assignLocation.split('-');
  return parts.slice(1).join('-').trim();
};

// Read Excel
const wb = XLSX.readFile('./Agrosuper Abril.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const excelData = XLSX.utils.sheet_to_json(ws, { defval: '' });

console.log('Total rows in Excel:', excelData.length);

// Prepare audit data
const auditData = excelData.map((row) => {
  const materialsImplemented = [
    row['Implementaste Bandeja de Jamon LC'] === 'Si' ? 1 : 0,
    row['Implementaste Logo Vitrina LC'] === 'Si' ? 1 : 0,
    row['Implementaste Colgante de Recomendación LC'] === 'Si' ? 1 : 0,
    row['Implementaste Marca Precio SC'] === 'Si' ? 1 : 0,
    row['Implementaste Huincha Precio SC'] === 'Si' ? 1 : 0,
    row['Implementaste Cartel de Panaderia'] === 'Si' ? 1 : 0,
    row['Instalaste Portabolsas'] === 'Si' ? 1 : 0,
    row['Implementaste Bolsas de papel'] === 'Si' ? 1 : 0,
    row['Entregaste 2 Tenazas'] === 'Si' ? 1 : 0,
    row['Implementaste Paloma'] === 'Si' ? 1 : 0,
    row['Implementaste Cenefa LC'] === 'Si' ? 1 : 0,
    row['Implementaste Bandera Muro LC'] === 'Si' ? 1 : 0,
    row['Implementaste Bandera Rutera LC'] === 'Si' ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  const implementationRate = Math.round((materialsImplemented / 13) * 100);

  return {
    form_code: row['Código Formulario'],
    location_code: row['Assign ID'] ? parseInt(row['Assign ID']) : null,
    location_name: parseLocationName(row['Assign Location']),
    implementer_name: row['Nombre implementador'] || row['Nombre implementado'] || '',
    submitted_at: parseDateTime(row['Fecha']),
    local_status: row['Local se encuentra'] || '',

    vende_la_crianza: row['Vende productos La Crianza'] === 'Si',
    tiene_stock_la_crianza: row['Tiene Stock de productos La Crianza'] === 'Si',
    bandeja_jamon_lc: row['Implementaste Bandeja de Jamon LC'] === 'Si',
    logo_vitrina_lc: row['Implementaste Logo Vitrina LC'] === 'Si',
    colgante_recomendacion_lc: row['Implementaste Colgante de Recomendación LC'] === 'Si',

    vende_super_cerdo: row['Vende Productos Super Cerdo'] === 'Si',
    tiene_stock_super_cerdo: row['Tiene Stock de productos Super Cerdo'] === 'Si',
    marca_precio_sc: row['Implementaste Marca Precio SC'] === 'Si',
    huincha_precio_sc: row['Implementaste Huincha Precio SC'] === 'Si',

    vende_pan: row['Vende Pan'] === 'Si',
    cartel_panaderia: row['Implementaste Cartel de Panaderia'] === 'Si',
    portabolsas: row['Instalaste Portabolsas'] === 'Si',
    bolsas_papel: row['Implementaste Bolsas de papel'] === 'Si',
    tenazas_2: row['Entregaste 2 Tenazas'] === 'Si',

    paloma: row['Implementaste Paloma'] === 'Si',
    cenefa_lc: row['Implementaste Cenefa LC'] === 'Si',
    bandera_muro_lc: row['Implementaste Bandera Muro LC'] === 'Si',
    bandera_rutera_lc: row['Implementaste Bandera Rutera LC'] === 'Si',

    implementation_rate: implementationRate
  };
});

console.log('\nSample audit record:');
console.log(JSON.stringify(auditData[0], null, 2));

// Import in batches
const batchSize = 100;
let imported = 0;

for (let i = 0; i < auditData.length; i += batchSize) {
  const batch = auditData.slice(i, i + batchSize);

  const { error } = await supabase
    .from('agrosuper_abril_audits')
    .insert(batch);

  if (error) {
    console.log(`✗ Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('\n⚠️  Table does not exist. Please create it using this SQL:');
      console.log(`
CREATE TABLE IF NOT EXISTS agrosuper_abril_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_code INTEGER NOT NULL UNIQUE,
  location_code BIGINT,
  location_name TEXT,
  implementer_name TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  local_status TEXT,
  vende_la_crianza BOOLEAN,
  tiene_stock_la_crianza BOOLEAN,
  bandeja_jamon_lc BOOLEAN,
  logo_vitrina_lc BOOLEAN,
  colgante_recomendacion_lc BOOLEAN,
  vende_super_cerdo BOOLEAN,
  tiene_stock_super_cerdo BOOLEAN,
  marca_precio_sc BOOLEAN,
  huincha_precio_sc BOOLEAN,
  vende_pan BOOLEAN,
  cartel_panaderia BOOLEAN,
  portabolsas BOOLEAN,
  bolsas_papel BOOLEAN,
  tenazas_2 BOOLEAN,
  paloma BOOLEAN,
  cenefa_lc BOOLEAN,
  bandera_muro_lc BOOLEAN,
  bandera_rutera_lc BOOLEAN,
  implementation_rate INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
      `);
    }
    process.exit(1);
  }

  imported += batch.length;
  console.log(`✓ Imported ${imported}/${auditData.length} audit records`);
}

console.log('\n✓ Audit data import complete!');
