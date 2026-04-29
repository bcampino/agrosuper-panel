import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import UploadBaseForm from './UploadBaseForm'

const MONTH_LABELS: Record<string, string> = {
  '2026-01': 'Enero 2026',   '2026-02': 'Febrero 2026', '2026-03': 'Marzo 2026',
  '2026-04': 'Abril 2026',   '2026-05': 'Mayo 2026',    '2026-06': 'Junio 2026',
  '2026-07': 'Julio 2026',   '2026-08': 'Agosto 2026',  '2026-09': 'Sep. 2026',
  '2026-10': 'Octubre 2026', '2026-11': 'Nov. 2026',    '2026-12': 'Dic. 2026',
}

function nextMonthStr(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return m === 12 ? `${y + 1}-01-01T00:00:00` : `${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00`
}

export default async function UploadBasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: campaign } = await supabase
    .from('agrosuper_campaigns')
    .select('id, name, column_type, month')
    .eq('id', id)
    .single()

  if (!campaign) notFound()

  // Count existing audits for this campaign to suggest next base
  const { count } = await supabase
    .from('agrosuper_audits')
    .select('id', { count: 'exact', head: true })
    .gte('submitted_at', `${campaign.month}-01T00:00:00`)
    .lt('submitted_at', nextMonthStr(campaign.month))

  const suggestedBase = count && count > 0 ? 2 : 1
  const monthLabel    = MONTH_LABELS[campaign.month] ?? campaign.month

  return (
    <UploadBaseForm
      campaignId={campaign.id}
      campaignName={campaign.name}
      monthLabel={monthLabel}
      defaultBase={suggestedBase}
    />
  )
}
