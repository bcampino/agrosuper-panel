import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import PopCatalog, { type PopItem } from '@/components/propuestas-treid/pop-catalog'
import type { User } from '@/types'

export const dynamic = 'force-dynamic'

// POP base hardcodeado — histórico. Nuevos POP se agregan desde UI (admin)
// y se guardan en la tabla `pop_items`.
export const POP_ITEMS: PopItem[] = [
  {
    slug: 'afiche-precio',
    name: 'Afiche Precio',
    material: 'PVC rígido 3mm',
    measurements: '48 x 68 cm',
    images: [
      '/propuestas-pop/afiche-precio-design.jpg',
      '/propuestas-pop/afiche-precio-installed.jpg',
    ],
  },
  {
    slug: 'jockey',
    name: 'Jockey',
    material: 'Poliéster bordado',
    measurements: 'Talla única',
    images: [
      '/propuestas-pop/jockey-design.jpg',
      '/propuestas-pop/jockey-installed.jpg',
    ],
  },
  {
    slug: 'calendario',
    name: 'Calendario',
    material: 'Cartulina 350g',
    measurements: '30 x 42 cm',
    images: [
      '/propuestas-pop/calendario-design.jpg',
      '/propuestas-pop/calendario-installed.jpg',
    ],
  },
  {
    slug: 'parante',
    name: 'Parante',
    material: 'PVC expandido 5mm',
    measurements: '60 x 160 cm',
    images: [
      '/propuestas-pop/parante-design.jpg',
      '/propuestas-pop/parante-installed.jpg',
    ],
  },
  {
    slug: 'stopper',
    name: 'Stopper',
    material: 'PVC rígido 2mm',
    measurements: '15 x 10 cm',
    images: [
      '/propuestas-pop/stopper-design.jpg',
      '/propuestas-pop/stopper-installed.jpg',
    ],
  },
  {
    slug: 'sticker',
    name: 'Sticker',
    material: 'Vinilo adhesivo',
    measurements: '20 x 20 cm',
    images: [
      '/propuestas-pop/sticker-design.jpg',
      '/propuestas-pop/sticker-installed.jpg',
    ],
  },
  {
    slug: 'flejera',
    name: 'Flejera',
    material: 'Plástico rígido',
    measurements: '30 x 5 cm',
    images: [
      '/propuestas-pop/flejera-design.jpg',
      '/propuestas-pop/flejera-installed.jpg',
    ],
  },
]

export default async function PropuestasPopPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  const user = profile as User | null
  // Agregar/editar/eliminar POP solo lo puede hacer treid_admin.
  // enex_admin ve el catálogo igual pero sin opciones de administración.
  const isAdmin = user?.role === 'treid_admin'

  // Traer POPs agregados desde UI (tabla pop_items)
  const { data: dbRows } = await supabase
    .from('pop_items')
    .select('id, slug, name, material, measurements, images')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const dbItems: PopItem[] = (dbRows ?? []).map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    material: String(r.material),
    measurements: String(r.measurements),
    images: Array.isArray(r.images) ? r.images.filter((x) => typeof x === 'string') : [],
  }))

  // Los nuevos primero (arriba) y los hardcoded debajo
  const allItems = [...dbItems, ...POP_ITEMS]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/propuestas-treid" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Catálogo POP</h1>
            <p className="text-sm text-muted-foreground">Elige un material y cotízalo directamente</p>
          </div>
        </div>
      </div>

      <PopCatalog
        items={allItems}
        userName={user?.full_name ?? authUser.email ?? 'Usuario'}
        userEmail={user?.email ?? authUser.email ?? ''}
        canAdd={isAdmin}
      />
    </div>
  )
}
