import Link from 'next/link'
import { ChevronRight, ShoppingBag, Armchair, LayoutGrid, Presentation, Package } from 'lucide-react'

const SECTIONS = [
  {
    href: '/propuestas-treid/pop',
    title: 'Propuestas de POP',
    description: 'Catálogo de material POP para cotizar',
    icon: ShoppingBag,
    border: 'var(--shell-yellow)',
  },
  {
    href: '/propuestas-treid/sala-espera',
    title: 'Propuestas Sala de Espera',
    description: 'Mobiliario y decoración para salas de espera',
    icon: Armchair,
    border: 'var(--shell-blue)',
  },
  {
    href: '/propuestas-treid/bastidor',
    title: 'Propuestas Bastidor',
    description: 'Bastidores y estructuras publicitarias',
    icon: LayoutGrid,
    border: 'var(--shell-red)',
  },
  {
    href: '/propuestas-treid/cartel-interno',
    title: 'Propuestas Cartel Interno',
    description: 'Señalética y carteles para interior',
    icon: Presentation,
    border: 'var(--shell-navy)',
  },
  {
    href: '/propuestas-treid/otras',
    title: 'Otras Propuestas',
    description: 'Otro material propuesto',
    icon: Package,
    border: '#64748b',
  },
] as const

export default function PropuestasTreidPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Material Treid</p>
        <h1 className="text-2xl font-black tracking-tight">Propuestas Treid</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Material propuesto por Treid para puntos de venta</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group relative rounded-2xl border-[3px] bg-card p-4 overflow-hidden h-32 text-left hover:shadow-md transition-shadow cursor-pointer block"
              style={{ borderColor: s.border }}
            >
              <div
                className="absolute top-2 right-2 rounded-full p-1.5 transition-colors"
                style={{ background: `${s.border}22` }}
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2.5} style={{ color: s.border }} />
              </div>
              <Icon className="h-6 w-6 mb-2" style={{ color: s.border }} />
              <p className="text-base font-black tracking-tight">{s.title}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
