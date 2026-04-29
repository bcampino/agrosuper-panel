import Link from 'next/link'
import { ChevronRight, ClipboardList, FileQuestion, Lightbulb, HelpCircle, FileCheck2 } from 'lucide-react'

const SECTIONS = [
  {
    href: '/capacitaciones/auditor',
    title: 'Qué hace un auditor de Shell',
    description: 'Funciones, rutas y responsabilidades del gestor en terreno',
    icon: ClipboardList,
    border: 'var(--shell-yellow)',
  },
  {
    href: '/capacitaciones/formulario',
    title: 'Cómo responder el formulario',
    description: 'Guía paso a paso para levantar auditorías correctamente',
    icon: FileQuestion,
    border: 'var(--shell-blue)',
  },
  {
    href: '/capacitaciones/oportunidades',
    title: 'Cómo detectar oportunidades',
    description: 'Qué observar en el local para proponer mejoras de POP y venta',
    icon: Lightbulb,
    border: 'var(--shell-red)',
  },
  {
    href: '/capacitaciones/faq',
    title: 'Preguntas frecuentes',
    description: 'Respuestas a dudas comunes sobre auditorías y procesos',
    icon: HelpCircle,
    border: 'var(--shell-navy)',
  },
  {
    href: '/capacitaciones/evaluaciones',
    title: 'Evaluaciones',
    description: 'Sube archivos de evaluaciones realizadas a los gestores',
    icon: FileCheck2,
    border: '#aac44a',
  },
] as const

export default function CapacitacionesPage() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Equipo Treid</p>
        <h1 className="text-2xl font-black tracking-tight">Capacitaciones</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Material de formación para gestores y auditores</p>
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
