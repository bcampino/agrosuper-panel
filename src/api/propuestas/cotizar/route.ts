import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

type Body = {
  popName: string
  popSlug: string
  material: string
  measurements: string
  quantities: string[]
  despacho: 'si' | 'no'
  destinos: string[]
  destinosMode: 'uno' | 'varios' | null
  userName: string
  userEmail: string
}

const TARGET = 'bcampino@treid.cl'
// Mientras no hay dominio verificado en Resend, uso su sandbox (solo llega al email del owner de la API key).
// Con dominio propio verificado, cambiar a algo como 'panel@treid.cl'.
const FROM = process.env.RESEND_FROM ?? 'onboarding@resend.dev'

export async function POST(req: Request) {
  // Solo usuarios autenticados pueden cotizar.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY no configurada en el servidor' },
      { status: 500 },
    )
  }

  const body = (await req.json()) as Body
  if (!body.popName || !body.quantities?.length || !body.despacho) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const qtyList = body.quantities.join(' + ')
  const qtyText =
    body.quantities.length === 1 ? `${qtyList} unidades` : `cotizaciones de ${qtyList} unidades`

  let despachoText = 'sin despacho'
  if (body.despacho === 'si') {
    if (body.destinosMode === 'uno') {
      despachoText = `con despacho a 1 destino (${body.destinos[0] ?? '-'})`
    } else {
      despachoText = `con despacho a ${body.destinos.length} destinos: ${body.destinos.join(', ')}`
    }
  }

  const subject = `Cotizacion de ${body.popName} - Panel enex`

  const textBody =
    `A través de la app de enex, ${body.userName} (${body.userEmail}) quiere cotizar ${qtyText} de ${body.popName} ${despachoText}.\n\n` +
    `---\n` +
    `Detalle:\n` +
    `• Material POP: ${body.popName}\n` +
    `• Material: ${body.material}\n` +
    `• Medidas: ${body.measurements}\n` +
    `• Cantidades: ${body.quantities.join(', ')}\n` +
    `• Despacho: ${body.despacho === 'si' ? 'Sí' : 'No'}\n` +
    (body.despacho === 'si' ? `• Destinos: ${body.destinos.join(' | ')}\n` : '') +
    `• Solicitado por: ${body.userName} (${body.userEmail})\n`

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d0661c;">Nueva cotización — ${body.popName}</h2>
      <p>A través de la app de enex, <strong>${escapeHtml(body.userName)}</strong> (${escapeHtml(body.userEmail)}) quiere cotizar <strong>${escapeHtml(qtyText)}</strong> de <strong>${escapeHtml(body.popName)}</strong> ${escapeHtml(despachoText)}.</p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
      <h3 style="font-size: 14px; color: #666;">Detalle</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #666;">Material POP</td><td style="padding: 6px 0;"><strong>${escapeHtml(body.popName)}</strong></td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Material</td><td style="padding: 6px 0;">${escapeHtml(body.material)}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Medidas</td><td style="padding: 6px 0;">${escapeHtml(body.measurements)}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Cantidades</td><td style="padding: 6px 0;">${escapeHtml(body.quantities.join(', '))}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Despacho</td><td style="padding: 6px 0;">${body.despacho === 'si' ? 'Sí' : 'No'}</td></tr>
        ${body.despacho === 'si' ? `<tr><td style="padding: 6px 0; color: #666;">Destinos</td><td style="padding: 6px 0;">${escapeHtml(body.destinos.join(' | '))}</td></tr>` : ''}
        <tr><td style="padding: 6px 0; color: #666;">Solicitado por</td><td style="padding: 6px 0;">${escapeHtml(body.userName)} (${escapeHtml(body.userEmail)})</td></tr>
      </table>
    </div>
  `

  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: FROM,
      to: TARGET,
      replyTo: body.userEmail || undefined,
      subject,
      text: textBody,
      html: htmlBody,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
