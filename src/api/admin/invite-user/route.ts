import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/invite-user
 * Body: { email, full_name, role }
 *
 * Flujo:
 * 1. Invita al usuario por email (Supabase envía magic link).
 * 2. Crea la fila en la tabla `users` con el uuid que devuelve el invite.
 *
 * Solo treid_admin puede llamar este endpoint.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if ((profile as { role: string } | null)?.role !== 'treid_admin') {
    return NextResponse.json({ error: 'Solo treid_admin' }, { status: 403 })
  }

  let body: { email?: string; full_name?: string; role?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const email = body.email?.trim().toLowerCase()
  const full_name = body.full_name?.trim()
  const role = body.role as UserRole | undefined

  if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 })
  if (!full_name) return NextResponse.json({ error: 'full_name requerido' }, { status: 400 })
  if (!role) return NextResponse.json({ error: 'role requerido' }, { status: 400 })

  const admin = createAdminClient()

  // 1. Invite via Supabase (sends email with magic link)
  const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/dashboard`,
  })

  if (inviteErr) {
    // If user already exists, just upsert the users row
    if (!inviteErr.message.includes('already been registered')) {
      return NextResponse.json({ error: inviteErr.message }, { status: 400 })
    }
  }

  const newUserId = inviteData?.user?.id
  if (!newUserId) {
    // User already existed — try to find them
    const { data: existing } = await admin.auth.admin.listUsers()
    const found = existing?.users?.find((u) => u.email === email)
    if (!found) return NextResponse.json({ error: 'No se pudo obtener el usuario' }, { status: 500 })

    // Upsert users row
    const { error: upsertErr } = await admin.from('users').upsert({
      id: found.id,
      email,
      full_name,
      role,
      is_active: true,
    }, { onConflict: 'id' })
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    return NextResponse.json({ ok: true, invited: false, message: 'Usuario existente actualizado' })
  }

  // 2. Insert into users table
  const { error: insertErr } = await admin.from('users').insert({
    id: newUserId,
    email,
    full_name,
    role,
    is_active: true,
  })
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, invited: true, message: 'Invitación enviada por email' })
}
