import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface AnswerChange {
  answer_id: string
  option_id: string
  pillar_name: string
}

interface EditAnswersBody {
  changes: AnswerChange[]
  note: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: auditId } = await params

  // Auth: solo treid_admin y treid_operations
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: dbUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!dbUser || !['treid_admin', 'treid_operations'].includes(dbUser.role)) {
    return NextResponse.json({ error: 'Sin permisos para editar auditorías' }, { status: 403 })
  }

  const body: EditAnswersBody = await request.json()
  const { changes, note } = body

  if (!changes?.length) {
    return NextResponse.json({ error: 'No hay cambios' }, { status: 400 })
  }

  // Usar admin client para las escrituras
  const admin = createAdminClient()

  // Actualizar cada respuesta modificada
  for (const change of changes) {
    const { data: option } = await admin
      .from('question_options')
      .select('label, value')
      .eq('id', change.option_id)
      .single()

    if (!option) continue

    const { error } = await admin
      .from('audit_answers')
      .update({
        decision: 'edited',
        final_value: option.label,
        selected_option_id: change.option_id,
        decided_at: new Date().toISOString(),
        decided_by: user.id,
      })
      .eq('id', change.answer_id)

    if (error) {
      console.error('[edit-answers] error updating answer', { answer_id: change.answer_id, error: error.message })
    }
  }

  // Pilares afectados (únicos)
  const editedPillarNames = [...new Set(changes.map((c) => c.pillar_name))]

  // Marcar la auditoría como editada
  await admin
    .from('audits')
    .update({
      edited_at: new Date().toISOString(),
      edited_by: user.id,
      edit_note: note?.trim() || null,
      edited_pillar_names: editedPillarNames,
    })
    .eq('id', auditId)

  // Recalcular puntaje
  try {
    const origin = request.nextUrl.origin
    const scoreRes = await fetch(`${origin}/api/audits/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit_id: auditId }),
    })
    if (!scoreRes.ok) {
      console.error('[edit-answers] score recalculation failed', { status: scoreRes.status })
    }
  } catch (e) {
    console.error('[edit-answers] score recalculation error', e)
  }

  return NextResponse.json({ ok: true, edited_pillars: editedPillarNames })
}
