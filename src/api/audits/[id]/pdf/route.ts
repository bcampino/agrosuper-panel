import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Fetch hash_id from Datascope internal API for a given form_answer_id
async function resolveHashId(formAnswerId: string | number, datascopeFormId: string): Promise<string | null> {
  // Try all pages to find the record
  for (let page = 1; page <= 10; page++) {
    const url = `https://mydatascope.com/form_answers_react?task_form_id=${datascopeFormId}&per_page=100&page=${page}`
    try {
      const r = await fetch(url, {
        headers: {
          Authorization: process.env.DATASCOPE_API_KEY ?? '',
          // Internal API needs session cookie — can't use API key here
          // Fall back to returning null if this doesn't work
        },
      })
      if (!r.ok) break
      const data = await r.json()
      const answers: Array<{ id: number; hash_id: string }> = data.answers ?? (Array.isArray(data) ? data : [])
      if (!answers.length) break
      const match = answers.find(a => String(a.id) === String(formAnswerId))
      if (match?.hash_id) return match.hash_id
    } catch {
      break
    }
  }
  return null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Verify user is authenticated
  const supabaseUser = await createServerClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Get audit with pdf_url and raw_data
  const { data: audit, error } = await supabase
    .from('audits')
    .select('id, pdf_url, raw_data, datascope_form_id')
    .eq('id', id)
    .single()

  if (error || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  const raw = audit.raw_data as Record<string, unknown> | null

  // 1. Try stored pdf_url first
  let pdfUrl = audit.pdf_url as string | null | undefined
  if (pdfUrl) {
    // If it's an S3 URL or direct PDF, redirect
    if (pdfUrl.includes('s3.amazonaws.com') || pdfUrl.endsWith('.pdf')) {
      return NextResponse.redirect(pdfUrl)
    }
  }

  // 2. Try hash_id from raw_data (stored by Chrome extraction)
  const hashId = raw?.hash_id as string | undefined
  if (hashId) {
    pdfUrl = `https://app.mydatascope.com/form_answers/${hashId}.pdf`
  }

  // 3. Fall back to form_answer_id lookup
  const formAnswerId = raw?.form_answer_id as string | number | undefined
  if (!pdfUrl && formAnswerId && audit.datascope_form_id) {
    const resolvedHash = await resolveHashId(formAnswerId, audit.datascope_form_id)
    if (resolvedHash) {
      pdfUrl = `https://app.mydatascope.com/form_answers/${resolvedHash}.pdf`
      // Cache hash_id in raw_data for future requests
      await supabase
        .from('audits')
        .update({ raw_data: { ...(raw ?? {}), hash_id: resolvedHash } })
        .eq('id', id)
    }
  }

  // 4. Last resort: redirect to Datascope form answer page (user can download from there)
  if (!pdfUrl && formAnswerId) {
    return NextResponse.redirect(
      `https://app.mydatascope.com/form_answers/${formAnswerId}`
    )
  }

  if (!pdfUrl) {
    return NextResponse.json({ error: 'No PDF available for this audit' }, { status: 404 })
  }

  // Fetch and stream the PDF
  try {
    const pdfResp = await fetch(pdfUrl)

    const contentType = pdfResp.headers.get('content-type') ?? ''

    // If Datascope returned HTML, it means auth failed or URL is wrong — redirect to Datascope
    if (contentType.includes('text/html') || !pdfResp.ok) {
      if (formAnswerId) {
        return NextResponse.redirect(
          `https://app.mydatascope.com/form_answers/${formAnswerId}`
        )
      }
      return NextResponse.json({ error: `PDF not accessible (status ${pdfResp.status})` }, { status: 502 })
    }

    const disposition = pdfResp.headers.get('content-disposition')
      ?? `attachment; filename="auditoria-${id}.pdf"`

    return new NextResponse(pdfResp.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (e) {
    console.error('[pdf-proxy] error', { audit_id: id, pdf_url: pdfUrl, error: e })
    // Fallback redirect
    if (formAnswerId) {
      return NextResponse.redirect(`https://app.mydatascope.com/form_answers/${formAnswerId}`)
    }
    return NextResponse.json({ error: 'Failed to fetch PDF' }, { status: 500 })
  }
}
