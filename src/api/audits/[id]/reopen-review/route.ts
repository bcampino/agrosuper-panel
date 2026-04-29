import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/audits/:id/reopen-review
 * Reopens a reviewed audit so a human can change their decision.
 * - Sets audit.status back to 'pending_review'
 * - KEEPS the audit_reviews row intact so the AI analysis (items/summary)
 *   remains visible. The AI is never re-run.
 * - Clears the human override fields so the audit looks pending again.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: auditId } = await params

  // Auth
  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // If there's a human review on top, clear the human fields so the AI review
  // is visible again. The items/summary/verdict from the AI are preserved.
  const { data: existing } = await supabase
    .from('audit_reviews')
    .select('reviewed_by_ai')
    .eq('audit_id', auditId)
    .maybeSingle()

  if (existing && !existing.reviewed_by_ai) {
    await supabase
      .from('audit_reviews')
      .update({
        reviewer_id: null,
        reviewer_name: null,
        reviewer_note: null,
        reviewed_by_ai: true,
      })
      .eq('audit_id', auditId)
  }

  // Reset audit status to pending_review so the Revisar button re-appears
  const { error } = await supabase
    .from('audits')
    .update({ status: 'pending_review' })
    .eq('id', auditId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
