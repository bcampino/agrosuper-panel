import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Briefcase, UserCircle2, Users } from 'lucide-react'

type StaffType = 'vendedor' | 'jefe_zona' | 'gestor_treid'

interface StaffMember {
  id: string
  first_name: string
  last_name: string | null
  staff_type: StaffType
}

// Comercial Enex (hardcoded — no están en tabla staff)
const COMERCIAL_ENEX = [
  { name: 'Catalina Baraona', email: 'cbaraona@enex.cl' },
  { name: 'Laura Larraín',    email: 'llarrain@enex.cl' },
]

function fakeEmail(name: string): string {
  const normalized = name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '')
  return `${normalized}@enex.cl`
}

export default async function UsuariosEnexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  if (profile?.role !== 'treid_admin' && profile?.role !== 'enex_admin') {
    redirect('/dashboard')
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('id, first_name, last_name, staff_type')
    .in('staff_type', ['vendedor', 'jefe_zona'])
    .order('first_name')

  const staffList = (staff ?? []) as StaffMember[]
  const jz       = staffList.filter((s) => s.staff_type === 'jefe_zona')
  const vendedores = staffList.filter((s) => s.staff_type === 'vendedor')

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Equipo Enex</p>
        <h1 className="text-2xl font-black tracking-tight">Usuarios Enex</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Equipo comercial, jefes de zona y vendedores</p>
      </div>

      {/* Comercial */}
      <Section icon={Briefcase} title="Equipo Comercial" count={COMERCIAL_ENEX.length} color="#aac44a">
        <ul className="divide-y">
          {COMERCIAL_ENEX.map((p) => (
            <UserRow key={p.name} name={p.name} email={p.email} color="#aac44a" />
          ))}
        </ul>
      </Section>

      {/* JZ */}
      <Section icon={UserCircle2} title="Jefes de Zona" count={jz.length} color="#6b91cb">
        <ul className="divide-y">
          {jz.map((p) => {
            const fullName = `${p.first_name} ${p.last_name ?? ''}`.trim()
            return <UserRow key={p.id} name={fullName} email={fakeEmail(fullName)} color="#6b91cb" />
          })}
        </ul>
      </Section>

      {/* Vendedores */}
      <Section icon={Users} title="Vendedores" count={vendedores.length} color="#d0661c">
        <ul className="divide-y">
          {vendedores.map((p) => {
            const fullName = `${p.first_name} ${p.last_name ?? ''}`.trim()
            return <UserRow key={p.id} name={fullName} email={fakeEmail(fullName)} color="#d0661c" />
          })}
        </ul>
      </Section>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  count,
  color,
  children,
}: {
  icon: typeof Briefcase
  title: string
  count: number
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderLeftWidth: 4, borderLeftColor: color }}>
        <Icon className="h-5 w-5" style={{ color }} />
        <h2 className="font-bold text-base">{title}</h2>
        <span className="ml-auto text-xs font-semibold rounded-full px-2.5 py-0.5" style={{ background: `${color}22`, color }}>
          {count}
        </span>
      </div>
      {children}
    </div>
  )
}

function UserRow({ name, email, color }: { name: string; email: string; color: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
      <div
        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
        style={{ background: color }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
      </div>
    </li>
  )
}
