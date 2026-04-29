import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'
);

// Map of photo column prefixes to photo types
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

// Read Excel
const wb = XLSX.readFile('./Agrosuper Abril.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const excelData = XLSX.utils.sheet_to_json(ws, { defval: '' });

console.log('Total rows in Excel:', excelData.length);

// Prepare photo records
const photoRecords = [];

excelData.forEach((row) => {
  const formCode = row['Código Formulario'];

  Object.entries(photoTypeMappings).forEach(([photoPrefix, photoType]) => {
    // Check for - 0 and - 1 variants
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

console.log(`Found ${photoRecords.length} photo records with URLs`);

if (photoRecords.length === 0) {
  console.log('No photos to import');
  process.exit(0);
}

console.log('\nSample photo record:');
console.log(JSON.stringify(photoRecords[0], null, 2));

// Import in batches
const batchSize = 500;
let imported = 0;

for (let i = 0; i < photoRecords.length; i += batchSize) {
  const batch = photoRecords.slice(i, i + batchSize);

  const { error } = await supabase
    .from('agrosuper_abril_photos')
    .insert(batch);

  if (error) {
    console.log(`✗ Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('\n⚠️  Table does not exist. Please create it using this SQL:');
      console.log(`
CREATE TABLE IF NOT EXISTS agrosuper_abril_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_code INTEGER NOT NULL,
  photo_type TEXT NOT NULL,
  photo_number INTEGER DEFAULT 0,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (form_code) REFERENCES agrosuper_abril_audits(form_code)
);
      `);
    }
    process.exit(1);
  }

  imported += batch.length;
  console.log(`✓ Imported ${imported}/${photoRecords.length} photo records`);
}

console.log('\n✓ Photos import complete!');
