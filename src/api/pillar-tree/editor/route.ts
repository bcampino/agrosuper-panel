import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── GUARD ──────────────────────────────────────────────────────────────────
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthorized' as const, status: 401 }
  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'treid_admin') return { error: 'forbidden' as const, status: 403 }
  return { user, profile }
}

// ─── GET — fetch active tree + pillars + questions + options ────────────────
export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()
  const { data: tree, error: treeErr } = await admin
    .from('pillar_trees')
    .select('id, name, version, is_active')
    .eq('is_active', true)
    .single()
  if (treeErr || !tree) return NextResponse.json({ error: 'no active tree' }, { status: 404 })

  const { data: pillars } = await admin
    .from('pillars')
    .select('id, name, weight, sort_order')
    .eq('tree_id', tree.id)
    .order('sort_order')

  const pillarIds = (pillars ?? []).map(p => p.id)
  const { data: questions } = pillarIds.length
    ? await admin
        .from('questions')
        .select('id, pillar_id, identifier, title, weight, sort_order, datascope_question_name, datascope_question_id, question_type, is_mandatory')
        .in('pillar_id', pillarIds)
        .order('sort_order')
    : { data: [] }

  const questionIds = (questions ?? []).map(q => q.id)
  const { data: options } = questionIds.length
    ? await admin
        .from('question_options')
        .select('id, question_id, label, value, datascope_value, sort_order')
        .in('question_id', questionIds)
        .order('sort_order')
    : { data: [] }

  return NextResponse.json({ tree, pillars: pillars ?? [], questions: questions ?? [], options: options ?? [] })
}

// ─── PUT — save edited tree ─────────────────────────────────────────────────
type EditPayload = {
  pillars: { id: string; weight: number; name?: string; sort_order?: number }[]
  questions: {
    id: string
    title: string
    weight: number
    sort_order: number
    datascope_question_name: string | null
    datascope_question_id: number | null
  }[]
  options: {
    id: string
    label: string
    value: number
    datascope_value: string | null
    sort_order: number
  }[]
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let body: EditPayload
  try {
    body = await req.json() as EditPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Validar suma pesos pilares = 100
  const pillarSum = body.pillars.reduce((s, p) => s + Number(p.weight || 0), 0)
  if (Math.abs(pillarSum - 100) > 0.5) {
    return NextResponse.json({ error: `La suma de pesos de pilares debe ser 100 (actual: ${pillarSum})` }, { status: 400 })
  }

  // Validar preguntas: por pilar, suma de pesos debe ser ~100
  const byPillar: Record<string, number> = {}
  const qList = body.questions.map(q => ({ ...q, pillar_id: '' }))
  // Necesitamos saber pillar_id de cada pregunta → traer
  const { data: qRows } = await admin.from('questions').select('id, pillar_id').in('id', body.questions.map(q => q.id))
  const pillarByQ = new Map((qRows ?? []).map(r => [r.id, r.pillar_id]))
  for (const q of body.questions) {
    const pid = pillarByQ.get(q.id)
    if (!pid) continue
    byPillar[pid] = (byPillar[pid] ?? 0) + Number(q.weight || 0)
  }
  const badPillar = Object.entries(byPillar).find(([, s]) => Math.abs(s - 100) > 0.5)
  if (badPillar) {
    return NextResponse.json({ error: `Los pesos de preguntas del pilar ${badPillar[0]} deben sumar 100 (actual: ${badPillar[1].toFixed(2)})` }, { status: 400 })
  }

  // Updates (no transacciones explícitas — en errores parciales, avisar al usuario)
  const errors: string[] = []

  for (const p of body.pillars) {
    const { error } = await admin.from('pillars').update({
      weight: p.weight,
      ...(p.name !== undefined ? { name: p.name } : {}),
      ...(p.sort_order !== undefined ? { sort_order: p.sort_order } : {}),
    }).eq('id', p.id)
    if (error) errors.push(`pilar ${p.id}: ${error.message}`)
  }

  for (const q of body.questions) {
    const { error } = await admin.from('questions').update({
      title: q.title,
      weight: q.weight,
      sort_order: q.sort_order,
      datascope_question_name: q.datascope_question_name,
      datascope_question_id: q.datascope_question_id,
    }).eq('id', q.id)
    if (error) errors.push(`pregunta ${q.id}: ${error.message}`)
  }

  for (const o of body.options) {
    const { error } = await admin.from('question_options').update({
      label: o.label,
      value: o.value,
      datascope_value: o.datascope_value,
      sort_order: o.sort_order,
    }).eq('id', o.id)
    if (error) errors.push(`opción ${o.id}: ${error.message}`)
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Errores al guardar', details: errors }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// ─── POST — create new question or option ───────────────────────────────────
type CreateQuestionBody = {
  type: 'question'
  pillar_id: string
  identifier: string
  title: string
  weight: number
  sort_order: number
  datascope_question_name?: string | null
  datascope_question_id?: number | null
}
type CreateOptionBody = {
  type: 'option'
  question_id: string
  label: string
  value: number
  sort_order: number
  datascope_value?: string | null
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()
  const body = (await req.json().catch(() => null)) as CreateQuestionBody | CreateOptionBody | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  if (body.type === 'question') {
    // Validate that identifier is unique within pillar
    const { data: existing } = await admin
      .from('questions').select('id').eq('identifier', body.identifier).maybeSingle()
    if (existing) {
      return NextResponse.json({ error: `Ya existe una pregunta con código "${body.identifier}"` }, { status: 400 })
    }

    const { data, error } = await admin
      .from('questions')
      .insert({
        pillar_id: body.pillar_id,
        identifier: body.identifier,
        title: body.title,
        weight: body.weight,
        sort_order: body.sort_order,
        datascope_question_name: body.datascope_question_name ?? null,
        datascope_question_id: body.datascope_question_id ?? null,
        question_type: 'multi_option',
        is_mandatory: false,
      })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ question: data })
  }

  if (body.type === 'option') {
    const { data, error } = await admin
      .from('question_options')
      .insert({
        question_id: body.question_id,
        label: body.label,
        value: body.value,
        sort_order: body.sort_order,
        datascope_value: body.datascope_value ?? null,
      })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ option: data })
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}

// ─── DELETE — remove question (+ its options via cascade) or option ─────────
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const admin = createAdminClient()
  const body = (await req.json().catch(() => null)) as { type: 'question' | 'option'; id: string } | null
  if (!body?.type || !body.id) return NextResponse.json({ error: 'Missing type or id' }, { status: 400 })

  if (body.type === 'question') {
    // Cascade: delete options first, then the question
    await admin.from('question_options').delete().eq('question_id', body.id)
    const { error } = await admin.from('questions').delete().eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.type === 'option') {
    const { error } = await admin.from('question_options').delete().eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
