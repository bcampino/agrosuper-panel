import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import ScopeForm from './ScopeForm'

export const revalidate = 0

export default async function ScopeUploadPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient()

  const { data: campaign, error } = await supabase
    .from('agrosuper_campaigns')
    .select('id, name, month')
    .eq('id', params.id)
    .single()

  if (error || !campaign) notFound()

  // Get next base number (find max existing base_number + 1)
  const { data: scopes } = await supabase
    .from('agrosuper_campaign_scopes')
    .select('base_number')
    .eq('campaign_id', campaign.id)
    .order('base_number', { ascending: false })
    .limit(1)

  const nextBase = (scopes?.[0]?.base_number ?? 0) + 1

  return <ScopeForm campaignId={campaign.id} campaignName={campaign.name} baseNumber={nextBase} />
}
