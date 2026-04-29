import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface BulkBody {
  mode: 'replace' | 'append'
  items: {
    producto: string
    detalle: string
    total: number
  }[]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'treid_admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as BulkBody | null
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const admin = createAdminClient()
  let deleted = 0

  if (body.mode === 'replace') {
    // Soft-delete: mark all active items as inactive
    const { data, error } = await admin
      .from('inventory')
      .update({ is_active: false })
      .eq('is_active', true)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    deleted = data?.length ?? 0
  }

  const rows = body.items
    .filter((it) => it.detalle?.trim())
    .map((it) => ({
      material_type: it.producto?.trim() || null,
      name: it.detalle.trim(),
      current_balance: Number.isFinite(it.total) ? it.total : 0,
      is_active: true,
    }))

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0, deleted })
  }

  // Chunk insert (max 500/batch)
  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await admin.from('inventory').insert(chunk)
    if (error) {
      return NextResponse.json({ error: error.message, inserted, deleted }, { status: 500 })
    }
    inserted += chunk.length
  }

  return NextResponse.json({ ok: true, inserted, deleted })
}
