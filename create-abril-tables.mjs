import fetch from 'node-fetch';

const SUPABASE_URL = 'https://gsqmdlirbsthphtakryn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ';

const sqlQueries = [
  `CREATE TABLE IF NOT EXISTS agrosuper_abril_audits (
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
  )`,

  `CREATE TABLE IF NOT EXISTS agrosuper_abril_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_code INTEGER NOT NULL,
    photo_type TEXT NOT NULL,
    photo_number INTEGER DEFAULT 0,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (form_code) REFERENCES agrosuper_abril_audits(form_code)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_abril_photos_form_code ON agrosuper_abril_photos(form_code)`
];

async function createTables() {
  console.log('Creating Abril tables...\n');

  for (let i = 0; i < sqlQueries.length; i++) {
    const query = sqlQueries[i];
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const error = await response.text();
        console.log(`✗ Query ${i + 1} failed:`, error);
        continue;
      }

      console.log(`✓ Query ${i + 1} executed successfully`);
    } catch (error) {
      console.log(`✗ Query ${i + 1} error:`, error.message);
    }
  }

  console.log('\n✓ Table creation complete!');
  console.log('Now run: node import-abril-data.mjs');
}

createTables().catch(console.error);
