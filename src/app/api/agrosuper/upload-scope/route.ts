import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'

export const maxDuration = 60

interface ScopeRow {
  externalId: string
  name: string
  address?: string
  region?: string
}

// ── Excel helpers ─────────────────────────────────────────────────────────────
function normalizeName(name: string): string {
  return String(name || '').trim().toLowerCase()
}

function parseExcel(rows: unknown[][]): ScopeRow[] {
  if (rows.length < 2) return []

  const headers = (rows[0] as unknown[]).map(h => normalizeName(String(h || '')))
  const dataRows = rows.slice(1).filter(r => r && r.length > 0)

  // Find column indices by header matching
  const idIdx = headers.findIndex(h => h.includes('id') || h.includes('código') || h.includes('external'))
  const nameIdx = headers.findIndex(h => h.includes('nombre') || h.includes('local'))
  const addressIdx = headers.findIndex(h => h.includes('dirección') || h.includes('address') || h.includes('domicilio'))
  const regionIdx = headers.findIndex(h => h.includes('región') || h.includes('region') || h.includes('comuna'))

  if (idIdx === -1 || nameIdx === -1) {
    throw new Error(`No se encontraron columnas esperadas. Encontradas: ${headers.join(', ')}`)
  }

  return dataRows
    .map((row: any) => ({
      externalId: String(row[idIdx] || '').trim(),
      name: String(row[nameIdx] || '').trim(),
      address: addressIdx >= 0 ? String(row[addressIdx] || '').trim() : undefined,
      region: regionIdx >= 0 ? String(row[regionIdx] || '').trim() : undefined,
    }))
    .filter(r => r.externalId && r.name)
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const campaignId = formData.get('campaign_id') as string | null
  const baseNumber = Number(formData.get('base_number') || 1)

  if (!file) return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
  if (!campaignId) return NextResponse.json({ error: 'campaign_id es requerido' }, { status: 400 })

  const supabase = createAdminClient()

  // ── Verify campaign exists ──────────────────────────────────────────────────
  const { data: campaign, error: campErr } = await supabase
    .from('agrosuper_campaigns')
    .select('id, name')
    .eq('id', campaignId)
    .single()

  if (campErr || !campaign) {
    return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  }

  // ── Parse Excel ─────────────────────────────────────────────────────────────
  let scopeRows: ScopeRow[] = []
  try {
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown[][]
    scopeRows = parseExcel(rows)
  } catch (err) {
    return NextResponse.json({
      error: 'Error al procesar Excel',
      details: String(err),
    }, { status: 400 })
  }

  if (scopeRows.length === 0) {
    return NextResponse.json({
      error: 'Sin filas válidas. Verifica que el Excel tenga columnas: ID, Nombre (mínimo)',
    }, { status: 400 })
  }

  // ── Upsert locations ────────────────────────────────────────────────────────
  const uniqueLocs = [...new Map(scopeRows.map(r => [r.externalId, r])).values()]

  const locUpserts = uniqueLocs.map(r => ({
    external_id: r.externalId,
    name: r.name,
    address: r.address,
    region: r.region,
    active: true,
  }))

  const { error: locErr } = await supabase.from('locations').upsert(locUpserts, { onConflict: 'external_id' })
  if (locErr) {
    return NextResponse.json({ error: 'Error guardando locales', details: locErr.message }, { status: 500 })
  }

  // ── Get location IDs ────────────────────────────────────────────────────────
  const { data: locations } = await supabase
    .from('locations')
    .select('id, external_id')
    .in('external_id', uniqueLocs.map(l => l.externalId))

  const locMap = new Map((locations || []).map(l => [l.external_id, l.id]))

  // ── Insert scopes ──────────────────────────────────────────────────────────
  const scopeInserts = uniqueLocs
    .map(r => ({ campaign_id: campaignId, location_id: locMap.get(r.externalId), base_number: baseNumber }))
    .filter(s => s.location_id)

  if (scopeInserts.length === 0) {
    return NextResponse.json({ error: 'No se pudieron procesar los locales' }, { status: 400 })
  }

  const { error: scopeErr } = await supabase
    .from('agrosuper_campaign_scopes')
    .upsert(scopeInserts, { onConflict: 'campaign_id,location_id,base_number' })

  if (scopeErr) {
    return NextResponse.json({ error: 'Error guardando scope', details: scopeErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    imported: scopeInserts.length,
    total: scopeRows.length,
    base: baseNumber,
    campaignName: campaign.name,
  })
}
