import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/campaigns/kanban-board'
import type { Campaign, Location, Pillar } from '@/types'

export default async function CampaignsPage() {
  const supabase = await createClient()

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*, creator:users!created_by(id,full_name,email,role), pillar:pillars!pillar_id(id,name), campaign_locations(id)')
    .order('created_at', { ascending: false })

  // Add location_count to each campaign
  const campaignsWithCount = (campaigns ?? []).map((c: Record<string, unknown>) => ({
    ...c,
    location_count: Array.isArray(c.campaign_locations) ? c.campaign_locations.length : 0,
    campaign_locations: undefined,
  }))

  const { data: locations } = await supabase
    .from('locations')
    .select('id, code, name')
    .eq('is_active', true)
    .order('name')

  // Get pillars from active tree for the campaign form
  const { data: tree } = await supabase
    .from('pillar_trees')
    .select('pillars(id, name, weight, sort_order)')
    .eq('is_active', true)
    .single()

  const pillars = (tree?.pillars ?? []) as Pillar[]
  pillars.sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Campañas</h1>
      <KanbanBoard
        campaigns={campaignsWithCount as Campaign[]}
        locations={(locations as Location[]) ?? []}
        pillars={pillars}
      />
    </div>
  )
}
