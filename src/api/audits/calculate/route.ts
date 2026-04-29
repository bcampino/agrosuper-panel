import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUserRoles } from '@/lib/api/route-guards'
import {
  classifyDatascopeForm,
  isDatascopeAuditScoringForm,
  isDatascopeRecommendationForm,
} from '@/lib/datascope/form-classification'

export async function POST(request: NextRequest) {
  const auth = await requireUserRoles(['treid_admin', 'treid_operations'])
  if (!auth.ok) {
    return auth.response
  }

  try {
    const { audit_id } = await request.json()

    if (!audit_id) {
      return NextResponse.json(
        { error: 'audit_id is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data: audit, error: auditError } = await supabase
      .from('audits')
      .select('id, location_id, tree_version_id, status, datascope_form_id')
      .eq('id', audit_id)
      .single()

    if (auditError || !audit) {
      return NextResponse.json(
        { error: 'Audit not found', details: auditError?.message ?? null },
        { status: 404 }
      )
    }

    const formType = classifyDatascopeForm(audit.datascope_form_id)
    if (!isDatascopeAuditScoringForm(formType) && !isDatascopeRecommendationForm(formType)) {
      return NextResponse.json(
        {
          error: 'Unsupported form for score calculation',
          details: { datascope_form_id: audit.datascope_form_id, form_type: formType },
        },
        { status: 400 }
      )
    }

    const { data: answerRows, error: answersError } = await supabase
      .from('audit_answers')
      .select('id, selected_option_id')
      .eq('audit_id', audit_id)

    if (answersError) {
      return NextResponse.json(
        { error: 'Failed to load audit answers', details: answersError.message },
        { status: 500 }
      )
    }

    const { data: pillars, error: pillarsError } = await supabase
      .from('pillars')
      .select('id')
      .eq('tree_id', audit.tree_version_id)

    if (pillarsError) {
      return NextResponse.json(
        { error: 'Failed to load tree pillars', details: pillarsError.message },
        { status: 500 }
      )
    }

    let evaluableQuestionCount = 0
    if ((pillars ?? []).length > 0) {
      const { count: questionsCount, error: questionsError } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .in('pillar_id', (pillars ?? []).map((pillar) => pillar.id))
        .gt('weight', 0)

      if (questionsError) {
        return NextResponse.json(
          { error: 'Failed to load tree questions', details: questionsError.message },
          { status: 500 }
        )
      }

      evaluableQuestionCount = questionsCount ?? 0
    }

    console.info('[audit-score] starting calculation', {
      audit_id,
      user_id: auth.userId,
      role: auth.role,
      form_type: formType,
      location_id: audit.location_id,
      tree_version_id: audit.tree_version_id,
      audit_status: audit.status,
      evaluable_question_count: evaluableQuestionCount,
      answer_count: answerRows?.length ?? 0,
      mapped_answer_count:
        answerRows?.filter((answer) => answer.selected_option_id != null).length ?? 0,
    })

    const { data, error } = await supabase.rpc('calculate_audit_score', {
      p_audit_id: audit_id,
    })

    if (error) {
      console.error('[audit-score] calculation failed', {
        audit_id,
        user_id: auth.userId,
        role: auth.role,
        form_type: formType,
        location_id: audit.location_id,
        tree_version_id: audit.tree_version_id,
        evaluable_question_count: evaluableQuestionCount,
        answer_count: answerRows?.length ?? 0,
        mapped_answer_count:
          answerRows?.filter((answer) => answer.selected_option_id != null).length ?? 0,
        reason: error.message,
      })
      return NextResponse.json(
        { error: 'Failed to calculate score', details: error.message },
        { status: 500 }
      )
    }

    const { data: persistedScore, error: persistedScoreError } = await supabase
      .from('scores')
      .select('audit_id, tree_version_id, total_score, calculated_at')
      .eq('audit_id', audit_id)
      .maybeSingle()

    if (persistedScoreError) {
      console.error('[audit-score] score lookup failed', {
        audit_id,
        reason: persistedScoreError.message,
      })
    } else {
      console.info('[audit-score] calculation finished', {
        audit_id,
        form_type: formType,
        location_id: audit.location_id,
        tree_version_id: persistedScore?.tree_version_id ?? audit.tree_version_id,
        evaluable_question_count: evaluableQuestionCount,
        answer_count: answerRows?.length ?? 0,
        mapped_answer_count:
          answerRows?.filter((answer) => answer.selected_option_id != null).length ?? 0,
        score: data,
        persisted: Boolean(persistedScore),
        persisted_score: persistedScore?.total_score ?? null,
        calculated_at: persistedScore?.calculated_at ?? null,
      })
    }

    return NextResponse.json({
      score: data,
      persisted: Boolean(persistedScore),
      score_row: persistedScore ?? null,
    })
  } catch (error) {
    console.error('Score calculation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
