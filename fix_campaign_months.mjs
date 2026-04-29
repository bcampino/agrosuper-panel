import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'
)

// Update campaign months
const updates = [
  { name: 'Fiambres en Almacenes - Dic 25', month: '2025-12' },
  { name: 'Naipes y Calculadors Dic25-Ene26', month: '2025-12' },  // o '2026-01'?
  { name: 'Bandera Muro y Rutera-Ene26', month: '2026-01' },
]

for (const update of updates) {
  const { error } = await supabase
    .from('agrosuper_campaigns')
    .update({ month: update.month })
    .eq('name', update.name)
  
  if (error) {
    console.error(`❌ Error updating ${update.name}:`, error.message)
  } else {
    console.log(`✅ Updated ${update.name} to ${update.month}`)
  }
}

console.log('\nCampaigns after update:')
const { data: campaigns } = await supabase
  .from('agrosuper_campaigns')
  .select('name, month')
  .order('name')

campaigns?.forEach(c => {
  console.log(`- ${c.name}: ${c.month}`)
})
