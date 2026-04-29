import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ReviewItem, ReviewVerdict } from '@/types'

const CONFIDENCE_THRESHOLD = 95 // % para aprobación/rechazo automático

// ─── Prompt base de la skill revision-formulario-enex ──────────────────────
const SYSTEM_PROMPT = `Eres un revisor de calidad de formularios de auditoría Enex 3.0. Tu única misión es verificar que el AUDITOR respondió correctamente el formulario — no evalúas si el local es bueno o malo para Shell.

PRINCIPIO FUNDAMENTAL:
- Si el auditor dice "No tiene payloader" y la foto confirma que no hay payloader → ✅ BIEN RESPONDIDO
- Si el auditor dice "Sí tiene payloader" pero la foto muestra que no hay payloader → ❌ MAL RESPONDIDO
- La calidad del local (si tiene o no tiene exhibidores, stock, etc.) NO es tu problema. Solo verificas si la respuesta del auditor coincide con la realidad visible en las fotos.

PASO 1 — METADATA (siempre verificar):

- Fecha/hora: CRITERIO DESACTIVADO TEMPORALMENTE. Márcalo SIEMPRE como passed: true sin importar la fecha. IMPORTANTE: el año actual del sistema es 2026, por lo tanto fechas en 2026 son presentes — NO futuras. No penalices ninguna fecha.

- Geolocalización: El objetivo es confirmar que el auditor estuvo físicamente en el local. Puedes verificar esto por CUALQUIERA de estos medios:
  a) Coordenadas GPS registradas (latlong no vacío) → ✅
  b) Fotos que muestran el rótulo / fachada / interior del local correcto → ✅
  c) Fotos con contexto visual que coincide con el tipo de local auditado → ✅
  Solo marca como ❌ si NO hay coordenadas Y las fotos no dan ningún indicio de presencia física en el local.

- Auditor: ¿hay nombre de auditor registrado?

PASO 2 — COHERENCIA FOTO ↔ RESPUESTA (pregunta por pregunta):
Para cada pregunta que tenga foto de evidencia, verifica:
¿La respuesta del auditor coincide con lo que se ve en la foto?

Ejemplos:
- "EXH-03 Payloader: No tiene" + foto sin payloader → ✅ correcto
- "EXH-03 Payloader: Sí tiene" + foto sin payloader → ❌ incoherente
- "DISP-01 HX7: Disponible" + foto con producto en estante → ✅ correcto
- "DISP-01 HX7: Sin stock" + foto que muestra productos → ❌ incoherente
- "EXH-01 Bastidor Shell: Sí tiene" + foto con bastidor Shell → ✅ correcto
- "EXH-01 Bastidor Shell: Sí tiene" + foto con bastidor de otra marca → ❌ incoherente

DEFINICIONES CLAVE (memoriza antes de evaluar carteles):

**Cartel externo** = letrero publicitario SOLO de una marca (sin nombre del local), ubicado en el exterior/fachada, hecho de material DURO y durable (trovicel ~5mm, acrílico, metal). NO es un pendón (lona/tela).
- Si el letrero dice el nombre del local ("PUNTO CAR SPA", "AUTOMOTRIZ LÓPEZ", etc.) → NO es cartel externo, es FACHADA / cartel con nombre del local.
- Si es una lona colgada o pendón flameando → NO es cartel externo, es pendón.
- Ejemplo: auditor responde "No tiene cartel externo" + foto muestra fachada con nombre del local y logo Shell Helix → ✅ CORRECTO (el letrero con el nombre del local NO cuenta como cartel externo).
- Ejemplo: auditor responde "Sí tiene cartel externo" + foto muestra un pendón de tela colgado → ❌ INCORRECTO (un pendón no cuenta como cartel externo).

**Cartel interno** = misma definición que el cartel externo (publicidad SOLO de marca, material duro/durable, mejor que un pendón) pero DENTRO del local.
- Las fotos pueden mostrar distintos sectores del mismo local (sala de ventas, taller, mesón, bodega). NO asumas que fotos distintas = locales distintos.

**Respuestas posibles para cartel externo / cartel interno** (ambas preguntas):
- "Sí, de Shell" → debe haber un cartel rígido de la marca Shell (Helix, Rímula, Advance, etc.).
- "Sí, de otra marca" → debe haber un cartel rígido de OTRA marca de lubricantes (Mobil, Castrol, Total, Lubrax, Valvoline, YPF, Elaion, Wolf, etc.) — NO Shell.
- "No" → no hay cartel rígido de ninguna marca (puede haber pendones, fachada con nombre del local, etc., pero no cartel publicitario de marca).

Verifica que la marca que se ve en la foto coincida exactamente con la opción seleccionada:
- Auditor dice "Sí, de Shell" + foto muestra cartel Shell Helix → ✅
- Auditor dice "Sí, de Shell" + foto muestra cartel Mobil → ❌ (debería ser "de otra marca")
- Auditor dice "Sí, de otra marca" + foto muestra cartel Mobil → ✅
- Auditor dice "Sí, de otra marca" + foto muestra cartel Shell → ❌ (debería ser "de Shell")
- Auditor dice "No" + foto muestra un cartel rígido de cualquier marca → ❌ (debería haber marcado "Sí")

PASO 3 — CALIDAD DE FOTOS:
- Foto borrosa, oscura o de otro lugar cuando la pregunta requiere evidencia visual → ❌ foto inválida
- Foto claramente del lugar correcto aunque la respuesta sea negativa ("no tiene") → ✅ evidencia válida

PASO 4 — COHERENCIA INTERNA:
- ¿Hay contradicciones entre respuestas del mismo formulario?
- Ejemplo: dice "local cerrado" pero reporta precios y stock disponible → ❌ incoherente

NO HAGAS ESTO:
- No evalúes si el local tiene buena o mala implementación Shell
- No penalices porque "no tiene pendón Shell" — eso es problema del local, no del auditor
- No juzgues precios como altos o bajos
- No evalúes la calidad comercial del punto de venta

FORMATO DE RESPUESTA — ESTRICTO:
1. Responde SOLO con JSON puro. Nada antes, nada después, sin code fences (no uses \`\`\`).
2. Tu PRIMER carácter debe ser "{".
3. Tu ÚLTIMO carácter debe ser "}".
4. Usa el siguiente formato exacto:
{
  "verdict": "pre_aprobado" | "pre_rechazado",
  "confidence": <número 0-100>,
  "summary": "<resumen en 1-2 oraciones sobre la calidad del llenado del formulario>",
  "items": [
    {"label": "<nombre del check>", "passed": true|false, "note": "<qué viste que te hizo decidir>"}
  ]
}

Criterios de verdict (SIEMPRE PROVISIONAL — solo IA):
- "pre_aprobado": formulario bien respondido, fotos coherentes con respuestas, metadata válida
  → El revisor humano de TREID lo confirma como "aprobado" si está correcto
- "pre_rechazado": hay incoherencias foto-respuesta o dudas significativas
  → El revisor humano de TREID lo confirma como "rechazado" si está incorrecto

IMPORTANTE: Tu respuesta SIEMPRE debe ser "pre_aprobado" o "pre_rechazado".
NUNCA devuelvas "aprobado" o "rechazado" — esos verdicts son solo para TREID (revisor humano).`

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseReviewResponse(text: string): {
  verdict: ReviewVerdict
  confidence: number
  summary: string
  items: ReviewItem[]
} | null {
  // Strategy 1: strip markdown fences (```json ... ```), try raw parse
  const stripped = text
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```\s*$/g, '')
    .trim()

  const candidates: string[] = [stripped]
  // Strategy 2: extract from first { to last } (greedy)
  const greedy = stripped.match(/\{[\s\S]*\}/)
  if (greedy) candidates.push(greedy[0])
  // Strategy 3: find balanced {...} block starting at first {
  const firstBrace = stripped.indexOf('{')
  if (firstBrace >= 0) {
    let depth = 0
    let inStr = false
    let esc = false
    for (let i = firstBrace; i < stripped.length; i++) {
      const c = stripped[i]
      if (esc) { esc = false; continue }
      if (c === '\\') { esc = true; continue }
      if (c === '"') { inStr = !inStr; continue }
      if (inStr) continue
      if (c === '{') depth++
      else if (c === '}') { depth--; if (depth === 0) { candidates.push(stripped.slice(firstBrace, i + 1)); break } }
    }
  }

  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c)
      if (!parsed.verdict || typeof parsed.confidence !== 'number') continue
      return {
        verdict: parsed.verdict as ReviewVerdict,
        confidence: Math.min(100, Math.max(0, Math.round(parsed.confidence))),
        summary: parsed.summary ?? '',
        items: Array.isArray(parsed.items) ? parsed.items : [],
      }
    } catch {
      // try next candidate
    }
  }
  return null
}

// ─── Main handler ───────────────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: auditId } = await params
  const supabase = createAdminClient()

  // 1. Fetch audit with all related data
  const { data: audit, error: auditErr } = await supabase
    .from('audits')
    .select(`
      id, status, datascope_form_id, audited_at, auditor_name, auditor_email, pdf_url,
      raw_data,
      location:locations(id, name, code),
      audit_answers(
        raw_value,
        question:questions(identifier, title, weight)
      ),
      audit_photos(photo_url, label, question:questions(identifier, title))
    `)
    .eq('id', auditId)
    .single()

  if (auditErr || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Only review form 664005 audits
  const auditAny = audit as Record<string, unknown>
  if (auditAny.datascope_form_id !== '664005' && auditAny.datascope_form_id !== 664005) {
    return NextResponse.json({ error: 'Only form 664005 audits can be reviewed' }, { status: 400 })
  }

  // 2. Build context for Claude
  const rawData = (audit.raw_data as Record<string, unknown>) ?? {}
  const locationRaw = audit.location as unknown as { name: string; code: string } | null

  const metadata = {
    local: locationRaw ? `${locationRaw.code} - ${locationRaw.name}` : 'Desconocido',
    auditor: audit.auditor_name ?? audit.auditor_email ?? 'Desconocido',
    fechaVisita: audit.audited_at ?? 'Desconocida',
    horario: rawData.created ?? rawData.created_at ?? '-',
    geolocation: rawData.latlong ?? '-',
    formState: rawData.form_state ?? '-',
  }

  // Build answers text
  type AnswerRow = { raw_value: string; question: { identifier: string; title: string; weight: number } | null }
  const answers = ((audit.audit_answers as unknown as AnswerRow[]) ?? [])
    .filter(a => a.question)
    .map(a => `[${a.question!.identifier}] ${a.question!.title}: ${a.raw_value}`)
    .join('\n')

  // Build photo list
  type PhotoRow = { photo_url: string; label: string | null; question: { identifier: string; title: string } | null }
  const photos = (audit.audit_photos as unknown as PhotoRow[] ?? [])

  const photosText = photos
    .map(p => `${p.question?.identifier ?? '?'} — ${p.question?.title ?? p.label ?? 'Foto'}: ${p.photo_url}`)
    .join('\n')

  const userContent: Anthropic.MessageParam['content'] = [
    {
      type: 'text',
      text: `## CONTEXTO
**Fecha actual del sistema:** ${new Date().toISOString().slice(0, 10)}

## FORMULARIO A REVISAR

**Local:** ${metadata.local}
**Auditor:** ${metadata.auditor}
**Fecha/hora visita:** ${metadata.fechaVisita}
**Horario de llenado:** ${metadata.horario}
**Geolocalización:** ${metadata.geolocation}
**Estado formulario Datascope:** ${metadata.formState}

---

## RESPUESTAS DEL FORMULARIO

${answers || '(Sin respuestas mapeadas)'}

---

## FOTOS ADJUNTAS (${photos.length} fotos)

${photosText || '(Sin fotos)'}

${audit.pdf_url ? `\nPDF del formulario: ${audit.pdf_url}` : ''}

Revisa el formulario completo y devuelve el JSON de revisión.`,
    },
    // Include photos as image blocks for visual review
    ...photos
      .filter(p => {
        if (!p.photo_url?.startsWith('http')) return false
        // Anthropic only accepts jpeg/png/webp/gif. Filter by extension to skip
        // URLs that Claude would reject as "invalid image format".
        return /\.(jpe?g|png|webp|gif)(\?|$|#)/i.test(p.photo_url)
      })
      .slice(0, 20) // Claude API limit: max 20 images
      .map(p => ({
        type: 'image' as const,
        source: {
          type: 'url' as const,
          url: p.photo_url,
        },
      })),
  ]

  // 3. Call Claude
  let reviewResult: ReturnType<typeof parseReviewResponse> = null
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    reviewResult = parseReviewResponse(text)
    if (!reviewResult) {
      console.error('[audit-review] parse failed — full text:', { auditId, text })
      // Return the raw text so callers can inspect it directly
      return NextResponse.json({ error: 'Could not parse AI response', rawText: text.slice(0, 1000) }, { status: 502 })
    }
    console.info('[audit-review] parsed', { auditId, verdict: reviewResult.verdict, confidence: reviewResult.confidence })
  } catch (e) {
    const err = e as { message?: string; status?: number; error?: unknown }
    console.error('[audit-review] Claude API error', {
      auditId,
      message: err?.message,
      status: err?.status,
      error: err?.error,
      raw: JSON.stringify(e, Object.getOwnPropertyNames(e ?? {})),
    })
    return NextResponse.json({ error: 'AI review failed', detail: err?.message }, { status: 502 })
  }

  if (!reviewResult) {
    return NextResponse.json({ error: 'Could not parse AI response' }, { status: 502 })
  }

  // 4. Force IA verdict to always be provisional (pre_*)
  // IA never assigns final verdicts (aprobado/rechazado) — only TREID reviewers can
  let finalVerdict: ReviewVerdict = reviewResult.verdict
  if (finalVerdict === 'aprobado') finalVerdict = 'pre_aprobado'
  if (finalVerdict === 'rechazado') finalVerdict = 'pre_rechazado'

  // 5. Map verdict to audit status
  const statusMap: Record<ReviewVerdict, string> = {
    aprobado: 'aprobado',
    pre_aprobado: 'pre_aprobado',
    pre_rechazado: 'pre_rechazado',
    rechazado: 'rechazado',
  }
  const newStatus = statusMap[finalVerdict]

  // 6. Save review to DB
  const { error: reviewErr } = await supabase
    .from('audit_reviews')
    .upsert({
      audit_id: auditId,
      verdict: finalVerdict,
      confidence: reviewResult.confidence,
      review_items: reviewResult.items,
      summary: reviewResult.summary,
      reviewed_by_ai: true,
      reviewed_at: new Date().toISOString(),
    }, { onConflict: 'audit_id' })

  if (reviewErr) {
    console.error('[audit-review] failed to save review', { auditId, error: reviewErr.message })
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 })
  }

  // 7. Update audit status
  await supabase.from('audits').update({ status: newStatus }).eq('id', auditId)

  // 8. Score calculation is now triggered by TREID reviewer (when status changes to 'aprobado')
  // IA never calculates scores — only provisional verdicts
  // (score calculation handled in audits/[id]/status endpoint or webhook when TREID approves)

  console.info('[audit-review] done', { auditId, verdict: finalVerdict, confidence: reviewResult.confidence })

  return NextResponse.json({
    audit_id: auditId,
    verdict: finalVerdict,
    confidence: reviewResult.confidence,
    items_count: reviewResult.items.length,
  })
}
