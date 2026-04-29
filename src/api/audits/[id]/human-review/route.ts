import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { ReviewVerdict } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: auditId } = await params

  // Get current user
  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseUser
    .from('users').select('full_name, role').eq('id', user.id).single()

  const body = await request.json().catch(() => ({}))
  const verdict: ReviewVerdict = body.verdict === 'rechazado' ? 'rechazado' : 'aprobado'
  const note: string = body.note ?? ''

  const supabase = createAdminClient()

  // Get existing AI review to preserve items
  const { data: existing } = await supabase
    .from('audit_reviews').select('review_items, confidence, summary').eq('audit_id', auditId).maybeSingle()

  // Upsert review with human override
  const { error: reviewErr } = await supabase
    .from('audit_reviews')
    .upsert({
      audit_id: auditId,
      verdict,
      confidence: 100,  // human is 100% sure
      review_items: existing?.review_items ?? [],
      summary: existing?.summary ?? null,
      reviewed_by_ai: false,
      reviewer_id: user.id,
      reviewer_name: profile?.full_name ?? user.email ?? 'Revisor',
      reviewed_at: new Date().toISOString(),
      reviewer_note: note || null,
    }, { onConflict: 'audit_id' })

  if (reviewErr) {
    return NextResponse.json({ error: reviewErr.message }, { status: 500 })
  }

  // Update audit status
  await supabase.from('audits').update({ status: verdict }).eq('id', auditId)

  // Calculate score if approved
  if (verdict === 'aprobado') {
    await supabase.rpc('calculate_audit_score', { p_audit_id: auditId })
  }

  return NextResponse.json({ ok: true, verdict })
}
