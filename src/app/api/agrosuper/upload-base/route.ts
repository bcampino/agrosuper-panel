import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'

export const maxDuration = 60

// ── Helpers ───────────────────────────────────────────────────────────────
function findColumn(headers: string[], keywords: string[]): number {
  return headers.findIndex(h => keywords.some(k => String(h || '').toLowerCase().includes(k.toLowerCase())))
}

function isYes(value: unknown): boolean {
  return value != null && String(value).trim().toLowerCase() === 'si'
}

function hasPhoto(value: unknown): boolean {
  return value != null && String(value).startsWith('http')
}

function parseDate(value: unknown): string {
  if (!value) return new Date().toISOString()
  const s = String(value).trim()

  // Try d/m/yyyy h:mm:ss format
  if (s.includes('/')) {
    const match = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (match) {
      const [, dd, mm, yyyy] = match
      return new Date(`${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`).toISOString()
    }
  }

  // Try dd-mm-yyyy format
  if (s.includes('-') && /^\d{2}-\d{2}-\d{4}/.test(s)) {
    const [dd, mm, yyyy] = s.split('-')
    return new Date(`${yyyy}-${mm}-${dd}`).toISOString()
  }

  // Try ISO format
  try {
    return new Date(s).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

// ── Parse Excel Row ───────────────────────────────────────────────────────
interface ParsedAudit {
  location_id: string
  location_name: string
  submitted_at: string
  form_number?: number
  implementer_name: string
  answers: Record<string, any>
}

function parseRow(row: unknown[], headers: string[]): ParsedAudit | null {
  // Find key columns
  const idIdx = findColumn(headers, ['assign id', 'assigned_location_code', 'código formulario', 'form_id'])
  const nameIdx = findColumn(headers, ['assign location', 'assigned_location', 'lugar detectado'])
  const dateIdx = findColumn(headers, ['fecha', 'submitted_date', 'created'])
  const userIdx = findColumn(headers, ['nombre usuario', 'nombre impl', 'user', '¿cuál es tu nombre'])
  const formIdx = findColumn(headers, ['código formulario', 'form_id'])

  if (idIdx === -1 || nameIdx === -1) return null

  const locationId = String(row[idIdx] || '').trim()
  const locationName = String(row[nameIdx] || '').trim()

  if (!locationId || !locationName) return null

  // Extract implementer name (try multiple columns)
  let implementerName = 'Auditor'
  for (const idx of [userIdx, userIdx + 1, userIdx + 2]) {
    if (idx >= 0 && row[idx]) {
      implementerName = String(row[idx]).trim()
      break
    }
  }

  // Extract form number
  const formNumber = formIdx >= 0 ? Number(row[formIdx]) : undefined

  return {
    location_id: locationId,
    location_name: locationName,
    submitted_at: dateIdx >= 0 ? parseDate(row[dateIdx]) : new Date().toISOString(),
    form_number: formNumber,
    implementer_name: implementerName,
    answers: extractAnswers(row, headers),
  }
}

// ── Extract answers from row ──────────────────────────────────────────────
function extractAnswers(row: unknown[], headers: string[]): Record<string, any> {
  const answers: Record<string, any> = {}

  // Map question patterns to their indices and groups
  const patterns = [
    { key: 'bandeja_jamon_lc', patterns: ['bandeja', 'jamón', 'jamon'] },
    { key: 'logo_vitrina_lc', patterns: ['logo', 'vitrina'] },
    { key: 'colgante_recomendacion_lc', patterns: ['colgante', 'recomendación', 'recomendacion'] },
    { key: 'marca_precio_sc', patterns: ['marca', 'precio'] },
    { key: 'huincha_precio_sc', patterns: ['huincha', 'precio'] },
    { key: 'cartel_panaderia', patterns: ['cartel', 'panadería', 'panaderia'] },
    { key: 'portabolsas', patterns: ['porta bolsa', 'portabolsa'] },
    { key: 'bolsas_papel', patterns: ['bolsas', 'papel'] },
    { key: 'tenazas', patterns: ['tenazas'] },
    { key: 'paloma', patterns: ['paloma'] },
    { key: 'cenefa_lc', patterns: ['cenefa'] },
    { key: 'bandera_muro_lc', patterns: ['bandera', 'muro'] },
    { key: 'bandera_rutera_lc', patterns: ['bandera', 'rutera'] },
    { key: 'naipes', patterns: ['naipes'] },
    { key: 'calculadora', patterns: ['calculadora'] },
    { key: 'kit_bienvenida', patterns: ['kit', 'bienvenida'] },
  ]

  // For each header, try to match it to a pattern
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').toLowerCase()
    const value = row[i]

    // Skip non-question headers
    if (!header.includes('¿') && !header.includes('se implementó') && !header.includes('se entregó') && !header.includes('se entrego')) continue

    // Try to match patterns
    for (const pattern of patterns) {
      if (pattern.patterns.some(p => header.includes(p.toLowerCase()))) {
        if (header.includes('toma fotografía') || header.includes('foto')) {
          // This is a photo column
          answers[pattern.key] = answers[pattern.key] || { implementado: false }
          if (hasPhoto(value)) {
            answers[pattern.key].implementado = true
            answers[pattern.key].foto = String(value)
          }
        } else if (header.includes('indica razón') || header.includes('por qué')) {
          // This is a reason column
          if (value) {
            answers[pattern.key] = answers[pattern.key] || {}
            answers[pattern.key].razon = String(value)
          }
        } else {
          // This is a yes/no question
          answers[pattern.key] = { implementado: isYes(value) }
          // Try to find associated photo in nearby columns
          if (isYes(value) && i + 1 < headers.length && hasPhoto(row[i + 1])) {
            answers[pattern.key].foto = String(row[i + 1])
          }
        }
        break
      }
    }
  }

  return answers
}

// ── Handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const campaignId = formData.get('campaign_id') as string | null
  const baseNumber = Number(formData.get('base_number') || 1)

  if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
  if (!campaignId) return NextResponse.json({ error: 'campaign_id es requerido' }, { status: 400 })

  const supabase = createAdminClient()

  // Verify campaign exists
  const { data: campaign, error: campErr } = await supabase
    .from('agrosuper_campaigns')
    .select('id, name')
    .eq('id', campaignId)
    .single()

  if (campErr || !campaign) {
    return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  }

  // Parse Excel
  let audits: ParsedAudit[] = []
  try {
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown[][]

    const headers = (rows[0] as unknown[]).map(h => String(h || ''))
    audits = rows
      .slice(1)
      .map(row => parseRow(row, headers))
      .filter((a): a is ParsedAudit => a !== null)
  } catch (err) {
    return NextResponse.json({
      error: 'Error al procesar Excel',
      details: String(err),
    }, { status: 400 })
  }

  if (audits.length === 0) {
    return NextResponse.json({
      error: 'Sin filas válidas. Verifica que el Excel tenga columnas: ID, Nombre',
    }, { status: 400 })
  }

  // Upsert locations
  const uniqueLocs = [...new Map(audits.map(a => [a.location_id, { external_id: a.location_id, name: a.location_name }])).values()]
  const { error: locErr } = await supabase.from('locations').upsert(uniqueLocs, { onConflict: 'external_id' })
  if (locErr) {
    return NextResponse.json({ error: 'Error guardando locales', details: locErr.message }, { status: 500 })
  }

  // Get location IDs
  const { data: locations } = await supabase
    .from('locations')
    .select('id, external_id')
    .in('external_id', uniqueLocs.map(l => l.external_id))

  const locMap = new Map((locations || []).map(l => [l.external_id, l.id]))

  // Build audit inserts
  const auditInserts: object[] = []
  let skipped = 0

  for (const audit of audits) {
    const locationId = locMap.get(audit.location_id)
    if (!locationId) {
      skipped++
      continue
    }

    // Calculate metrics
    const implementados = Object.values(audit.answers).filter(a => a?.implementado).length
    const total = Object.keys(audit.answers).length
    const implementationRate = total > 0 ? Math.round((implementados / total) * 100) : 0

    auditInserts.push({
      location_id: locationId,
      implementer_name: audit.implementer_name,
      submitted_at: audit.submitted_at,
      form_number: audit.form_number,
      company: 'Treid SpA',
      status: 'calculated',
      implementation_rate: implementationRate,
      raw_payload: audit,
    })
  }

  // Batch insert audits
  const { data: inserted, error: auditErr } = await supabase.from('agrosuper_audits').insert(auditInserts).select('id')
  if (auditErr) {
    return NextResponse.json({ error: 'Error guardando registros', details: auditErr.message }, { status: 500 })
  }

  // Insert materials
  const allMats: object[] = []
  for (let i = 0; i < (inserted || []).length; i++) {
    const auditId = inserted[i].id
    const answers = audits[i].answers

    for (const [material, answer] of Object.entries(answers)) {
      if (answer?.implementado !== undefined) {
        allMats.push({
          audit_id: auditId,
          material: material.toUpperCase(),
          implemented: answer.implementado,
        })
      }
    }
  }

  for (let i = 0; i < allMats.length; i += 500) {
    const { error: mErr } = await supabase.from('agrosuper_materials').insert(allMats.slice(i, i + 500))
    if (mErr) {
      return NextResponse.json({ error: 'Error guardando materiales', details: mErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    success: true,
    imported: inserted?.length ?? 0,
    skipped,
    total: audits.length,
    base: baseNumber,
    campaignName: campaign.name,
  })
}
