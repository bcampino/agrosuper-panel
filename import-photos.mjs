import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'
);

// Photo column mappings
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

// Prepare photo records
const photoRecords = excelData
  .map((row) => {
    const photoData = {
      audit_location_code: row['assigned_location_code'] ? parseInt(row['assigned_location_code']) : null
    };

    // Extract photo URLs
    let hasPhotos = false;
    Object.entries(photoMappings).forEach(([excelCol, dbCol]) => {
      const url = row[excelCol];
      if (url && typeof url === 'string' && url.includes('http')) {
        photoData[dbCol] = url;
        hasPhotos = true;
      }
    });

    return hasPhotos ? photoData : null;
  })
  .filter(r => r !== null);

console.log(`Found ${photoRecords.length} records with photos`);

if (photoRecords.length === 0) {
  console.log('No photos to import');
  process.exit(0);
}

// Import in batches
const batchSize = 500;
let imported = 0;

for (let i = 0; i < photoRecords.length; i += batchSize) {
  const batch = photoRecords.slice(i, i + batchSize);

  const { error, data } = await supabase
    .from('agrosuper_fiambres_photos')
    .insert(batch);

  if (error) {
    console.log(`✗ Batch ${Math.floor(i / batchSize) + 1} error:`, error.message);
    break;
  }

  imported += batch.length;
  console.log(`✓ Imported ${imported}/${photoRecords.length} photo records`);
}

console.log('\n✓ Photos import complete!');
