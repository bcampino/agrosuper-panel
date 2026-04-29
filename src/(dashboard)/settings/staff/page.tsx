import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StaffManager } from '@/components/settings/staff-manager'

export default async function StaffPage() {
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

  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .order('last_name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Equipo Comercial</h1>
        <p className="text-muted-foreground">
          Gestionar vendedores, jefes de zona y gestores TREID
        </p>
      </div>
      <StaffManager staff={staff ?? []} />
    </div>
  )
}
