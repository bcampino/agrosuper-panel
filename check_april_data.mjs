import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'
)

// Get April campaign
const { data: aprilCampaign } = await supabase
  .from('agrosuper_campaigns')
  .select('id, name, month')
  .eq('name', 'Implementación POP RM — Abr 26')
  .single()

console.log('April Campaign:', aprilCampaign)

// Get scope for April campaign
const { data: scopeCount } = await supabase
  .from('agrosuper_campaign_scopes')
  .select('campaign_id, location_id', { count: 'exact' })
  .eq('campaign_id', aprilCampaign.id)

console.log(`\nScope locations for April campaign: ${scopeCount.length}`)

// Get audits for April
const { data: aprilAudits } = await supabase
  .from('agrosuper_audits')
  .select('id, location_id, submitted_at, implementation_rate', { count: 'exact' })
  .gte('submitted_at', '2026-04-01T00:00:00')
  .lt('submitted_at', '2026-05-01T00:00:00')
  .limit(5)

console.log(`\nAudits in April 2026: ${aprilAudits.length}`)
aprilAudits?.forEach(a => {
  console.log(`- Location ${a.location_id}: ${a.implementation_rate}%`)
})

// Check if any April audit locations are in the campaign scope
if (aprilAudits?.length > 0) {
  const auditLocationIds = aprilAudits.map(a => a.location_id)
  const { data: inScope } = await supabase
    .from('agrosuper_campaign_scopes')
    .select('location_id')
    .eq('campaign_id', aprilCampaign.id)
    .in('location_id', auditLocationIds)
  
  console.log(`\nAudit locations that are in campaign scope: ${inScope?.length || 0}`)
}
