import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSecretIfEnabled } from '@/lib/api/route-guards'
import {
  classifyDatascopeForm,
  isDatascopeAuditScoringForm,
  normalizeDatascopeOptionValue,
  normalizeDatascopeText,
  stripDatascopeNameAnnotations,
} from '@/lib/datascope/form-classification'
import { type DatascopePayloadItem, extractAnswers } from '@/types/datascope'
import { computePriceScore, scoreToOptionValue, type PricePairGroup } from '@/lib/scoring/price-comparison'
import { syncMysteryToPerfectStore } from '@/lib/datascope/sync-mystery'

const ENEX_3_0_FORM_ID = '664005'

export async function POST(request: NextRequest) {
  const unauthorized = verifyWebhookSecretIfEnabled(
    request,
    ['DATASCOPE_WEBHOOK_SECRET', 'WEBHOOK_SHARED_SECRET'],
    'ENFORCE_DATASCOPE_WEBHOOK_SECRET',
    'datascope-webhook'
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
    // 2. Parse payload — Datascope sends an array with one element
    const payloadArray = Array.isArray(rawPayload) ? rawPayload : [rawPayload]
    const payload = payloadArray[0] as DatascopePayloadItem

    if (!payload || !payload.form_id) {
      await logWebhook(supabase, { status: 'error', error_message: 'Empty or invalid payload', raw_payload: rawPayload as Record<string, unknown> })
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // 3. Extract metadata
    const {
      code: locationCode,
      form_id: formId,
      form_name: formName,
      pdf_url: pdfUrl,
      created_at: createdAt,
      user_info: userInfo,
    } = payload
    const formType = classifyDatascopeForm(String(formId), formName)

    // Also extract assign_loc_code and assign_loc_name as fallbacks
    // assign_loc_code format: "26", "385- CIPER REPUESTOS LTDA ...", or absent in newer forms
    // assign_loc_name format: "NNN- NOMBRE DEL LOCAL - DIRECCIÓN" — leading digits are internal code
    const assignLocCode = (payload as Record<string, unknown>).assign_loc_code as string | undefined
    let assignLocName = (payload as Record<string, unknown>).assign_loc_name as string | undefined
    const assignId = (payload as Record<string, unknown>).assign_id as string | undefined

    // For ENEX 3.0: `code` is the response sequence number, not the real local code.
    // Use Datascope API to fetch assign_location_name which contains the real local code ("NNN- NAME")
    if (String(formId) === ENEX_3_0_FORM_ID && !assignLocName) {
      try {
        const dsApiKey = process.env.DATASCOPE_API_KEY
        if (dsApiKey) {
          // Fetch last 600 answers for this form and find by `code` (response sequence)
          const dsRes = await fetch(
            `https://www.mydatascope.com/api/external/answers?form_id=${ENEX_3_0_FORM_ID}&limit=600`,
            { headers: { Authorization: dsApiKey } }
          )
          if (dsRes.ok) {
            const dsData = await dsRes.json() as Array<Record<string, unknown>>
            const match = dsData.find((a) => String(a.code) === String(locationCode))
            if (match?.assign_location_name) {
              assignLocName = String(match.assign_location_name)
              console.info('[datascope-webhook] resolved location from Datascope API', {
                code: locationCode,
                assign_location_name: assignLocName,
              })
            }
          }
        }
      } catch (e) {
        console.warn('[datascope-webhook] failed to fetch location from Datascope API', e)
      }
    }

    // 4. Extract all question answers from dynamic keys
    const answers = extractAnswers(payload)

    console.info('[datascope-webhook] received', {
      form_id: String(formId),
      form_type: formType,
      form_name: formName,
      location_code: String(locationCode),
      assign_loc_code: assignLocCode ?? null,
      assign_loc_name: assignLocName ?? null,
      total_answers_in_payload: answers.length,
    })

    if (!isDatascopeAuditScoringForm(formType)) {
      // Recommendation forms: forward internally to the recommendation handler
      if (formType === 'recommendation') {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
        const recUrl = `${baseUrl}/api/webhooks/datascope/recommendation`
        console.info('[datascope-webhook] forwarding recommendation form', { form_id: String(formId), recUrl })
        const recRes = await fetch(recUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rawPayload),
        })
        const recData = await recRes.json()
        return NextResponse.json(recData, { status: recRes.status })
      }

      const reason = `Unsupported Datascope form type for audit scoring: ${formType}`
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

    const getRealLocalCodeForResponseSeq =
      String(formId) === ENEX_3_0_FORM_ID
        ? (await import('@/lib/enex/webhook-local-csv-mapping')).getRealLocalCodeForDatascopeResponse
        : () => null

    // 5. Find location by code — try multiple strategies in order of reliability:
    //   1) Leading digits from assign_loc_code (e.g. "26-NAME" → "26")
    //   2) Full assign_loc_code stripped of trailing dash/space
    //   3) Leading digits from assign_loc_name (e.g. "110- NAME" → "110")
    //   4) The raw code field
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
    // Extract leading code from assign_loc_name (e.g. "294- COOP..." → "294")
    if (assignLocName && assignLocName.length > 0 && assignLocName !== 'undefined') {
      const parsed = extractLeadingCode(String(assignLocName))
      if (parsed) codesToTry.push(parsed)
    }
    // ENEX 3.0: `code` is the DataScope response sequence, not the real local code.
    // Prefer CSV mapping (same source as scripts/fix-stub-locations.js) before matching stubs.
    if (String(formId) === ENEX_3_0_FORM_ID) {
      const mappedReal = getRealLocalCodeForResponseSeq(String(locationCode))
      if (mappedReal) {
        codesToTry.push(mappedReal)
      }
    }
    codesToTry.push(String(locationCode).replace(/[-\s]+$/, ''))
    codesToTry.push(String(locationCode))
    const uniqueCodes = [...new Set(codesToTry)]

    let location: { id: string; name: string | null; code: string } | null = null
    let matchedCode: string | null = null

    if (uniqueCodes.length > 0) {
      const { data: candidates } = await supabase
        .from('locations')
        .select('id, name, code')
        .in('code', uniqueCodes)

      if (candidates && candidates.length > 0) {
        for (const code of uniqueCodes) {
          const found = candidates.find((c) => c.code === code)
          if (found) {
            location = found
            matchedCode = code
            break
          }
        }
      }
    }

    // Fallback: still hit a stub if CSV was missing/outdated — remap to real local when possible
    if (
      location &&
      String(formId) === ENEX_3_0_FORM_ID &&
      location.name != null &&
      location.name.startsWith('Local ENEX ')
    ) {
      const mappedReal = getRealLocalCodeForResponseSeq(String(locationCode))
      if (mappedReal) {
        const { data: realLoc } = await supabase
          .from('locations')
          .select('id, name, code')
          .eq('code', mappedReal)
          .not('name', 'like', 'Local ENEX %')
          .maybeSingle()
        if (realLoc) {
          location = realLoc
          matchedCode = mappedReal
        }
      }
    }

    if (!location) {
      console.warn('[datascope-webhook] location not found', {
        form_id: String(formId),
        location_code: String(locationCode),
        tried_codes: uniqueCodes,
      })
      await logWebhook(supabase, {
        form_id: String(formId),
        form_name: formName,
        location_code: String(locationCode),
        status: 'error',
        error_message: `Location not found for code: ${locationCode} (also tried: ${uniqueCodes.join(', ')})`,
        raw_payload: rawPayload as Record<string, unknown>,
      })
      return NextResponse.json({ error: `Location not found: ${locationCode}` }, { status: 200 })
      // Return 200 so Datascope doesn't retry
    }

    console.info('[datascope-webhook] location matched', {
      form_id: String(formId),
      location_id: location.id,
      matched_code: matchedCode,
    })

    // 6. Get active pillar tree with all questions and options
    const { data: tree } = await supabase
      .from('pillar_trees')
      .select(`
        id,
        pillars (
          id, name, weight, sort_order,
          questions (
            id, identifier, title, weight, sort_order,
            datascope_question_id, datascope_question_name,
            question_type, price_pair_group,
            question_options (id, label, value, datascope_value, sort_order)
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

    // 7. Build lookup maps
    // Map datascope_question_id → question record (with options)
    type QuestionWithOptions = {
      id: string
      identifier: string
      datascope_question_name: string | null
      question_type: string | null
      price_pair_group: string | null
      question_options: Array<{ id: string; label: string; value: number; datascope_value: string | null }>
    }
    const questionByDatascopeId = new Map<number, QuestionWithOptions>()
    const questionByName = new Map<string, QuestionWithOptions>()
    const questionByIdentifier = new Map<string, QuestionWithOptions>()
    const allQuestions: QuestionWithOptions[] = []

    for (const pillar of tree.pillars ?? []) {
      for (const q of pillar.questions ?? []) {
        allQuestions.push(q)
        if (q.identifier) questionByIdentifier.set(q.identifier, q)
        if (q.datascope_question_id != null) {
          questionByDatascopeId.set(q.datascope_question_id, q)
        }
        if (q.datascope_question_name) {
          questionByName.set(normalizeDatascopeText(q.datascope_question_name), q)
          // Also index by the name with the "(con sello Enex)" annotation stripped,
          // so the 2.0 B2C form (which always carries that suffix) matches the same
          // tree question by name without needing duplicated rows.
          questionByName.set(
            normalizeDatascopeText(stripDatascopeNameAnnotations(q.datascope_question_name)),
            q
          )
        }
      }
    }

    // 8. Process each answer
    const auditAnswerRows: Array<{
      question_id: string | null
      raw_value: string
      selected_option_id: string | null
    }> = []

    const photoRows: Array<{
      question_id: string | null
      datascope_question_id: number
      photo_url: string
      label: string | null
    }> = []

    const unmappedQuestions: Array<Record<string, unknown>> = []

    // Collect price data for comparison: price_pair_group → { shell?: number, competitor?: number }
    const priceData = new Map<string, { shellQuestionId?: string; shellPrice?: number; competitorPrice?: number }>()

    // Track matched option values by question identifier (for synthetic EXH-07 computation)
    const identifierValues = new Map<string, number>()

    // Track raw answer values by datascope question_id (for EXH-08 buen estado computation)
    const BUEN_ESTADO_QIDS = new Set([18, 108, 133, 135])
    const bienEstadoByQid = new Map<number, string>()

    for (const answer of answers) {
      const normalizedAnswerName = normalizeDatascopeText(answer.name)
      const strippedAnswerName = normalizeDatascopeText(
        stripDatascopeNameAnnotations(answer.name)
      )
      const question =
        questionByDatascopeId.get(answer.question_id) ??
        questionByName.get(normalizedAnswerName) ??
        questionByName.get(strippedAnswerName)

      // Capture buen estado answers regardless of tree mapping (used for EXH-08)
      if (answer.question_id && BUEN_ESTADO_QIDS.has(answer.question_id) && answer.value) {
        bienEstadoByQid.set(answer.question_id, String(answer.value))
      }

      if (!question) {
        // Unmapped question — still capture photos even without a tree mapping
        if (answer.type === 'photo') {
          photoRows.push({
            question_id: null,
            datascope_question_id: answer.question_id,
            photo_url: answer.value,
            label: answer.name || answer.label,
          })
        }
        unmappedQuestions.push({
          key: answer.name,
          question_id: answer.question_id,
          type: answer.type,
          value: answer.value,
          label: answer.label,
        })
        continue
      }

      const qType = question.question_type || 'multi_option'

      if (answer.type === 'photo' || qType === 'photo') {
        // Store photo — use answer.name (specific question field name, e.g. "Foto mueble Shell")
        // NOT answer.label (section name, e.g. "Exhibición y POP") which breaks bucket matching.
        photoRows.push({
          question_id: question.id,
          datascope_question_id: answer.question_id,
          photo_url: answer.value,
          label: answer.name || answer.label,
        })
        continue
      }

      if (qType === 'price_comparison' && question.price_pair_group) {
        // Shell product price — accumulate for later comparison
        const group = question.price_pair_group
        const existing = priceData.get(group) || {}
        existing.shellPrice = parseFloat(answer.value) || 0
        existing.shellQuestionId = question.id
        priceData.set(group, existing)
        // Also store raw answer
        auditAnswerRows.push({
          question_id: question.id,
          raw_value: answer.value,
          selected_option_id: null, // Will be set after price comparison
        })
        continue
      }

      if (qType === 'number' && question.price_pair_group) {
        // Competitor price — accumulate
        const group = question.price_pair_group
        const existing = priceData.get(group) || {}
        existing.competitorPrice = parseFloat(answer.value) || 0
        priceData.set(group, existing)
        // Store raw answer for the competitor question (weight=0, just for record)
        auditAnswerRows.push({
          question_id: question.id,
          raw_value: answer.value,
          selected_option_id: null,
        })
        continue
      }

      // Standard multi_option or text — match by datascope_value
      let matchedOptionId: string | null = null
      if (question.question_options?.length) {
        const exactMatch = question.question_options.find(
          (opt) => opt.datascope_value === answer.value
        )
        if (exactMatch) {
          matchedOptionId = exactMatch.id
        } else {
          // Try case-insensitive match
          const looseMatch = question.question_options.find(
            (opt) => normalizeDatascopeOptionValue(opt.datascope_value) === normalizeDatascopeOptionValue(answer.value)
          )
          if (looseMatch) {
            matchedOptionId = looseMatch.id
          } else if (qType !== 'text') {
            // Log option mismatches for scorable questions (not free-text)
            console.warn('[datascope-webhook] option-no-match', {
              form_id: String(formId),
              datascope_question_id: answer.question_id,
              question_identifier: question.identifier ?? null,
              received_value: answer.value,
              available_datascope_values: question.question_options.map((o) => o.datascope_value),
            })
          }
        }
      }

      // Track numeric option value for synthetic computations (e.g. EXH-07 Pack Ideal)
      if (matchedOptionId && question.identifier) {
        const opt = question.question_options.find((o) => o.id === matchedOptionId)
        if (opt != null) identifierValues.set(question.identifier, Number(opt.value))
      }

      auditAnswerRows.push({
        question_id: question.id,
        raw_value: answer.value,
        selected_option_id: matchedOptionId,
      })
    }

    // 9. Process price comparisons
    for (const [group, data] of priceData.entries()) {
      if (
        data.shellQuestionId &&
        data.shellPrice != null &&
        data.competitorPrice != null
      ) {
        const score = computePriceScore(
          group as PricePairGroup,
          data.shellPrice,
          data.competitorPrice
        )
        const optionValue = scoreToOptionValue(score)

        // Find the shell question and match to computed option
        const shellQuestion = questionByDatascopeId.get(
          // Find the datascope_question_id for this shell question
          [...questionByDatascopeId.entries()].find(([, q]) => q.id === data.shellQuestionId)?.[0] || 0
        )

        if (shellQuestion) {
          const matchedOption = shellQuestion.question_options.find(
            (opt) => opt.datascope_value === optionValue
          )
          if (matchedOption) {
            // Update the already-inserted answer row
            const existingAnswer = auditAnswerRows.find(
              (a) => a.question_id === data.shellQuestionId
            )
            if (existingAnswer) {
              existingAnswer.selected_option_id = matchedOption.id
            }
          }
        }
      }
    }

    // 9b. Synthetic EXH-07: Pack Ideal
    // Only applies to form 664005 (ENEX 3.0) — computed from EXH-01/03/05/06 all present (=100)
    if (String(formId) === ENEX_3_0_FORM_ID) {
      const exh07Q = questionByIdentifier.get('EXH-07')
      if (exh07Q && !auditAnswerRows.find((r) => r.question_id === exh07Q.id)) {
        const packBase =
          identifierValues.get('EXH-01') === 100 &&
          identifierValues.get('EXH-03') === 100 &&
          identifierValues.get('EXH-05') === 100 &&
          identifierValues.get('EXH-06') === 100
        const exh07Score = packBase ? 100 : 0
        const exh07Opt = exh07Q.question_options.find(
          (o) => Math.round(Number(o.value)) === exh07Score
        )
        auditAnswerRows.push({
          question_id: exh07Q.id,
          raw_value: exh07Opt?.label ?? String(exh07Score),
          selected_option_id: exh07Opt?.id ?? null,
        })
        console.info('[datascope-webhook] EXH-07 Pack Ideal computed', {
          audit_location: location.id,
          exh01: identifierValues.get('EXH-01'),
          exh03: identifierValues.get('EXH-03'),
          exh05: identifierValues.get('EXH-05'),
          exh06: identifierValues.get('EXH-06'),
          pack_base: packBase,
          exh07_score: exh07Score,
        })
      }

      // 9c. Synthetic EXH-08: Todos en buen estado
      // Computed from 4 "buen estado" qids: 18 (cartel nombre), 108 (mueble), 133 (pendón Helix), 135 (pendón Rímula)
      // All Si/Buen estado → 100 | Some No → 33 | All No/absent → 0
      const exh08Q = questionByIdentifier.get('EXH-08')
      if (exh08Q && !auditAnswerRows.find((r) => r.question_id === exh08Q.id)) {
        const BUEN_ESTADO_QIDS = [18, 108, 133, 135]
        const isSi = (v: unknown) =>
          v != null && /^(si|buen estado)/i.test(String(v).trim())

        const bienEstadoRaws = BUEN_ESTADO_QIDS.map((qid) => bienEstadoByQid.get(qid))
        const answered = bienEstadoRaws.filter((v) => v !== undefined)
        const siCount = answered.filter(isSi).length

        let exh08Score: number
        if (answered.length === 0 || siCount === 0) exh08Score = 0
        else if (siCount === BUEN_ESTADO_QIDS.length) exh08Score = 100
        else exh08Score = 33

        const exh08Opt = exh08Q.question_options.find(
          (o) => Math.round(Number(o.value)) === exh08Score
        )
        auditAnswerRows.push({
          question_id: exh08Q.id,
          raw_value: exh08Opt?.label ?? String(exh08Score),
          selected_option_id: exh08Opt?.id ?? null,
        })
        console.info('[datascope-webhook] EXH-08 Buen estado computed', {
          audit_location: location.id,
          answered_count: answered.length,
          si_count: siCount,
          exh08_score: exh08Score,
        })
      }
    }

    // 10. Insert audit
    const auditedAt = createdAt
      ? new Date(createdAt.replace(' ', 'T') + ':00').toISOString()
      : new Date().toISOString()

    // REGLA BIBLIA: días 1-3 de cada mes cuentan al mes anterior.
    const auditedDate = new Date(auditedAt)
    const dayOfMonth = auditedDate.getUTCDate()
    let effectiveMonth: string | null = null
    if (dayOfMonth >= 1 && dayOfMonth <= 3) {
      const y = auditedDate.getUTCFullYear()
      const m = auditedDate.getUTCMonth() // 0-based
      const prev = new Date(Date.UTC(y, m - 1, 1))
      effectiveMonth = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`
    }

    // Form 664005 → pending_review (AI will review before scoring)
    const isEnex30 = String(formId) === ENEX_3_0_FORM_ID
    const initialStatus = isEnex30 ? 'pending_review' : 'pending'

    // Try to find an existing audit (edit case: Datascope re-sends the same pdf_url).
    // When found, we UPDATE the existing row and re-insert answers/photos/score,
    // but we DO NOT trigger AI review again (AI runs only once per audit).
    let isUpdate = false
    let auditId: string | null = null

    if (pdfUrl) {
      const { data: existing } = await supabase
        .from('audits')
        .select('id')
        .eq('datascope_form_id', String(formId))
        .eq('pdf_url', pdfUrl)
        .maybeSingle()
      if (existing?.id) {
        isUpdate = true
        auditId = existing.id
      }
    }

    let auditError: { code?: string; message: string } | null = null

    if (isUpdate && auditId) {
      // Update existing audit metadata (preserve status — don't reset AI review decisions)
      const { error } = await supabase
        .from('audits')
        .update({
          auditor_name: userInfo?.user_name ?? null,
          auditor_email: userInfo?.username ?? null,
          raw_data: rawPayload as Record<string, unknown>,
          audited_at: auditedAt,
        })
        .eq('id', auditId)
      if (error) auditError = error

      // Clear existing answers/photos so we can re-insert with the edited data
      await supabase.from('audit_answers').delete().eq('audit_id', auditId)
      await supabase.from('audit_photos').delete().eq('audit_id', auditId)
    } else {
      const { data: audit, error } = await supabase
        .from('audits')
        .insert({
          location_id: location.id,
          audit_type: 'audit' as const,
          status: initialStatus,
          tree_version_id: tree.id,
          datascope_form_id: String(formId),
          auditor_name: userInfo?.user_name ?? null,
          auditor_email: userInfo?.username ?? null,
          pdf_url: pdfUrl ?? null,
          raw_data: rawPayload as Record<string, unknown>,
          audited_at: auditedAt,
          effective_month: effectiveMonth,  // null excepto para visitas del 1-3
          reviewed_at: null,
        })
        .select('id')
        .single()
      auditError = error
      auditId = audit?.id ?? null
    }

    if (auditError || !auditId) {
      await logWebhook(supabase, {
        form_id: String(formId),
        form_name: formName,
        location_code: String(locationCode),
        status: 'error',
        error_message: `Failed to ${isUpdate ? 'update' : 'create'} audit: ${auditError?.message}`,
        raw_payload: rawPayload as Record<string, unknown>,
      })
      return NextResponse.json({ error: `Failed to ${isUpdate ? 'update' : 'create'} audit` }, { status: 200 })
    }

    // Unified alias so the rest of the flow uses { id } as before
    const audit = { id: auditId }

    // 11. Insert audit answers
    const mappedAnswerCount = auditAnswerRows.filter((r) => r.selected_option_id != null).length
    console.info('[datascope-webhook] mapping summary', {
      audit_id: audit.id,
      form_id: String(formId),
      payload_questions: answers.length,
      tree_questions: allQuestions.length,
      mapped_to_tree: auditAnswerRows.length,
      with_option_match: mappedAnswerCount,
      unmapped: unmappedQuestions.length,
      photos: photoRows.length,
    })

    if (auditAnswerRows.length > 0) {
      const rows = auditAnswerRows.map((a) => ({
        audit_id: audit.id,
        question_id: a.question_id,
        raw_value: a.raw_value,
        selected_option_id: a.selected_option_id,
      }))

      const { error: answersError } = await supabase
        .from('audit_answers')
        .insert(rows)

      if (answersError) {
        console.error('[datascope-webhook] failed to insert audit answers', {
          audit_id: audit.id,
          error: answersError.message,
          code: answersError.code,
        })
      }
    }

    // 12. Insert photos
    if (photoRows.length > 0) {
      const rows = photoRows.map((p) => ({
        audit_id: audit.id,
        question_id: p.question_id,
        datascope_question_id: p.datascope_question_id,
        photo_url: p.photo_url,
        label: p.label,
      }))

      const { error: photosError } = await supabase
        .from('audit_photos')
        .insert(rows)

      if (photosError) {
        console.error('Failed to insert audit photos:', photosError)
      }
    }

    // 13. Calculate score — always attempt, even if some answers lack options
    // (e.g. competitor price inputs with weight=0 won't have selected_option_id)
    try {
      console.info('[datascope-webhook] starting score calculation', {
        audit_id: audit.id,
        location_id: location.id,
        tree_version_id: tree.id,
        form_id: String(formId),
        answers_count: auditAnswerRows.length,
        mapped_answer_count: mappedAnswerCount,
        photos_count: photoRows.length,
        unmapped_count: unmappedQuestions.length,
      })

      const { data: score, error: scoreError } = await supabase.rpc(
        'calculate_audit_score',
        { p_audit_id: audit.id }
      )

      if (scoreError) {
        console.error('[datascope-webhook] score calculation failed', {
          audit_id: audit.id,
          location_id: location.id,
          tree_version_id: tree.id,
          form_id: String(formId),
          answers_count: auditAnswerRows.length,
          mapped_answer_count: mappedAnswerCount,
          reason: scoreError.message,
        })
      } else {
        const { data: persistedScore } = await supabase
          .from('scores')
          .select('audit_id, total_score, calculated_at')
          .eq('audit_id', audit.id)
          .maybeSingle()

        console.info('[datascope-webhook] score calculation finished', {
          audit_id: audit.id,
          location_id: location.id,
          tree_version_id: tree.id,
          form_id: String(formId),
          answers_count: auditAnswerRows.length,
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

    // 13b. Sync con Mystery Shopper (si ya existe un rec-652647 del mismo local/mes,
    // copiar REC-01/02/03 al audit principal y recalcular score). Solo aplica a
    // Perfect Store Enex 3.0 (664005) — el form 649132 histórico no lleva esta lógica.
    if (String(formId) === ENEX_3_0_FORM_ID) {
      try {
        const month = auditedAt.slice(0, 7)
        const result = await syncMysteryToPerfectStore(supabase, location.id, month)
        console.info('[datascope-webhook] mystery sync result', {
          audit_id: audit.id,
          location_id: location.id,
          month,
          result,
        })
      } catch (e) {
        console.error('[datascope-webhook] mystery sync failed', {
          audit_id: audit.id,
          error: (e as Error).message,
        })
      }
    }

    // 14. Log webhook
    await logWebhook(supabase, {
      form_id: String(formId),
      form_name: formName,
      location_code: String(locationCode),
      status: unmappedQuestions.length > 0 ? 'partial' : 'success',
      audit_id: audit.id,
      unmapped_questions: unmappedQuestions.length > 0 ? unmappedQuestions : null,
      raw_payload: rawPayload as Record<string, unknown>,
    })

    // 15/16. Trigger AI review and opportunity analysis AFTER the response is sent.
    // `after()` keeps the serverless function alive so these fire-and-forget fetches
    // actually complete (plain `fetch(...).catch(...)` is killed when the handler returns).
    // IMPORTANT: AI review only runs on NEW audits (not edits/updates).
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const auditIdForAfter = audit.id
    const locationIdForAfter = location.id
    const shouldReviewAI = isEnex30 && !isUpdate
    after(async () => {
      if (shouldReviewAI) {
        try {
          await fetch(`${baseUrl}/api/audits/${auditIdForAfter}/review`, { method: 'POST' })
        } catch (e) {
          console.error('[datascope-webhook] failed to trigger AI review', { audit_id: auditIdForAfter, error: e })
        }
      }
      try {
        await fetch(`${baseUrl}/api/locations/${locationIdForAfter}/analyze-opportunities`, { method: 'POST' })
      } catch (e) {
        console.error('[datascope-webhook] failed to trigger opportunity analysis', { location_id: locationIdForAfter, error: e })
      }
    })

    return NextResponse.json({
      audit_id: audit.id,
      answers_count: auditAnswerRows.length,
      photos_count: photoRows.length,
      unmapped_count: unmappedQuestions.length,
    }, { status: 200 })

  } catch (error) {
    console.error('Datascope webhook error:', error)
    await logWebhook(supabase, {
      status: 'error',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      raw_payload: rawPayload as Record<string, unknown>,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 200 })
    // Return 200 to avoid Datascope retries on server errors
  }
}

// Helper to insert webhook log
async function logWebhook(
  supabase: ReturnType<typeof createAdminClient>,
  data: {
    form_id?: string | null
    form_name?: string | null
    location_code?: string | null
    status: string
    audit_id?: string | null
    unmapped_questions?: Record<string, unknown>[] | null
    error_message?: string | null
    raw_payload?: Record<string, unknown> | null
  }
) {
  try {
    await supabase.from('webhook_logs').insert({
      form_id: data.form_id ?? null,
      form_name: data.form_name ?? null,
      location_code: data.location_code ?? null,
      status: data.status,
      audit_id: data.audit_id ?? null,
      unmapped_questions: data.unmapped_questions ?? null,
      error_message: data.error_message ?? null,
      raw_payload: data.raw_payload ?? null,
    })
  } catch (e) {
    console.error('Failed to log webhook:', e)
  }
}
