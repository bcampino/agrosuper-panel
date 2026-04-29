import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUserRoles } from '@/lib/api/route-guards'
import { validateTreePayload } from '@/lib/pillar-tree/validation'

export async function POST(request: Request) {
  const auth = await requireUserRoles(['treid_admin'])
  if (!auth.ok) {
    return auth.response
  }

  let newTreeId: string | null = null

  try {
    const body = await request.json()
    const validation = validateTreePayload(body)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.errors[0], details: validation.errors },
        { status: 400 }
      )
    }

    const {
      name,
      previousTreeId,
      pillars,
    } = validation.normalizedPayload

    const supabase = createAdminClient()

    // Get next version number
    const { data: lastTree } = await supabase
      .from('pillar_trees')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = (lastTree?.version ?? 0) + 1

    // Create new tree
    const { data: newTree, error: treeError } = await supabase
      .from('pillar_trees')
      .insert({
        name,
        version: nextVersion,
        is_active: false,
        created_by: auth.userId,
      })
      .select()
      .single()

    if (treeError || !newTree) {
      throw new Error(treeError?.message ?? 'Failed to create tree')
    }

    newTreeId = newTree.id

    // Create pillars, questions, and options
    for (const pillar of pillars) {
      const { data: newPillar, error: pillarError } = await supabase
        .from('pillars')
        .insert({
          tree_id: newTree.id,
          name: pillar.name,
          weight: pillar.weight,
          sort_order: pillar.sort_order,
        })
        .select()
        .single()

      if (pillarError || !newPillar) {
        throw new Error(pillarError?.message ?? 'Failed to create pillar')
      }

      for (const question of pillar.questions) {
        const { data: newQuestion, error: qError } = await supabase
          .from('questions')
          .insert({
            pillar_id: newPillar.id,
            identifier: question.identifier,
            title: question.title,
            description: question.description,
            weight: question.weight,
            is_mandatory: question.is_mandatory,
            sort_order: question.sort_order,
            datascope_question_name: question.datascope_question_name,
            datascope_question_id: question.datascope_question_id ?? null,
            question_type: question.question_type ?? 'multi_option',
            price_pair_group: question.price_pair_group ?? null,
            evidence_photo_ids: question.evidence_photo_ids ?? [],
            ai_enabled: question.ai_enabled ?? false,
            ai_evidence_type: question.ai_evidence_type ?? 'photo',
            ai_instruction: question.ai_instruction ?? null,
          })
          .select()
          .single()

        if (qError || !newQuestion) {
          throw new Error(qError?.message ?? 'Failed to create question')
        }

        if (question.options?.length > 0) {
          const { error: optError } = await supabase
            .from('question_options')
            .insert(
              question.options.map((opt: { label: string; value: number; datascope_value: string | null; sort_order: number }) => ({
                question_id: newQuestion.id,
                label: opt.label,
                value: opt.value,
                datascope_value: opt.datascope_value,
                sort_order: opt.sort_order,
              }))
            )

          if (optError) {
            throw new Error(optError.message)
          }
        }
      }
    }

    if (previousTreeId) {
      const { error: deactivateError } = await supabase
        .from('pillar_trees')
        .update({ is_active: false })
        .eq('id', previousTreeId)

      if (deactivateError) {
        throw new Error(deactivateError.message)
      }
    }

    const { error: activateError } = await supabase
      .from('pillar_trees')
      .update({ is_active: true })
      .eq('id', newTree.id)

    if (activateError) {
      throw new Error(activateError.message)
    }

    // Recalculate all audit scores with the new active tree
    const { data: recalcCount, error: recalcError } = await supabase.rpc('recalculate_all_scores')
    if (recalcError) {
      console.error('Warning: recalculate_all_scores failed:', recalcError.message)
    }

    return NextResponse.json({ success: true, treeId: newTree.id, version: nextVersion, recalculated: recalcCount ?? 0 })
  } catch (error) {
    if (newTreeId) {
      const supabase = createAdminClient()
      await supabase.from('pillar_trees').delete().eq('id', newTreeId)
    }

    console.error('Error saving pillar tree:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
