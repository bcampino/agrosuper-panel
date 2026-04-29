import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InventoryManager } from '@/components/inventory/inventory-manager'

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()

  if (profile?.role !== 'treid_admin' && profile?.role !== 'enex_admin') {
    redirect('/dashboard')
  }

  const { data: items } = await supabase
    .from('inventory')
    .select('id, name, material_type, description, current_balance, min_stock, photo_url, is_active, created_at')
    .eq('is_active', true)
    .order('material_type', { ascending: true, nullsFirst: false })
    .order('name')

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Material Treid</p>
        <h1 className="text-2xl font-black tracking-tight">Bodega Treid</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Inventario de material POP y merchandising</p>
      </div>

      <InventoryManager
        initialItems={(items ?? []).map((it) => ({
          id: it.id,
          producto: it.material_type ?? '(sin categoría)',
          detalle: it.name,
          description: it.description,
          total: it.current_balance ?? 0,
          min_stock: it.min_stock ?? 0,
          photo_url: it.photo_url,
        }))}
        isAdmin={profile?.role === 'treid_admin'}
      />
    </div>
  )
}
