import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReviewPanel } from '@/components/audits/review-panel'
import type { Audit, AuditAnswer, AuditPhoto, Pillar, Question, QuestionOption } from '@/types'

interface ReviewPageProps {
  params: Promise<{ id: string }>
}

export default async function AuditReviewPage({ params }: ReviewPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // User actual para permisos de edición
  const { data: { user } } = await supabase.auth.getUser()
  const { data: dbUser } = user
    ? await supabase.from('users').select('role').eq('id', user.id).single()
    : { data: null }

  // Fetch audit with location
  const { data: audit } = await supabase
    .from('audits')
    .select('*, location:locations(id,name,code)')
    .eq('id', id)
    .single()

  if (!audit) {
    redirect('/audits')
  }

  // Fetch audit answers with question and options joined
  const { data: answers } = await supabase
    .from('audit_answers')
    .select(
      '*, question:questions(id, identifier, title, description, weight, pillar_id, datascope_question_name, is_mandatory, sort_order, question_type, evidence_photo_ids, ai_enabled, ai_evidence_type, ai_instruction, options:question_options(*))'
    )
    .eq('audit_id', id)
    .order('created_at')

  // Fetch audit photos
  const { data: photos } = await supabase
    .from('audit_photos')
    .select('*')
    .eq('audit_id', id)
    .order('created_at')

  // Fetch pillars for grouping — from audit's tree, or from answers' questions
  const treeId = audit.tree_version_id
  let pillars: Pillar[] = []

  if (treeId) {
    const { data: pillarData } = await supabase
      .from('pillars')
      .select('id, tree_id, name, weight, sort_order, created_at')
      .eq('tree_id', treeId)
      .order('sort_order')

    pillars = (pillarData as Pillar[]) ?? []
  }

  // Fallback: if no pillars found, extract unique pillar_ids from answers and fetch them
  if (pillars.length === 0 && answers && answers.length > 0) {
    const pillarIds = [...new Set(
      answers
        .map((a: Record<string, unknown>) => (a.question as Record<string, unknown> | null)?.pillar_id as string | undefined)
        .filter(Boolean)
    )]
    if (pillarIds.length > 0) {
      const { data: pillarData } = await supabase
        .from('pillars')
        .select('id, tree_id, name, weight, sort_order, created_at')
        .in('id', pillarIds)
        .order('sort_order')

      pillars = (pillarData as Pillar[]) ?? []
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Revisar Auditoria</h1>
      <ReviewPanel
        audit={audit as Audit}
        answers={
          (answers as (AuditAnswer & {
            question: Question & { options: QuestionOption[] }
          })[]) ?? []
        }
        photos={(photos as AuditPhoto[]) ?? []}
        pillars={pillars}
        currentUserRole={dbUser?.role}
      />
    </div>
  )
}
