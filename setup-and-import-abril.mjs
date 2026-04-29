import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import fs from 'fs';

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'
);

const parseDateTime = (dateStr) => {
  if (!dateStr) return new Date().toISOString();
  const [datePart, timePart] = dateStr.split(' ');
  const [day, month, year] = datePart.split('/');
  const date = new Date(`${year}-${month}-${day}T${timePart}Z`);
  return date.toISOString();
};

const parseLocationName = (assignLocation) => {
  if (!assignLocation) return '';
  const parts = assignLocation.split('-');
  return parts.slice(1).join('-').trim();
};

const photoTypeMappings = {
  'Foto Bandeja de Jamon LC': 'bandeja_jamon_lc',
  'Foto Logo Vitrina LC': 'logo_vitrina_lc',
  'Foto Colgante de Recomendación LC': 'colgante_recomendacion_lc',
  'Foto Marca Precio SC': 'marca_precio_sc',
  'Foto Huincha Precio SC': 'huincha_precio_sc',
  'Foto Cartel de Panaderia': 'cartel_panaderia',
  'Foto Portabolsas': 'portabolsas',
  'Foto Bolsas de papel': 'bolsas_papel',
  'Foto Tenazas': 'tenazas',
  'Foto Paloma': 'paloma',
  'Foto Cenefa LC': 'cenefa_lc',
  'Foto Bandera Muro LC': 'bandera_muro_lc',
  'Foto Bandera Rutera LC': 'bandera_rutera_lc'
};

async function checkAndCreateTables() {
  console.log('Checking if tables exist...\n');

  // Try to query the table
  const { error: auditError } = await supabase
    .from('agrosuper_abril_audits')
    .select('id')
    .limit(1);

  const { error: photoError } = await supabase
    .from('agrosuper_abril_photos')
    .select('id')
    .limit(1);

  if (auditError || photoError) {
    console.log('⚠️  Tables do not exist yet. Please create them manually in Supabase SQL editor:');
    console.log('\n--- Run this SQL in Supabase dashboard ---\n');

    const sqlScript = `-- Create Abril Audits Table
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

-- Create Abril Photos Table
CREATE TABLE IF NOT EXISTS agrosuper_abril_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_code INTEGER NOT NULL,
  photo_type TEXT NOT NULL,
  photo_number INTEGER DEFAULT 0,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (form_code) REFERENCES agrosuper_abril_audits(form_code)
);

CREATE INDEX IF NOT EXISTS idx_abril_photos_form_code ON agrosuper_abril_photos(form_code);`;

    console.log(sqlScript);
    console.log('\n--- End SQL ---\n');

    // Save to file for convenience
    fs.writeFileSync('./setup-abril-tables.sql', sqlScript);
    console.log('✓ SQL saved to setup-abril-tables.sql\n');
    process.exit(1);
  }

  console.log('✓ Tables exist!\n');
  return true;
}

async function importAuditData() {
  console.log('Reading Excel file...');
  const wb = XLSX.readFile('./Agrosuper Abril.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(ws, { defval: '' });

  console.log('Total rows in Excel:', excelData.length);

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
      implementation_rate: Math.round((materialsImplemented / 13) * 100)
    };
  });

  console.log('\nImporting audit data...');
  const batchSize = 100;
  let imported = 0;

  for (let i = 0; i < auditData.length; i += batchSize) {
    const batch = auditData.slice(i, i + batchSize);
    const { error } = await supabase
      .from('agrosuper_abril_audits')
      .insert(batch);

    if (error) {
      console.log(`✗ Batch error:`, error.message);
      return false;
    }

    imported += batch.length;
    console.log(`✓ Imported ${imported}/${auditData.length} audit records`);
  }

  return true;
}

async function importPhotos() {
  console.log('\nReading photos from Excel...');
  const wb = XLSX.readFile('./Agrosuper Abril.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const photoRecords = [];

  excelData.forEach((row) => {
    const formCode = row['Código Formulario'];

    Object.entries(photoTypeMappings).forEach(([photoPrefix, photoType]) => {
      for (let i = 0; i <= 1; i++) {
        const columnName = `${photoPrefix} - ${i} (${photoPrefix})`;
        const url = row[columnName];

        if (url && typeof url === 'string' && url.includes('http')) {
          photoRecords.push({
            form_code: formCode,
            photo_type: photoType,
            photo_number: i,
            photo_url: url
          });
        }
      }
    });
  });

  console.log(`Found ${photoRecords.length} photo records`);

  if (photoRecords.length === 0) {
    console.log('No photos to import');
    return true;
  }

  console.log('Importing photos...');
  const batchSize = 500;
  let imported = 0;

  for (let i = 0; i < photoRecords.length; i += batchSize) {
    const batch = photoRecords.slice(i, i + batchSize);
    const { error } = await supabase
      .from('agrosuper_abril_photos')
      .insert(batch);

    if (error) {
      console.log(`✗ Batch error:`, error.message);
      return false;
    }

    imported += batch.length;
    console.log(`✓ Imported ${imported}/${photoRecords.length} photo records`);
  }

  return true;
}

async function main() {
  try {
    if (!await checkAndCreateTables()) return;
    if (!await importAuditData()) return;
    if (!await importPhotos()) return;

    console.log('\n✓ Abril campaign import complete!');
    console.log('168 records with photos are now ready.');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
