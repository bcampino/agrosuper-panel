-- Create Abril Audits Table
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

CREATE INDEX IF NOT EXISTS idx_abril_photos_form_code ON agrosuper_abril_photos(form_code);