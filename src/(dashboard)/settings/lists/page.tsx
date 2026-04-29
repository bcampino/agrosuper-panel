import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ListEditor } from '@/components/settings/list-editor'

export default async function ListsPage() {
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

  const { data: listItems } = await supabase
    .from('list_items')
    .select('*')
    .order('category')
    .order('sort_order')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Listas Configurables</h1>
        <p className="text-muted-foreground">
          Gestiona los campos de lista fijos del sistema
        </p>
      </div>
      <ListEditor items={listItems ?? []} />
    </div>
  )
}
