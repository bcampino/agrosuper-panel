import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'
)

// Get campaigns with their stats
const { data: campaigns } = await supabase
  .from('agrosuper_campaigns')
  .select('id, name, month, column_type')
  .order('created_at', { ascending: false })

console.log('Campaigns:')
campaigns?.forEach(c => {
  console.log(`- ${c.name} (ID: ${c.id.substring(0, 8)}...) Month: ${c.month}`)
})

// Get audit count by month
const { data: audits } = await supabase
  .from('agrosuper_audits')
  .select('submitted_at')

const auditsByMonth = {}
audits?.forEach(a => {
  const month = (a.submitted_at || '').substring(0, 7)
  auditsByMonth[month] = (auditsByMonth[month] || 0) + 1
})

console.log('\nAudits by month:')
Object.entries(auditsByMonth).sort().forEach(([month, count]) => {
  console.log(`- ${month}: ${count} audits`)
})
