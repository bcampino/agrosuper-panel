import { redirect } from 'next/navigation'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@/lib/supabase/server'
import { LocationProfile } from '@/components/locations/location-profile'
import { getLocationPhotos } from '@/lib/analytics/pillar-photos'
import type { Location, Score, LocationNote, Opportunity, Campaign, AuditStatus } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function LocationDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: location } = await supabase
    .from('locations')
    .select(
      '*, seller:users!seller_id(id,full_name,email,role), jz:users!jz_id(id,full_name,email,role), zone:zones(id,name,region), staff_vendedor:staff!staff_vendedor_id(*), staff_jz:staff!staff_jz_id(*), staff_gestor:staff!staff_gestor_id(*)'
    )
    .eq('id', id)
    .single()

  if (!location) {
    redirect('/locations')
  }

  // Scores since Aug 2025 (history start)
  const historyStart = new Date('2025-08-01T00:00:00.000Z')

  const [
    { data: scores },
    { data: notes },
    { data: audits },
    { data: campaignLocations },
    { data: opportunities },
  ] = await Promise.all([
    supabase
      .from('scores')
      .select('*, audit:audits!audit_id(audited_at)')
      .eq('location_id', id)
      .gte('calculated_at', historyStart.toISOString())
      .order('calculated_at', { ascending: true }),
    supabase
      .from('location_notes')
      .select('*, author:users!created_by(id,full_name)')
      .eq('location_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('audits')
      .select('id, audit_type, status, audited_at, auditor_name, created_at, datascope_form_id, pdf_url, suspended_at, edited_at, edit_note, edited_pillar_names')
      .eq('location_id', id)
      .is('suspended_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
    // Campaign locations
    supabase
      .from('campaign_locations')
      .select('id, campaign_id, result, notes, executed_at, campaign:campaigns!campaign_id(id, campaign_code, name, status, campaign_type, start_date, end_date)')
      .eq('location_id', id)
      .order('executed_at', { ascending: false }),
    // Opportunities
    supabase
      .from('opportunities')
      .select('*, creator:users!created_by(id,full_name)')
      .eq('location_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const auditIds = (audits ?? []).map((audit) => audit.id)

  const { data: auditAnswers } = auditIds.length > 0
    ? await supabase
        .from('audit_answers')
        .select('audit_id')
        .in('audit_id', auditIds)
    : { data: [] as { audit_id: string }[] }

  const answerCountByAuditId = new Map<string, number>()
  for (const answer of auditAnswers ?? []) {
    answerCountByAuditId.set(
      answer.audit_id,
      (answerCountByAuditId.get(answer.audit_id) ?? 0) + 1
    )
  }

  // Fetch all good photos for this location (fachada first, then rest, then winner)
  const locationPhotos = auditIds.length > 0 ? await getLocationPhotos(auditIds) : []

  // Get raw_data from last 5 audits for size/interest data (exclude suspended)
  const { data: auditDetails } = await supabase
    .from('audits')
    .select('id, raw_data, created_at')
    .eq('location_id', id)
    .is('suspended_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  // Deduplicate scores: one per month, keeping the latest by calculated_at
  const scoreByMonth = new Map<string, Score>()
  for (const s of (scores ?? []) as Score[]) {
    const dateStr = (s as Score & { audit?: { audited_at?: string } }).audit?.audited_at ?? s.calculated_at
    const month = (dateStr ?? '').slice(0, 7)
    if (!month) continue
    const existing = scoreByMonth.get(month)
    if (!existing || (s.calculated_at ?? '') > (existing.calculated_at ?? '')) {
      scoreByMonth.set(month, s)
    }
  }
  const deduplicatedScores = [...scoreByMonth.values()].sort(
    (a, b) => {
      const da = (a as Score & { audit?: { audited_at?: string } }).audit?.audited_at ?? a.calculated_at ?? ''
      const db = (b as Score & { audit?: { audited_at?: string } }).audit?.audited_at ?? b.calculated_at ?? ''
      return da.localeCompare(db)
    }
  )

  // Load AI panel markdown for this location (if generated)
  let aiPanel: string | null = null
  try {
    const panelsDir = resolve(process.cwd(), 'scripts', 'output', 'panels')
    const code = String(location.code ?? '').padStart(3, '0')
    const files = readdirSync(panelsDir).filter(f => f.startsWith(code + '-') && f.endsWith('.md'))
    if (files[0]) {
      aiPanel = readFileSync(resolve(panelsDir, files[0]), 'utf8')
    }
  } catch {
    // No panel file yet — show nothing
  }

  return (
    <LocationProfile
      location={location as Location}
      scores={deduplicatedScores}
      notes={(notes as LocationNote[]) ?? []}
      audits={((audits ?? []) as {
        id: string
        audit_type: string
        status: AuditStatus
        audited_at: string | null
        auditor_name: string | null
        created_at: string
        datascope_form_id: string | null
        pdf_url: string | null
        edited_at: string | null
        edit_note: string | null
        edited_pillar_names: string[] | null
      }[]).map((audit) => ({
        ...audit,
        answer_count: answerCountByAuditId.get(audit.id) ?? 0,
      }))}
      locationPhotos={locationPhotos}
      campaignLocations={(campaignLocations ?? []).map((cl: Record<string, unknown>) => ({
        ...cl,
        campaign: Array.isArray(cl.campaign) ? cl.campaign[0] ?? null : cl.campaign ?? null,
      })) as never[]}
      opportunities={(opportunities as Opportunity[]) ?? []}
      auditDetails={auditDetails ?? []}
      aiPanel={aiPanel}
    />
  )
}
