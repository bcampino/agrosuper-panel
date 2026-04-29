import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

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
 * POST /api/pop-items  — crea un nuevo POP en el catálogo.
 *
 * Body JSON:
 *   { name, material, measurements, images: string[] }
 *
 * Las imágenes ya deben estar subidas al bucket 'propuestas' (el cliente
 * las sube directo con supabase.storage.from(...).upload() antes de
 * llamar a este endpoint). Esto evita el límite de 4.5MB de Vercel en
 * API routes serverless (era la causa del error 413).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const auth = await requireAdmin(supabase)
  if ('error' in auth) return auth.error

  let body: { name?: string; material?: string; measurements?: string; images?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const material = (body.material ?? '').trim()
  const measurements = (body.measurements ?? '').trim()
  const images = Array.isArray(body.images) ? body.images.filter((u) => typeof u === 'string' && u.startsWith('http')) : []

  if (!name || !material || !measurements) {
    return NextResponse.json({ error: 'Nombre, material y medidas son obligatorios' }, { status: 400 })
  }
  if (images.length === 0) {
    return NextResponse.json({ error: 'Debes subir al menos 1 imagen' }, { status: 400 })
  }

  const baseSlug = slugify(name)
  const slug = `${baseSlug}-${Date.now().toString(36)}`

  const admin = createAdminClient()
  const { data: inserted, error: insErr } = await admin
    .from('pop_items')
    .insert({ slug, name, material, measurements, images, created_by: auth.user.id })
    .select('id, slug, name, material, measurements, images')
    .single()

  if (insErr) {
    return NextResponse.json({ error: `Error creando POP: ${insErr.message}` }, { status: 500 })
  }
  return NextResponse.json({ ok: true, item: inserted }, { status: 201 })
}
