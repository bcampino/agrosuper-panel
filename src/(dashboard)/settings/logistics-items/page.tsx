import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogisticsItemsEditor } from '@/components/logistics/logistics-items-editor'
import type { LogisticsItem } from '@/types'

export default async function LogisticsItemsSettingsPage() {
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

  const { data: items } = await supabase
    .from('logistics_items')
    .select('*')
    .order('sort_order')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Items Logísticos</h1>
        <p className="text-muted-foreground">
          Gestiona el catálogo de elementos disponibles para solicitudes logísticas
        </p>
      </div>
      <LogisticsItemsEditor items={(items as LogisticsItem[]) ?? []} />
    </div>
  )
}
