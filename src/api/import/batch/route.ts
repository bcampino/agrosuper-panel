import { NextRequest, NextResponse } from 'next/server'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(request: NextRequest) {
  try {
    const payloads = await request.json()
    if (!Array.isArray(payloads)) {
      return NextResponse.json({ error: 'Expected array' }, { status: 400, headers: CORS })
    }

    const results: { id: number; status: string; error?: string }[] = []

    for (const payload of payloads) {
      try {
        const res = await fetch(`http://localhost:${process.env.PORT ?? 3000}/api/webhooks/datascope`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-datascope-secret': process.env.DATASCOPE_WEBHOOK_SECRET ?? process.env.WEBHOOK_SHARED_SECRET ?? '',
          },
          body: JSON.stringify(payload),
        })
        const text = await res.text()
        results.push({ id: payload.form_answer_id, status: res.ok ? 'ok' : 'error', error: res.ok ? undefined : text.slice(0, 100) })
      } catch (e) {
        results.push({ id: payload.form_answer_id, status: 'exception', error: String(e).slice(0, 100) })
      }
    }

    const ok = results.filter(r => r.status === 'ok').length
    return NextResponse.json({ ok, errors: results.length - ok, results }, { headers: CORS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS })
  }
}
