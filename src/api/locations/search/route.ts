import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/locations/search?q=<code or name>
 * Devuelve hasta 10 locales activos que matcheen por código o nombre.
 * Usado por el autocomplete de "Local" en el modal de Propuestas.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 1) return NextResponse.json({ results: [] })

  const like = `%${q}%`
  const { data } = await supabase
    .from('locations')
    .select('id, code, name, region')
    .eq('is_active', true)
    .or(`code.ilike.${like},name.ilike.${like}`)
    .order('code')
    .limit(10)

  return NextResponse.json({ results: data ?? [] })
}
