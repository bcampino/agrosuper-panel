import { NextRequest, NextResponse } from 'next/server'
import { requireUserRoles } from '@/lib/api/route-guards'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: opportunityId } = await params

  // Auth: only admins can approve/reject
  const auth = await requireUserRoles(['treid_admin', 'enex_admin'])
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { review_status } = body as { review_status?: string }

  if (!review_status || !['approved', 'rejected'].includes(review_status)) {
    return NextResponse.json(
      { error: 'review_status must be "approved" or "rejected"' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { data: opp, error } = await supabase
    .from('opportunities')
    .update({
      review_status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opportunityId)
    .select('id, category, review_status, description')
    .single()

  if (error || !opp) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  console.info('[opportunity-review]', {
    opportunity_id: opportunityId,
    review_status,
    reviewer: auth.userId,
    category: opp.category,
  })

  return NextResponse.json({ ok: true, ...opp })
}
