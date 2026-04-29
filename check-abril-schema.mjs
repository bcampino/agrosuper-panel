import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gsqmdlirbsthphtakryn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcW1kbGlyYnN0aHBodGFrcnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMyMjMxMSwiZXhwIjoyMDkyODk4MzExfQ.TMrWPkE7vcAodKHWK7L2rRye2LeM1_uPd_hZNgosweQ'
);

try {
  // Check if abril tables exist
  const { data: tables, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .in('table_name', ['agrosuper_abril_audits', 'agrosuper_abril_photos']);
  
  if (error) {
    console.log('Cannot query schema directly, testing table existence...');
    
    // Try to query the tables
    const { error: err1 } = await supabase
      .from('agrosuper_abril_audits')
      .select('id')
      .limit(1);
    
    const { error: err2 } = await supabase
      .from('agrosuper_abril_photos')
      .select('id')
      .limit(1);
    
    console.log('agrosuper_abril_audits exists:', !err1);
    console.log('agrosuper_abril_photos exists:', !err2);
  } else {
    console.log('Found tables:', tables);
  }
} catch (e) {
  console.error('Error:', e.message);
}
