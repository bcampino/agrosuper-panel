import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUserRoles } from '@/lib/api/route-guards'

interface ParsedRow {
  code: string
  name: string
  address: string | null
  region: string | null
  city: string | null
  category: string | null
  status: string | null
  sa_status: string | null
  subsegment: string | null
  jz_name: string | null
  vendedor_name: string | null
  gestor_name: string | null
}

function parseName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { first_name: parts[0], last_name: '' }
  const last_name = parts.pop()!
  return { first_name: parts.join(' '), last_name }
}

async function resolveStaff(
  supabase: ReturnType<typeof createAdminClient>,
  staffType: string,
  names: Set<string>
): Promise<Map<string, string>> {
  const nameToId = new Map<string, string>()
  if (names.size === 0) return nameToId

  const { data: existing } = await supabase
    .from('staff')
    .select('id, first_name, last_name')
    .eq('staff_type', staffType)

  const existingMap = new Map<string, string>()
  for (const s of existing ?? []) {
    existingMap.set(`${s.first_name} ${s.last_name}`.toLowerCase().trim(), s.id)
  }

  for (const name of names) {
    const key = name.toLowerCase().trim()
    if (existingMap.has(key)) {
      nameToId.set(name, existingMap.get(key)!)
    } else {
      const parsed = parseName(name)
      const { data, error } = await supabase
        .from('staff')
        .insert({ ...parsed, staff_type: staffType })
        .select('id')
        .single()
      if (!error && data) {
        nameToId.set(name, data.id)
      }
    }
  }
  return nameToId
}

export async function POST(request: Request) {
  const auth = await requireUserRoles(['treid_admin'])
  if (!auth.ok) {
    return auth.response
  }

  const supabase = createAdminClient()

  try {
    const { rows } = (await request.json()) as { rows: ParsedRow[] }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
    }

    // Collect staff names
    const jzNames = new Set<string>()
    const vendedorNames = new Set<string>()
    const gestorNames = new Set<string>()

    for (const row of rows) {
      if (row.jz_name) jzNames.add(row.jz_name)
      if (row.vendedor_name) vendedorNames.add(row.vendedor_name)
      if (row.gestor_name) gestorNames.add(row.gestor_name)
    }

    const [jzMap, vendedorMap, gestorMap] = await Promise.all([
      resolveStaff(supabase, 'jefe_zona', jzNames),
      resolveStaff(supabase, 'vendedor', vendedorNames),
      resolveStaff(supabase, 'gestor_treid', gestorNames),
    ])

    let created = 0
    let updated = 0
    let errors = 0
    const errorDetails: string[] = []

    // Get existing codes
    const { data: existingLocs } = await supabase.from('locations').select('code')
    const existingCodes = new Set((existingLocs ?? []).map((l) => l.code))

    // Upsert in batches
    const batchSize = 50
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)

      const records = batch
        .filter((r) => r.code && r.code.trim() !== '')
        .map((r) => ({
          code: r.code.trim(),
          name: r.name || r.code.trim(),
          address: r.address || null,
          region: r.region || null,
          city: r.city || null,
          category: r.category || null,
          status: r.status || null,
          is_active: r.status ? r.status.trim().toLowerCase() === 'activo' : true,
          sa_status: r.sa_status || null,
          subsegment: r.subsegment || null,
          staff_jz_id: r.jz_name ? (jzMap.get(r.jz_name) ?? null) : null,
          staff_vendedor_id: r.vendedor_name ? (vendedorMap.get(r.vendedor_name) ?? null) : null,
          staff_gestor_id: r.gestor_name ? (gestorMap.get(r.gestor_name) ?? null) : null,
        }))

      if (records.length === 0) continue

      const { error } = await supabase
        .from('locations')
        .upsert(records, { onConflict: 'code', ignoreDuplicates: false })

      if (error) {
        errors += records.length
        errorDetails.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`)
      } else {
        for (const rec of records) {
          if (existingCodes.has(rec.code)) {
            updated++
          } else {
            created++
            existingCodes.add(rec.code)
          }
        }
      }
    }

    return NextResponse.json({
      created,
      updated,
      errors,
      errorDetails,
      staffCreated: jzMap.size + vendedorMap.size + gestorMap.size,
    })
  } catch (err) {
    console.error('Bulk upload error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
