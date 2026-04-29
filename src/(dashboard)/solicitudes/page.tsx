import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogisticsKanbanBoard } from '@/components/logistics/logistics-kanban-board'
import type { LogisticsRequest, LogisticsItem, Courier, User } from '@/types'

export default async function SolicitudesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser?.id ?? '')
    .single()

  if (!profile) redirect('/dashboard')

  const user = profile as User
  const isAdmin = ['treid_admin', 'enex_admin'].includes(user.role)
  const isJZ = user.role === 'enex_jz'

  // Build query
  let query = supabase
    .from('logistics_requests')
    .select('*, requester:users!requester_id(id,full_name,email,role), logistics_item:logistics_items!logistics_item_id(id,sku,name), location:locations!location_id(id,code,name)')
    .order('created_at', { ascending: false })

  // Filter by role: JZ sees their zone, Seller sees only their own
  if (!isAdmin) {
    if (isJZ && user.zone_id) {
      const { data: zoneLocations } = await supabase
        .from('locations')
        .select('id')
        .eq('zone_id', user.zone_id)

      const locationIds = (zoneLocations ?? []).map((l: { id: string }) => l.id)
      if (locationIds.length > 0) {
        query = query.or(`requester_id.eq.${user.id},location_id.in.(${locationIds.join(',')})`)
      } else {
        query = query.eq('requester_id', user.id)
      }
    } else {
      query = query.eq('requester_id', user.id)
    }
  }

  const { data: requests } = await query

  // Items with stock for the form
  const { data: items } = await supabase
    .from('logistics_items')
    .select('*')
    .eq('is_active', true)
    .gt('current_stock', 0)
    .order('sort_order')

  // Locations for the form
  const { data: locations } = await supabase
    .from('locations')
    .select('id, code, name')
    .eq('is_active', true)
    .order('name')

  // Couriers for tracking
  const { data: couriers } = await supabase
    .from('couriers')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Solicitudes Logísticas</h1>
        <p className="text-muted-foreground">
          {isAdmin ? 'Todas las solicitudes' : isJZ ? 'Solicitudes de tu zona' : 'Mis solicitudes'}
        </p>
      </div>
      <LogisticsKanbanBoard
        requests={(requests as LogisticsRequest[]) ?? []}
        items={(items as LogisticsItem[]) ?? []}
        locations={locations ?? []}
        couriers={(couriers as Courier[]) ?? []}
        user={user}
      />
    </div>
  )
}
