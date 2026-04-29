import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'propuestas'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const role = (profile as { role: string } | null)?.role
  if (role !== 'treid_admin') {
    return { error: NextResponse.json({ error: 'Solo treid_admin puede administrar POP' }, { status: 403 }) }
  }
  return { user }
}

/**
 * PATCH /api/pop-items/[id] — edita nombre/material/medidas/imágenes.
 * Body JSON: { name?, material?, measurements?, images?: string[] }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return auth.error

  const { id } = await params

  let body: { name?: string; material?: string; measurements?: string; images?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim()
  if (typeof body.material === 'string' && body.material.trim()) updates.material = body.material.trim()
  if (typeof body.measurements === 'string' && body.measurements.trim()) updates.measurements = body.measurements.trim()
  if (Array.isArray(body.images)) {
    const imgs = body.images.filter((u) => typeof u === 'string' && u.startsWith('http'))
    if (imgs.length === 0) {
      return NextResponse.json({ error: 'Al menos 1 imagen es obligatoria' }, { status: 400 })
    }
    updates.images = imgs
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pop_items')
    .update(updates)
    .eq('id', id)
    .select('id, slug, name, material, measurements, images')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}

/**
 * DELETE /api/pop-items/[id] — elimina el POP + sus imágenes del storage.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return auth.error

  const { id } = await params
  const admin = createAdminClient()

  // Traer URLs para borrar del storage
  const { data: existing } = await admin
    .from('pop_items')
    .select('images')
    .eq('id', id)
    .single()

  const images = Array.isArray((existing as { images?: unknown })?.images)
    ? ((existing as { images: string[] }).images).filter((u) => typeof u === 'string')
    : []

  // Borrar la fila primero
  const { error: delErr } = await admin.from('pop_items').delete().eq('id', id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  // Borrar los objetos del storage (best-effort — si falla, no bloquea)
  if (images.length > 0) {
    const paths = images
      .map((u) => {
        const marker = `/storage/v1/object/public/${BUCKET}/`
        const i = u.indexOf(marker)
        return i >= 0 ? u.slice(i + marker.length) : null
      })
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
    if (paths.length > 0) await admin.storage.from(BUCKET).remove(paths)
  }

  return NextResponse.json({ ok: true })
}
