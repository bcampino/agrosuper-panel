import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LocationsManager } from '@/components/settings/locations-manager'
import type { Location } from '@/types'

export default async function SettingsLocationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  if (profile?.role !== 'treid_admin') {
    redirect('/dashboard')
  }

  const { data: locations } = await supabase
    .from('locations')
    .select(
      '*, staff_vendedor:staff!staff_vendedor_id(*), staff_jz:staff!staff_jz_id(*), staff_gestor:staff!staff_gestor_id(*)'
    )
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Locales</h1>
        <p className="text-muted-foreground">{"Gestión y carga masiva de locales"}</p>
      </div>
      <LocationsManager locations={(locations as Location[]) ?? []} />
    </div>
  )
}
