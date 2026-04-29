import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  analyzeLocationOpportunities,
  type AuditHistoryEntry,
  type ExistingOpportunity,
} from '@/lib/opportunities/ai-analysis'

// ─── Types ──────────────────────────────────────────────────────────────────

type AnswerRow = {
  raw_value: string
  question: { identifier: string; title: string } | null
}

type PhotoRow = {
  photo_url: string
  label: string | null
  question: { identifier: string } | null
}

type AuditRow = {
  id: string
  audited_at: string | null
  auditor_name: string | null
  created_at: string
  audit_answers: AnswerRow[]
  audit_photos: PhotoRow[]
}

// ─── Main handler ───────────────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: locationId } = await params
  const supabase = createAdminClient()

  // 1. Fetch location
  const { data: location, error: locErr } = await supabase
    .from('locations')
    .select('id, name, code, category')
    .eq('id', locationId)
    .single()

  if (locErr || !location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  // 2. Fetch all audits with answers and photos (newest first)
  const { data: audits } = await supabase
    .from('audits')
    .select(`
      id, audited_at, auditor_name, created_at,
      audit_answers(raw_value, question:questions(identifier, title)),
      audit_photos(photo_url, label, question:questions(identifier))
    `)
    .eq('location_id', locationId)
    .order('audited_at', { ascending: false, nullsFirst: false })
    .limit(20) // Last 20 audits max

  if (!audits || audits.length === 0) {
    return NextResponse.json({ message: 'No audits for this location', created: 0 })
  }

  // 3. Build history entries
  const history: AuditHistoryEntry[] = (audits as unknown as AuditRow[]).map(audit => {
    const answers = (audit.audit_answers ?? [])
      .filter((a: AnswerRow) => a.question)
      .map((a: AnswerRow) => ({
        identifier: a.question!.identifier,
        title: a.question!.title,
        raw_value: a.raw_value,
      }))

    const photos = (audit.audit_photos ?? []).map((p: PhotoRow) => ({
      url: p.photo_url,
      label: p.label,
      identifier: p.question?.identifier ?? null,
    }))

    // Extract comment fields
    const comments = answers
      .filter(a => a.identifier.toLowerCase().includes('comment') || a.title.toLowerCase().includes('comentario'))
      .map(a => a.raw_value)
      .filter(v => v && v !== 'Sin comentarios' && v !== '-')

    return {
      audit_id: audit.id,
      audited_at: audit.audited_at ?? audit.created_at,
      auditor_name: audit.auditor_name,
      answers,
      photos,
      comments,
    }
  })

  // 4. Fetch existing opportunities for this location
  const { data: existingOpps } = await supabase
    .from('opportunities')
    .select('id, category, description, review_status, status, occurrence_count, source')
    .eq('location_id', locationId)
    .not('status', 'in', '("cancelada")')
    .order('created_at', { ascending: false })

  const existing: ExistingOpportunity[] = (existingOpps ?? []).map(o => ({
    id: o.id,
    category: o.category,
    description: o.description,
    review_status: o.review_status ?? 'pending',
    status: o.status,
    occurrence_count: o.occurrence_count ?? 1,
    source: o.source,
  }))

  // 5. Run AI analysis
  const result = await analyzeLocationOpportunities({
    locationName: location.name,
    locationCode: location.code,
    locationCategory: location.category,
    history,
    existingOpportunities: existing,
  })

  if (!result) {
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 })
  }

  const latestAuditId = audits[0]?.id ?? null
  let created = 0
  let updated = 0
  let resolved = 0

  // 6. Upsert opportunities from AI
  for (const opp of result.opportunities) {
    if (!opp.category || opp.resolved) continue

    // Check if an active opportunity with this category exists
    const existingOpp = existing.find(
      e => e.category === opp.category && e.status !== 'ejecutada' && e.status !== 'cancelada'
    )

    if (existingOpp) {
      // Update existing: bump occurrence_count, update description if different
      await supabase
        .from('opportunities')
        .update({
          occurrence_count: (existingOpp.occurrence_count ?? 1) + 1,
          last_seen_at: new Date().toISOString(),
          triggering_audit_id: latestAuditId,
          ai_reasoning: opp.reasoning,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingOpp.id)
      updated++
    } else {
      // Insert new opportunity
      await supabase
        .from('opportunities')
        .insert({
          location_id: locationId,
          category: opp.category,
          description: opp.description,
          ai_reasoning: opp.reasoning,
          source: 'ai_suggestion',
          status: 'por_validar',
          review_status: 'pending',
          triggering_audit_id: latestAuditId,
          occurrence_count: 1,
          last_seen_at: new Date().toISOString(),
        })
      created++
    }
  }

  // 7. Resolve opportunities the AI says are no longer needed
  for (const res of result.resolved) {
    if (!res.category) continue
    const existingOpp = existing.find(
      e => e.category === res.category && e.status !== 'ejecutada' && e.status !== 'cancelada'
    )
    if (existingOpp) {
      await supabase
        .from('opportunities')
        .update({
          status: 'ejecutada',
          ai_reasoning: `Resuelto: ${res.reasoning}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingOpp.id)
      resolved++
    }
  }

  console.info('[opportunity-analysis] done', {
    location_id: locationId,
    location_code: location.code,
    created,
    updated,
    resolved,
    total_opportunities: result.opportunities.length,
  })

  return NextResponse.json({
    location_id: locationId,
    created,
    updated,
    resolved,
    summary: result.summary,
  })
}
