import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'
);

// Map of photo columns from Excel
const photoMappings = {
  'Toma fotografía de la fachada externa del local': 'fachada_externa',
  'Toma fotografía del KIT de Bienvenida entregado': 'kit_bienvenida',
  'Toma fotografía de Colgantes recomendación La Crianza implementado': 'colgantes_lc',
  'Toma fotografía de Reloj (con pila y clavo) implementado': 'reloj_lc',
  'Toma fotografía de Bandejas jamones La Crianza implementado': 'bandejas_lc',
  'Toma fotografía de Logo La Crianza vitrina implementado': 'logo_lc',
  'Toma fotografía de Cartel La Crianza jamón implementado': 'carteles_lc',
  'Toma fotografía de Afiches Super Cerdo implementado': 'afiches_sc',
  'Toma fotografía de Marcos precio implementado': 'marcos_sc',
  'Toma fotografía de Huinchas precios implementados': 'huinchas_sc',
  'Toma fotografía de Paloma implementada': 'paloma',
  'Toma fotografía de Cartel panadería (con dos cáncamo abierto) implementado': 'cartel_panaderia',
  'Toma fotografía de Porta bolsa + resma implementado': 'portabolsas',
  'Toma fotografía de Tenazas (con cadena cortada, una amarra plastica, apertura de cadena por un lado y un cáncamo cerrado)': 'tenazas'
};

// Convert Excel date to ISO string
const excelDateToISO = (excelDate) => {
  if (typeof excelDate === 'string') {
    if (excelDate.includes('-')) return excelDate;
    excelDate = parseFloat(excelDate);
  }
  if (typeof excelDate !== 'number' || isNaN(excelDate)) {
    return new Date().toISOString();
  }
  const excelEpoch = new Date(1899, 11, 30);
  const date = new Date(excelEpoch.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000);
  return date.toISOString();
};

// Read Excel
const wb = XLSX.readFile('./Rpta fiambres en almacenes.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const excelData = XLSX.utils.sheet_to_json(ws, { defval: '' });

console.log('Total rows in Excel:', excelData.length);

// Prepare update data with photos in JSON format
const updates = excelData.map((row) => {
  const photos = {};

  // Extract photo URLs
  Object.entries(photoMappings).forEach(([excelCol, key]) => {
    const url = row[excelCol];
    if (url && typeof url === 'string' && url.includes('http')) {
      photos[key] = url;
    }
  });

  return {
    location_code: row['assigned_location_code'] ? parseInt(row['assigned_location_code']) : null,
    location_name: row['assigned_location'] || '',
    photos: Object.keys(photos).length > 0 ? photos : null
  };
});

console.log('Sample row with photos:', JSON.stringify(updates[0], null, 2));

// Update records with photos
const batchSize = 500;
let updated = 0;

for (let i = 0; i < updates.length; i += batchSize) {
  const batch = updates.slice(i, i + batchSize);

  for (const item of batch) {
    if (!item.photos) continue;

    const { error } = await supabase
      .from('agrosuper_fiambres_audits')
      .update({ photos: item.photos })
      .eq('location_code', item.location_code);

    if (error) {
      console.log(`Error updating location ${item.location_code}:`, error.message);
    } else {
      updated++;
    }
  }

  console.log(`✓ Updated ${Math.min(updated, (i / batchSize + 1) * batchSize)}/${excelData.length} records`);
}

console.log(`\n✓ Complete! Updated ${updated} records with photos`);
