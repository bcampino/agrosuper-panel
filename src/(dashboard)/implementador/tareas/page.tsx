import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ImplementadorTareasClient from '@/components/implementador/tareas-client'

export const dynamic = 'force-dynamic'

export default async function ImplementadorTareasPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, email, full_name')
    .eq('id', authUser.id)
    .single()

  const role = (profile as { role: string } | null)?.role
  // treid_admin also allowed (to preview the view)
  if (!role || !['treid_implementador', 'treid_admin'].includes(role)) {
    redirect('/dashboard')
  }

  const email = (profile as { email: string } | null)?.email ?? authUser.email ?? ''
  const fullName = (profile as { full_name: string } | null)?.full_name ?? authUser.email ?? ''

  // Fetch tasks server-side for initial render
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', email.toLowerCase())
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Implementador</p>
        <h1 className="text-2xl font-black tracking-tight">Mis Tareas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Hola {fullName} — aquí están tus tareas asignadas</p>
      </div>

      <ImplementadorTareasClient initialTasks={tasks ?? []} email={email} />
    </div>
  )
}
