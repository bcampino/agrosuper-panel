import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function getCallerEmail(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role, email').eq('id', user.id).single()
  return profile as { role: string; email: string } | null
}

/**
 * PATCH /api/tasks/[id]
 * Admin: puede cambiar cualquier campo
 * Asignado: solo puede cambiar status
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const caller = await getCallerEmail(supabase)
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const isAdmin = caller.role === 'treid_admin'
  const updates: Record<string, unknown> = {}

  if (isAdmin) {
    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim()
    if ('description' in body) updates.description = body.description ?? null
    if ('photo_url' in body) updates.photo_url = body.photo_url ?? null
    if ('due_date' in body) updates.due_date = body.due_date ?? null
    if ('assigned_to' in body) updates.assigned_to = body.assigned_to
  }
  // Both admin and assignee can change status
  if (typeof body.status === 'string' && ['pending', 'in_progress', 'done'].includes(body.status)) {
    updates.status = body.status
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('tasks').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, task: data })
}

/**
 * DELETE /api/tasks/[id] — solo treid_admin
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const caller = await getCallerEmail(supabase)
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (caller.role !== 'treid_admin') return NextResponse.json({ error: 'Solo treid_admin' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  // Best-effort: delete photo from storage
  const { data: existing } = await admin.from('tasks').select('photo_url').eq('id', id).single()
  const photoUrl = (existing as { photo_url?: string | null } | null)?.photo_url
  if (photoUrl) {
    const marker = '/storage/v1/object/public/propuestas/'
    const i = photoUrl.indexOf(marker)
    if (i >= 0) await admin.storage.from('propuestas').remove([photoUrl.slice(i + marker.length)])
  }

  const { error } = await admin.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
