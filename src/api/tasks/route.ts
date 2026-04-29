import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'propuestas'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if ((profile as { role: string } | null)?.role !== 'treid_admin') {
    return { error: NextResponse.json({ error: 'Solo treid_admin' }, { status: 403 }) }
  }
  return { user }
}

/**
 * GET /api/tasks?email=x  — tareas de un email (o todas si no se pasa email)
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const email = req.nextUrl.searchParams.get('email')
  let q = supabase.from('tasks').select('*').order('created_at', { ascending: false })
  if (email) q = q.eq('assigned_to', email)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data ?? [] })
}

/**
 * POST /api/tasks
 * Body JSON: { title, description?, photo_url?, assigned_to, due_date? }
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return auth.error

  let body: { title?: string; description?: string; photo_url?: string; assigned_to?: string; due_date?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  if (!body.title?.trim()) return NextResponse.json({ error: 'título requerido' }, { status: 400 })
  if (!body.assigned_to?.trim()) return NextResponse.json({ error: 'assigned_to requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tasks')
    .insert({
      title: body.title.trim(),
      description: body.description?.trim() ?? null,
      photo_url: body.photo_url ?? null,
      assigned_to: body.assigned_to.trim().toLowerCase(),
      due_date: body.due_date ?? null,
      created_by: auth.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, task: data })
}

/**
 * Unused here — kept for reference. Upload to storage from browser.
 */
export { BUCKET }
