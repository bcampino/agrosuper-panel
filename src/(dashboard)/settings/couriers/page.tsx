import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CouriersEditor } from '@/components/logistics/couriers-editor'
import type { Courier } from '@/types'

export default async function CouriersSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  if (profile?.role !== 'treid_admin') redirect('/dashboard')

  const { data: couriers } = await supabase
    .from('couriers')
    .select('*')
    .order('sort_order')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Couriers</h1>
        <p className="text-muted-foreground">
          Gestiona los couriers disponibles y sus links de seguimiento
        </p>
      </div>
      <CouriersEditor couriers={(couriers as Courier[]) ?? []} />
    </div>
  )
}
