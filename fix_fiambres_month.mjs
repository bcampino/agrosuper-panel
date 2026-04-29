import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'
)

// Fiambres has 474 audits in 2026-02, so update to that month
const { error } = await supabase
  .from('agrosuper_campaigns')
  .update({ month: '2026-02' })
  .eq('name', 'Fiambres en Almacenes - Dic 25')

if (error) {
  console.error('❌ Error:', error.message)
} else {
  console.log('✅ Updated Fiambres to 2026-02')
}

// Check updated campaigns
const { data: campaigns } = await supabase
  .from('agrosuper_campaigns')
  .select('name, month')
  .order('month')

console.log('\nAll campaigns:')
campaigns?.forEach(c => {
  console.log(`- ${c.name} → ${c.month}`)
})
