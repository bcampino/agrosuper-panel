import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UsersTable } from '@/components/settings/users-table'

export default async function UsersPage() {
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

  const { data: users } = await supabase
    .from('users')
    .select('*, zone:zones(id, name)')
    .order('full_name')

  const { data: zones } = await supabase
    .from('zones')
    .select('*')
    .order('name')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Usuarios</h1>
        <p className="text-muted-foreground">Gestionar usuarios y roles del sistema</p>
      </div>
      <UsersTable users={users ?? []} zones={zones ?? []} />
    </div>
  )
}
