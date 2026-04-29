import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OpportunitiesGrid } from '@/components/opportunities/opportunities-grid'
import { OPPORTUNITY_ADMIN_ROLES } from '@/lib/constants'
import type { Opportunity, Location, UserRole } from '@/types'

export default async function OpportunitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  if (!OPPORTUNITY_ADMIN_ROLES.includes(profile?.role as UserRole)) {
    redirect('/dashboard')
  }

  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('*, location:locations!location_id(id,code,name)')
    .order('created_at', { ascending: false })

  const { data: locations } = await supabase
    .from('locations')
    .select('id, code, name')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Oportunidades</h1>
      <OpportunitiesGrid
        opportunities={(opportunities as Opportunity[]) ?? []}
        locations={(locations as Location[]) ?? []}
      />
    </div>
  )
}
