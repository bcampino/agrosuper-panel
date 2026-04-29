import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSecretIfEnabled } from '@/lib/api/route-guards'
import {
  classifyDatascopeForm,
  isDatascopeRecommendationForm,
  normalizeDatascopeOptionValue,
  normalizeDatascopeText,
} from '@/lib/datascope/form-classification'
import { type DatascopePayloadItem, extractAnswers } from '@/types/datascope'
import { syncMysteryToPerfectStore } from '@/lib/datascope/sync-mystery'

/**
 * Webhook for Datascope "Formulario Enex Recomendación"
 *
 * This form is separate from the Perfect Store audit.
 * It captures: primera marca recomendada, fotos, premio, audio, comentarios.
 *
 * Scoring logic (from Excel):
 *   SI(1ra="Shell";25;0) + SI(2da="Shell";15;0) + SI(3ra="Shell";10;0)
 *   Mapped to questions REC-01 (weight 50), REC-02 (weight 30), REC-03 (weight 20)
 *
 * Strategy: Find the most recent audit for this location and add/update
 * the recommendation answers, then recalculate the score.
 * If no recent audit exists, create a new audit record.
 */
export async function POST(request: NextRequest) {
  const unauthorized = verifyWebhookSecretIfEnabled(
    request,
    ['DATASCOPE_WEBHOOK_SECRET', 'WEBHOOK_SHARED_SECRET'],
    'ENFORCE_DATASCOPE_WEBHOOK_SECRET',
    'recommendation-webhook'
  )
  if (unauthorized) {
    return unauthorized
  }

  const supabase = createAdminClient()

  let rawPayload: unknown
  try {
    rawPayload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const payloadArray = Array.isArray(rawPayload) ? rawPayload : [rawPayload]
    const payload = payloadArray[0] as DatascopePayloadItem

    if (!payload || !payload.form_id) {
      await logWebhook(supabase, { status: 'error', error_message: 'Empty or invalid payload', raw_payload: rawPayload as Record<string, unknown> })
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const {
      code: locationCode,
      form_id: formId,
      form_name: formName,
      pdf_url: pdfUrl,
      created_at: createdAt,
      user_info: userInfo,
    } = payload
    const formType = classifyDatascopeForm(String(formId), formName)

    if (!isDatascopeRecommendationForm(formType)) {
      const reason = `Unsupported Datascope form type for recommendation scoring: ${formType}`
      await logWebhook(supabase, {
        form_id: String(formId),
        form_name: formName,
        location_code: String(locationCode),
        status: 'error',
        error_message: reason,
        raw_payload: rawPayload as Record<string, unknown>,
      })
      return NextResponse.json({ error: reason }, { status: 200 })
    }

    // Also extract assign_loc_code as fallback (Datascope sends location code there in some forms)
    const assignLocCode = (payload as Record<string, unknown>).assign_loc_code as string | undefined

    const answers = extractAnswers(payload)

    // Find location — try assign_loc_code first (more reliable), then code as fallback
    // assign_loc_code can be just a number ("26"), or "385- CIPER REPUESTOS LTDA ...", or "132-"
    const extractLeadingCode = (val: string): string | null => {
      const match = val.match(/^(\d+)/)
      return match ? match[1] : null
    }

    const codesToTry: string[] = []
    if (assignLocCode) {
      const parsed = extractLeadingCode(String(assignLocCode))
      if (parsed) codesToTry.push(parsed)
      codesToTry.push(String(assignLocCode).replace(/[-\s]+$/, ''))
    }
    codesToTry.push(String(locationCode).replace(/[-\s]+$/, ''))
    codesToTry.push(String(locationCode))
    const uniqueCodes = [...new Set(codesToTry)]

    let location: { id: string } | null = null
    for (const code of uniqueCodes) {
      const { data } = await supabase
        .from('locations')
        .select('id')
        .eq('code', code)
        .single()
      if (data) {
        location = data
        break
      }
    }

    if (!location) {
      await logWebhook(supabase, {
        form_id: String(formId),
        form_name: formName,
        location_code: String(locationCode),
        status: 'error',
        error_message: `Location not found for code: ${locationCode} (also tried: ${uniqueCodes.join(', ')})`,
        raw_payload: rawPayload as Record<string, unknown>,
      })
      return NextResponse.json({ error: `Location not found: ${locationCode}` }, { status: 200 })
    }

    // Get active pillar tree — we only need Recomendación questions
    const { data: tree } = await supabase
      .from('pillar_trees')
      .select(`
        id,
        pillars (
          id, name,
          questions (
            id, identifier, title,
            datascope_question_id, datascope_question_name,
            question_options (id, label, value, datascope_value)
          )
        )
      `)
      .eq('is_active', true)
      .single()

    if (!tree) {
      await logWebhook(supabase, {
        form_id: String(formId),
        form_name: formName,
        location_code: String(locationCode),
        status: 'error',
        error_message: 'No active pillar tree found',
        raw_payload: rawPayload as Record<string, unknown>,
      })
      return NextResponse.json({ error: 'No active pillar tree' }, { status: 200 })
    }

    // Build lookup for REC questions by datascope_question_id AND by datascope_question_name
    type QWithOptions = {
      id: string
      identifier: string
      datascope_question_id: number | null
      datascope_question_name: string | null
      question_options: Array<{ id: string; label: string; value: number; datascope_value: string | null }>
    }

    const recQuestions: QWithOptions[] = []
    const questionByDatascopeId = new Map<number, QWithOptions>()
    const questionByName = new Map<string, QWithOptions>()
    const questionByIdentifier = new Map<string, QWithOptions>()

    for (const pillar of tree.pillars ?? []) {
      for (const q of pillar.questions ?? []) {
        if (q.identifier?.startsWith('REC-')) {
          recQuestions.push(q)
          if (q.identifier) questionByIdentifier.set(q.identifier, q)
          if (q.datascope_question_id != null) {
            questionByDatascopeId.set(q.datascope_question_id, q)
          }
          if (q.datascope_question_name) {
            questionByName.set(normalizeDatascopeText(q.datascope_question_name), q)
          }
        }
      }
    }

    // Datascope recommendation forms use stable ids 2/4/5 for 1ra/2da/3ra marca.
    if (questionByIdentifier.has('REC-01')) questionByDatascopeId.set(2, questionByIdentifier.get('REC-01')!)
    if (questionByIdentifier.has('REC-02')) questionByDatascopeId.set(4, questionByIdentifier.get('REC-02')!)
    if (questionByIdentifier.has('REC-03')) questionByDatascopeId.set(5, questionByIdentifier.get('REC-03')!)

    const matchedAnswers: Array<{
      question_id: string
      raw_value: string
      selected_option_id: string | null
    }> = []

    const photoRows: Array<{
      question_id: string | null
      datascope_question_id: number
      photo_url: string
      label: string | null
    }> = []

    // Collect raw values for the 3 recommendation positions (ds ids 2/4/5 = REC-01/02/03)
    const recRawValues: Record<string, string> = {} // identifier → raw value

    for (const answer of answers) {
      let question = questionByDatascopeId.get(answer.question_id)
      if (!question) {
        question = questionByName.get(normalizeDatascopeText(answer.name))
      }

      if (answer.type === 'photo') {
        photoRows.push({
          question_id: question?.id ?? null,
          datascope_question_id: answer.question_id,
          photo_url: answer.value,
          label: answer.label,
        })
        continue
      }

      if (!question) continue

      // Collect raw recommendation values by position (used for hierarchical scoring)
      if (question.identifier?.startsWith('REC-')) {
        recRawValues[question.identifier] = answer.value
      }

      // REC-02/03 have weight=0 — store raw only (no option match needed for scoring)
      if (question.identifier === 'REC-02' || question.identifier === 'REC-03') {
        matchedAnswers.push({
          question_id: question.id,
          raw_value: answer.value,
          selected_option_id: null,
        })
        continue
      }

      // Non-REC answers: standard option match
      if (!question.identifier?.startsWith('REC-')) {
        let matchedOptionId: string | null = null
        if (question.question_options?.length) {
          const exactMatch = question.question_options.find(
            (opt) => opt.datascope_value === answer.value
          )
          if (exactMatch) {
            matchedOptionId = exactMatch.id
          } else {
            const looseMatch = question.question_options.find(
              (opt) =>
                normalizeDatascopeOptionValue(opt.datascope_value) ===
                normalizeDatascopeOptionValue(answer.value)
            )
            if (looseMatch) matchedOptionId = looseMatch.id
          }
        }
        matchedAnswers.push({
          question_id: question.id,
          raw_value: answer.value,
          selected_option_id: matchedOptionId,
        })
      }
    }

    // Hierarchical REC-01 scoring:
    //   Shell en 1ra posición → 100
    //   Shell en 2da posición → 60
    //   Shell en 3era posición → 40
    //   Ninguna posición Shell → 0
    const rec01Q = questionByIdentifier.get('REC-01')
    if (rec01Q) {
      const isShell = (v: string) => v.toLowerCase().includes('shell')
      const v1 = recRawValues['REC-01'] ?? ''
      const v2 = recRawValues['REC-02'] ?? ''
      const v3 = recRawValues['REC-03'] ?? ''
      const hierScore = isShell(v1) ? 100 : isShell(v2) ? 60 : isShell(v3) ? 40 : 0
      const rec01Opt = rec01Q.question_options.find(
        (o) => Math.round(Number(o.value)) === hierScore
      )
      console.info('[recommendation-webhook] REC hierarchy computed', {
        location_id: location.id,
        v1, v2, v3, hierScore,
        option_label: rec01Opt?.label ?? null,
      })
      matchedAnswers.push({
        question_id: rec01Q.id,
        raw_value: v1 || v2 || v3 || '',
        selected_option_id: rec01Opt?.id ?? null,
      })
    }

    // Idempotency by form_answer_id: each Datascope submission has a unique
    // form_answer_id. If we already ingested this one, update it. Otherwise
    // create a new audit — we must NOT collapse multiple mystery visits of
    // the same local into one row.
    const formAnswerId = (payload as Record<string, unknown>).form_answer_id
    let existingAudit: { id: string; tree_version_id: string | null } | null = null
    if (formAnswerId != null) {
      const { data } = await supabase
        .from('audits')
        .select('id, tree_version_id')
        .eq('location_id', location.id)
        .eq('raw_data->>form_answer_id', String(formAnswerId))
        .limit(1)
        .maybeSingle()
      if (data) existingAudit = data
    }

    let auditId: string

    if (existingAudit) {
      // Update existing audit with recommendation data
      auditId = existingAudit.id

      // Update pdf_url if provided, and mark as aprobado
      await supabase
        .from('audits')
        .update({ ...(pdfUrl ? { pdf_url: pdfUrl } : {}), status: 'aprobado' })
        .eq('id', auditId)

      // Delete old REC answers for this audit (if re-processing)
      const recQuestionIds = recQuestions.map((q) => q.id)
      if (recQuestionIds.length > 0) {
        await supabase
          .from('audit_answers')
          .delete()
          .eq('audit_id', auditId)
          .in('question_id', recQuestionIds)

        await supabase
          .from('audit_photos')
          .delete()
          .eq('audit_id', auditId)
          .in('question_id', recQuestionIds)
      }

      const photoQuestionIds = [...new Set(photoRows.map((row) => row.datascope_question_id))]
      if (photoQuestionIds.length > 0) {
        await supabase
          .from('audit_photos')
          .delete()
          .eq('audit_id', auditId)
          .in('datascope_question_id', photoQuestionIds)
      }
    } else {
      // No recent audit — create a new one for the recommendation
      const auditedAt = createdAt
        ? new Date(createdAt.replace(' ', 'T') + ':00').toISOString()
        : new Date().toISOString()

      // REGLA BIBLIA: días 1-3 de cada mes cuentan al mes anterior
      const ad = new Date(auditedAt)
      const dom = ad.getUTCDate()
      let effectiveMonth: string | null = null
      if (dom >= 1 && dom <= 3) {
        const prev = new Date(Date.UTC(ad.getUTCFullYear(), ad.getUTCMonth() - 1, 1))
        effectiveMonth = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`
      }

      // Normalizar form_id para evitar "rec-rec-..." si el payload ya trae prefijo.
      const normalizedFormId = String(formId).replace(/^rec-/, '')

      const { data: newAudit, error: auditError } = await supabase
        .from('audits')
        .insert({
          location_id: location.id,
          audit_type: 'audit' as const,
          status: 'aprobado' as const,
          tree_version_id: tree.id,
          datascope_form_id: `rec-${normalizedFormId}`,
          auditor_name: userInfo?.user_name ?? null,
          auditor_email: userInfo?.username ?? null,
          pdf_url: pdfUrl ?? null,
          raw_data: rawPayload as Record<string, unknown>,
          audited_at: auditedAt,
          effective_month: effectiveMonth,
        })
        .select('id')
        .single()

      if (auditError || !newAudit) {
        if (auditError?.code === '23505') {
          await logWebhook(supabase, {
            form_id: String(formId),
            form_name: formName,
            location_code: String(locationCode),
            status: 'error',
            error_message: 'Duplicate recommendation (already processed)',
            raw_payload: rawPayload as Record<string, unknown>,
          })
          return NextResponse.json({ message: 'Already processed' }, { status: 200 })
        }

        await logWebhook(supabase, {
          form_id: String(formId),
          form_name: formName,
          location_code: String(locationCode),
          status: 'error',
          error_message: `Failed to create audit: ${auditError?.message}`,
          raw_payload: rawPayload as Record<string, unknown>,
        })
        return NextResponse.json({ error: 'Failed to create audit' }, { status: 200 })
      }

      auditId = newAudit.id
    }

    // Insert recommendation answers
    if (matchedAnswers.length > 0) {
      const rows = matchedAnswers.map((a) => ({
        audit_id: auditId,
        question_id: a.question_id,
        raw_value: a.raw_value,
        selected_option_id: a.selected_option_id,
      }))

      const { error: answersError } = await supabase
        .from('audit_answers')
        .insert(rows)

      if (answersError) {
        console.error('Failed to insert recommendation answers:', answersError)
      }
    }

    // Insert photos
    if (photoRows.length > 0) {
      const rows = photoRows.map((p) => ({
        audit_id: auditId,
        question_id: p.question_id,
        datascope_question_id: p.datascope_question_id,
        photo_url: p.photo_url,
        label: p.label,
      }))

      const { error: photosError } = await supabase
        .from('audit_photos')
        .insert(rows)

      if (photosError) {
        console.error('Failed to insert recommendation photos:', photosError)
      }
    }

    // Recalculate score
    try {
      const mappedAnswerCount = matchedAnswers.filter(
        (answer) => answer.selected_option_id != null
      ).length

      console.info('[recommendation-webhook] starting score calculation', {
        audit_id: auditId,
        location_id: location.id,
        tree_version_id: existingAudit?.tree_version_id ?? tree.id,
        form_id: String(formId),
        answers_count: matchedAnswers.length,
        mapped_answer_count: mappedAnswerCount,
        photos_count: photoRows.length,
      })

      const { data: score, error: scoreError } = await supabase.rpc(
        'calculate_audit_score',
        { p_audit_id: auditId }
      )

      if (scoreError) {
        console.error('[recommendation-webhook] score calculation failed', {
          audit_id: auditId,
          location_id: location.id,
          tree_version_id: existingAudit?.tree_version_id ?? tree.id,
          form_id: String(formId),
          answers_count: matchedAnswers.length,
          mapped_answer_count: mappedAnswerCount,
          reason: scoreError.message,
        })
      } else {
        const { data: persistedScore } = await supabase
          .from('scores')
          .select('audit_id, total_score, calculated_at')
          .eq('audit_id', auditId)
          .maybeSingle()

        console.info('[recommendation-webhook] score calculation finished', {
          audit_id: auditId,
          location_id: location.id,
          tree_version_id: existingAudit?.tree_version_id ?? tree.id,
          form_id: String(formId),
          answers_count: matchedAnswers.length,
          mapped_answer_count: mappedAnswerCount,
          score,
          persisted: Boolean(persistedScore),
          persisted_score: persistedScore?.total_score ?? null,
          calculated_at: persistedScore?.calculated_at ?? null,
        })
      }
    } catch (e) {
      console.error('Score calculation failed:', e)
    }

    // Sync con Perfect Store (si ya existe un 664005 del mismo local/mes, copiar
    // REC al Perfect Store y recalcular su score).
    try {
      const auditedAtIso = createdAt
        ? new Date(createdAt.replace(' ', 'T') + ':00').toISOString()
        : new Date().toISOString()
      const month = auditedAtIso.slice(0, 7)
      const result = await syncMysteryToPerfectStore(supabase, location.id, month)
      console.info('[recommendation-webhook] perfect store sync result', {
        audit_id: auditId,
        location_id: location.id,
        month,
        result,
      })
    } catch (e) {
      console.error('[recommendation-webhook] perfect store sync failed', {
        audit_id: auditId,
        error: (e as Error).message,
      })
    }

    // Log webhook
    await logWebhook(supabase, {
      form_id: String(formId),
      form_name: formName,
      location_code: String(locationCode),
      status: 'success',
      audit_id: auditId,
      raw_payload: rawPayload as Record<string, unknown>,
    })

    return NextResponse.json({
      audit_id: auditId,
      matched_existing_audit: !!existingAudit,
      answers_count: matchedAnswers.length,
      photos_count: photoRows.length,
    }, { status: 200 })

  } catch (error) {
    console.error('Recommendation webhook error:', error)
    await logWebhook(supabase, {
      status: 'error',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      raw_payload: rawPayload as Record<string, unknown>,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 200 })
  }
}

async function logWebhook(
  supabase: ReturnType<typeof createAdminClient>,
  data: {
    form_id?: string | null
    form_name?: string | null
    location_code?: string | null
    status: string
    audit_id?: string | null
    error_message?: string | null
    raw_payload?: Record<string, unknown> | null
  }
) {
  try {
    await supabase.from('webhook_logs').insert({
      form_id: data.form_id ?? null,
      form_name: data.form_name ?? 'Recomendación',
      location_code: data.location_code ?? null,
      status: data.status,
      audit_id: data.audit_id ?? null,
      error_message: data.error_message ?? null,
      raw_payload: data.raw_payload ?? null,
    })
  } catch (e) {
    console.error('Failed to log webhook:', e)
  }
}
