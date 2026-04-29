-- Nueva tabla para scope de locales por campaña
CREATE TABLE IF NOT EXISTS agrosuper_campaign_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES agrosuper_campaigns(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  base_number INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, location_id, base_number)
);

CREATE INDEX IF NOT EXISTS idx_campaign_scopes_campaign_id ON agrosuper_campaign_scopes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_scopes_location_id ON agrosuper_campaign_scopes(location_id);
