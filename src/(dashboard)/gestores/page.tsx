import { createClient } from '@/lib/supabase/server'
import { fetchAllPages } from '@/lib/supabase/paginate'
import { redirect } from 'next/navigation'
import GestoresList from '@/components/gestores/gestores-list'

export const dynamic = 'force-dynamic'

function fakeEmail(name: string): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '')
  return `${normalized}@treid.cl`
}

export default async function GestoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()

  if (profile?.role !== 'treid_admin') {
    redirect('/dashboard')
  }

  // Extract unique auditor_name from audits, most recent first — paginated
  const audits = await fetchAllPages<{ auditor_name: string | null; auditor_email: string | null; audited_at: string | null; datascope_form_id: string | null }>((from, to) =>
    supabase
      .from('audits')
      .select('auditor_name, auditor_email, audited_at, datascope_form_id')
      .not('auditor_name', 'is', null)
      .order('audited_at', { ascending: false, nullsFirst: false })
      .range(from, to)
  )

  // Dedupe by auditor_name, keep latest visit + count audits
  const byName = new Map<
    string,
    { name: string; email: string; lastVisit: string | null; auditCount: number; realEmail: string | null }
  >()
  for (const a of audits ?? []) {
    const name = (a.auditor_name ?? '').trim()
    if (!name || /^TBD/i.test(name)) continue
    if (!byName.has(name)) {
      byName.set(name, {
        name,
        email: fakeEmail(name),
        realEmail: a.auditor_email ?? null,
        lastVisit: a.audited_at,
        auditCount: 1,
      })
    } else {
      const existing = byName.get(name)!
      existing.auditCount++
      if (!existing.realEmail && a.auditor_email) existing.realEmail = a.auditor_email
    }
  }

  const gestores = [...byName.values()].sort((a, b) => {
    if (!a.lastVisit) return 1
    if (!b.lastVisit) return -1
    return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
  })

  // Fetch task counts per email
  const emails = gestores.map((g) => g.realEmail ?? g.email).filter(Boolean)
  const { data: taskRows } = await supabase
    .from('tasks')
    .select('assigned_to, status')
    .in('assigned_to', emails)

  const taskCounts: Record<string, { pending: number; total: number }> = {}
  for (const t of taskRows ?? []) {
    const e = t.assigned_to as string
    if (!taskCounts[e]) taskCounts[e] = { pending: 0, total: 0 }
    taskCounts[e].total++
    if (t.status !== 'done') taskCounts[e].pending++
  }

  const gestoresWithTasks = gestores.map((g) => {
    const email = (g.realEmail ?? g.email).toLowerCase()
    return { ...g, tasks: taskCounts[email] ?? { pending: 0, total: 0 } }
  })

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Equipo Treid</p>
        <h1 className="text-2xl font-black tracking-tight">Gestores</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Auditores de Treid que han levantado formularios (ordenados por última visita)
        </p>
      </div>

      <GestoresList gestores={gestoresWithTasks} />
    </div>
  )
}
