const XLSX = require('xlsx');

const files = [
  { path: 'Base locales Plan Verano Agrosuper.xlsx', type: 'base' },
  { path: 'Campaña bandera muro y rutera.xlsx', type: 'campaign' },
  { path: 'Rptas Naipes y Calculadoras.xlsx', type: 'campaign' },
  { path: 'Rpta fiambres en almacenes.xlsx', type: 'campaign' }
];

files.forEach(file => {
  console.log('\n' + '='.repeat(80));
  console.log('📄 ' + file.path + ' (' + file.type + ')');
  console.log('='.repeat(80));

  try {
    const wb = XLSX.readFile('C:/Users/berni/Documentos/Pag Agrosuper/' + file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

    console.log('Sheet: ' + wb.SheetNames[0]);
    console.log('Filas: ' + json.length + ', Columnas: ' + (json[0]?.length || 0));

    // Headers
    const headers = json[0] || [];
    console.log('\nColumnas:');
    headers.forEach((h, i) => {
      if (h) console.log('  ' + (i + 1) + '. ' + h);
    });

    // First 3 data rows
    console.log('\nPrimeras 3 filas:');
    json.slice(1, 4).forEach((row, idx) => {
      const sample = row.slice(0, 10).map(v => String(v || '').substring(0, 25)).join(' | ');
      console.log('  ' + sample);
    });

  } catch (e) {
    console.log('Error: ' + e.message);
  }
});
