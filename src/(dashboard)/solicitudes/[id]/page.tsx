import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { SolicitudDetail } from '@/components/logistics/solicitud-detail'
import type { LogisticsRequest, LogisticsRequestStatusHistory, Courier, User } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SolicitudDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser?.id ?? '')
    .single()

  if (!profile) redirect('/dashboard')

  const { data: request } = await supabase
    .from('logistics_requests')
    .select('*, requester:users!requester_id(id,full_name,email,role), logistics_item:logistics_items!logistics_item_id(id,sku,name), location:locations!location_id(id,code,name)')
    .eq('id', id)
    .single()

  if (!request) notFound()

  const { data: history } = await supabase
    .from('logistics_request_status_history')
    .select('*, user:users!changed_by(id,full_name)')
    .eq('request_id', id)
    .order('created_at', { ascending: true })

  const { data: couriers } = await supabase
    .from('couriers')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  return (
    <SolicitudDetail
      request={request as LogisticsRequest}
      history={(history as LogisticsRequestStatusHistory[]) ?? []}
      couriers={(couriers as Courier[]) ?? []}
      user={profile as User}
    />
  )
}
