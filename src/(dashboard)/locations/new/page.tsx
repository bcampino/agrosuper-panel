import { createClient } from '@/lib/supabase/server'
import { LocationForm } from '@/components/locations/location-form'
import type { User, Zone } from '@/types'

export default async function NewLocationPage() {
  const supabase = await createClient()

  const [{ data: users }, { data: zones }] = await Promise.all([
    supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('zones')
      .select('*')
      .order('name'),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Nuevo Local</h1>
      <LocationForm
        users={(users as User[]) ?? []}
        zones={(zones as Zone[]) ?? []}
        mode="create"
      />
    </div>
  )
}
