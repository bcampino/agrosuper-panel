import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** DELETE /api/audits/[id]  — permanently delete audit and all related data */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  // Cascade: audit_answers, audit_photos, scores are deleted via DB FK cascade
  const { error } = await supabase
    .from('audits')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** PATCH /api/audits/[id]  — reassign month, suspend, or unsuspend */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createAdminClient()

  let body: { month?: string; action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, month } = body

  // Suspend / unsuspend
  if (action === 'suspend' || action === 'unsuspend') {
    const { error } = await supabase
      .from('audits')
      .update({ suspended_at: action === 'suspend' ? new Date().toISOString() : null })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Reassign month → no toca audited_at, solo setea effective_month.
  // Pasar month = null o '' para limpiar (vuelve al mes de audited_at).
  if (month === null || month === '') {
    const { error } = await supabase
      .from('audits')
      .update({ effective_month: null })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, effective_month: null })
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM, null, or action must be suspend/unsuspend' }, { status: 400 })
  }

  const { error } = await supabase
    .from('audits')
    .update({ effective_month: month })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, effective_month: month })
}
