import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, Plus, Users, UserCheck, BarChart3, Clock, FileQuestion,
} from 'lucide-react'

interface Prueba {
  id: string
  title: string
  description: string
  questions: number
  durationMin: number
  category: 'auditor' | 'formulario' | 'oportunidades' | 'general'
  lastAssigned: string | null
  assignedCount: number
  completedCount: number
}

// MOCK — más tarde leer de tabla `evaluaciones`
const PRUEBAS: Prueba[] = [
  {
    id: 'p1',
    title: 'Prueba: Qué hace un auditor de Shell',
    description: 'Evalúa conocimiento básico del rol, rutas y responsabilidades en terreno.',
    questions: 15,
    durationMin: 20,
    category: 'auditor',
    lastAssigned: '2026-04-15',
    assignedCount: 12,
    completedCount: 8,
  },
  {
    id: 'p2',
    title: 'Prueba: Llenado correcto del formulario 3.0',
    description: 'Casos prácticos de cómo responder DISP, EXH, PRC y REC ante diferentes escenarios.',
    questions: 25,
    durationMin: 30,
    category: 'formulario',
    lastAssigned: '2026-04-10',
    assignedCount: 14,
    completedCount: 11,
  },
  {
    id: 'p3',
    title: 'Prueba: Detectar oportunidades en el local',
    description: 'Identificación de POP faltante, mueble mal ubicado y espacios con potencial de branding.',
    questions: 10,
    durationMin: 15,
    category: 'oportunidades',
    lastAssigned: null,
    assignedCount: 0,
    completedCount: 0,
  },
  {
    id: 'p4',
    title: 'Prueba: Certificación trimestral Q2 2026',
    description: 'Evaluación general del conocimiento acumulado del trimestre. Obligatoria para todos los gestores.',
    questions: 40,
    durationMin: 60,
    category: 'general',
    lastAssigned: '2026-04-01',
    assignedCount: 14,
    completedCount: 14,
  },
]

const CATEGORY_STYLES: Record<Prueba['category'], { label: string; color: string; bg: string }> = {
  auditor:       { label: 'Auditor',       color: '#d0661c', bg: '#d0661c22' },
  formulario:    { label: 'Formulario',    color: '#6b91cb', bg: '#6b91cb22' },
  oportunidades: { label: 'Oportunidades', color: '#e74c3c', bg: '#e74c3c22' },
  general:       { label: 'General',       color: '#aac44a', bg: '#aac44a22' },
}

export default async function EvaluacionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()

  if (profile?.role !== 'treid_admin') {
    redirect('/capacitaciones')
  }

  const totalPruebas = PRUEBAS.length
  const totalAsignaciones = PRUEBAS.reduce((s, p) => s + p.assignedCount, 0)
  const totalCompletadas = PRUEBAS.reduce((s, p) => s + p.completedCount, 0)

  return (
    <div className="space-y-4">
      <Link
        href="/capacitaciones"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver a Capacitaciones
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Capacitaciones</p>
          <h1 className="text-2xl font-black tracking-tight">Evaluaciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Pruebas y tests de conocimiento para gestores</p>
        </div>
        <Link
          href="/capacitaciones/evaluaciones/nueva"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nueva prueba
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Pruebas creadas"    value={totalPruebas.toString()}     sub="disponibles"    color="blue" />
        <Kpi label="Asignaciones"       value={totalAsignaciones.toString()} sub="a gestores"     color="amber" />
        <Kpi label="Completadas"        value={totalCompletadas.toString()}  sub={`${totalAsignaciones > 0 ? Math.round((totalCompletadas / totalAsignaciones) * 100) : 0}% del total`} color="emerald" />
      </div>

      {/* Lista de pruebas */}
      <div className="space-y-3">
        {PRUEBAS.map((p) => {
          const cat = CATEGORY_STYLES[p.category]
          const pct = p.assignedCount > 0 ? Math.round((p.completedCount / p.assignedCount) * 100) : 0
          return (
            <div key={p.id} className="rounded-2xl border bg-card p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-4">
                {/* Left: info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5"
                      style={{ background: cat.bg, color: cat.color }}
                    >
                      {cat.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                      <FileQuestion className="h-3 w-3" />
                      {p.questions} preguntas
                    </span>
                    <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {p.durationMin} min
                    </span>
                  </div>
                  <h3 className="font-bold text-base mt-1.5">{p.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>

                  {/* Progress */}
                  {p.assignedCount > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-xs">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: cat.color }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {p.completedCount}/{p.assignedCount} completadas ({pct}%)
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: actions */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <ActionButton
                    href={`/capacitaciones/evaluaciones/${p.id}/asignar?modo=todos`}
                    icon={Users}
                    label="Asignar a todos"
                  />
                  <ActionButton
                    href={`/capacitaciones/evaluaciones/${p.id}/asignar?modo=algunos`}
                    icon={UserCheck}
                    label="Asignar a algunos"
                  />
                  <ActionButton
                    href={`/capacitaciones/evaluaciones/${p.id}/resultados`}
                    icon={BarChart3}
                    label="Resultados"
                    highlight
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Kpi({
  label, value, sub, color,
}: { label: string; value: string; sub?: string; color: 'blue' | 'amber' | 'emerald' }) {
  const styles = {
    blue:    'text-blue-700 bg-blue-50 ring-blue-200',
    amber:   'text-amber-700 bg-amber-50 ring-amber-200',
    emerald: 'text-emerald-700 bg-emerald-50 ring-emerald-200',
  }[color]
  return (
    <div className={`rounded-2xl border ring-1 ${styles} p-4`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs opacity-70">{sub}</p>}
    </div>
  )
}

function ActionButton({
  href,
  icon: Icon,
  label,
  highlight,
}: {
  href: string
  icon: typeof Users
  label: string
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
        highlight
          ? 'bg-primary text-primary-foreground hover:opacity-90'
          : 'border border-border bg-card hover:bg-muted/50'
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <ChevronRight className="h-3 w-3 opacity-60" />
    </Link>
  )
}
