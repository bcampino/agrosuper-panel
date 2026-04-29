import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'
)

// Test the exact query from the code
const startDate = '2026-04-01T00:00:00'
const endDate = '2026-05-01T00:00:00'

const { data, count } = await supabase
  .from('agrosuper_audits')
  .select('id, submitted_at, implementation_rate', { count: 'exact' })
  .gte('submitted_at', startDate)
  .lt('submitted_at', endDate)

console.log(`\nAudits between ${startDate} and ${endDate}:`)
console.log(`Total count: ${count}`)
console.log(`Records returned: ${data?.length || 0}`)
console.log('\nFirst 3 records:')
data?.slice(0, 3).forEach(a => {
  console.log(`- ${a.submitted_at}: ${a.implementation_rate}%`)
})
