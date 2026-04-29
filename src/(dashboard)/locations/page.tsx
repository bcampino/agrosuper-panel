import { createClient } from '@/lib/supabase/server'
import { LocationsTable } from '@/components/locations/locations-table'

export const dynamic = 'force-dynamic'

export default async function LocationsPage() {
  const supabase = await createClient()

  const [locsRes, staffRes] = await Promise.all([
    supabase
      .from('locations')
      .select('id, code, name, region, sa_status, category, subsegment, size, is_active, status, staff_vendedor_id, staff_jz_id')
      .order('code', { ascending: true }),
    supabase
      .from('staff')
      .select('id, first_name, last_name, staff_type')
      .in('staff_type', ['vendedor', 'jefe_zona'])
      .order('first_name'),
  ])

  const staffMap = new Map(
    (staffRes.data ?? []).map((s) => [s.id, `${s.first_name} ${s.last_name}`])
  )

  const vendors = (staffRes.data ?? [])
    .filter((s) => s.staff_type === 'vendedor')
    .map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const jzList = (staffRes.data ?? [])
    .filter((s) => s.staff_type === 'jefe_zona')
    .map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const locations = (locsRes.data ?? []).map((l) => ({
    ...l,
    vendedor_name: l.staff_vendedor_id ? (staffMap.get(l.staff_vendedor_id) ?? '-') : '-',
    jz_name: l.staff_jz_id ? (staffMap.get(l.staff_jz_id) ?? '-') : '-',
  }))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black tracking-tight">Hoja de Vida Locales</h1>
      <LocationsTable
        locations={locations}
        vendors={vendors}
        jzList={jzList}
      />
    </div>
  )
}
