import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Plus, BarChart2, Upload } from 'lucide-react'

export const revalidate = 0

const COLUMNS = [
  { title: 'Campañas Totales', type: 'total',       dot: 'bg-primary', color: 'var(--primary)' },
  { title: 'La Crianza',       type: 'la_crianza',  dot: 'bg-accent', color: 'var(--accent)' },
  { title: 'Super Cerdo',      type: 'super_cerdo', dot: 'bg-secondary',  color: 'var(--secondary)' },
  { title: 'Agrosuper',        type: 'agrosuper',   dot: 'bg-accent',   color: 'var(--accent)' },
]

type Campaign = {
  id: string; name: string; column_type: string; month: string; created_at: string
}
type Stats = { total: number; communes: number; avgRate: number }

export default async function CampaignsPage() {
  const supabase = createAdminClient()

  const [{ data: campaigns }, { data: scopes }, { data: audits }] = await Promise.all([
    supabase.from('agrosuper_campaigns').select('*').order('created_at', { ascending: false }),
    supabase.from('agrosuper_campaign_scopes').select('campaign_id, locations(region)'),
    supabase.from('agrosuper_audits').select('submitted_at, implementation_rate'),
  ])

  // Count locales from scope per campaign
  const campaignLocales = new Map<string, Set<string>>()
  for (const scope of (scopes || []) as any[]) {
    if (!campaignLocales.has(scope.campaign_id)) {
      campaignLocales.set(scope.campaign_id, new Set())
    }
    campaignLocales.get(scope.campaign_id)!.add(scope.locations?.region ?? '')
  }

  // Compute average rate per month from audits
  const monthRates = new Map<string, number[]>()
  for (const a of (audits || []) as any[]) {
    const m = (a.submitted_at as string).slice(0, 7)
    if (!monthRates.has(m)) monthRates.set(m, [])
    monthRates.get(m)!.push(a.implementation_rate ?? 0)
  }

  function statsFor(campaignId: string, month: string): Stats {
    const regions = campaignLocales.get(campaignId)
    const total = regions ? (regions.size > 0 ? [...regions].filter(r => r).length : regions.size) : 0
    const rates = monthRates.get(month) || []
    const avgRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0
    return { total: campaignLocales.get(campaignId)?.size ?? 0, communes: regions?.size ?? 0, avgRate }
  }

  // Group campaigns by column_type
  const byType = new Map<string, Campaign[]>()
  COLUMNS.forEach(c => byType.set(c.type, []))
  for (const c of (campaigns || []) as Campaign[]) {
    byType.get(c.column_type)?.push(c)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Campañas POP</h1>
          <p className="text-sm text-gray-500 mt-1">Canal Tradicional RM</p>
        </div>
        <Link
          href="/agrosuper/campaigns/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shrink-0 hover:opacity-90 transition-opacity bg-primary"
        >
          <Plus className="h-4 w-4" />
          Nueva Campaña
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
        {COLUMNS.map(col => {
          const list = byType.get(col.type) || []
          return (
            <div key={col.type}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-600">{col.title}</h2>
              </div>
              <div className="space-y-3">
                {list.length === 0 ? (
                  <Card className="p-4 text-center text-sm text-gray-400 border-dashed">
                    Próximamente
                  </Card>
                ) : (
                  list.map(campaign => {
                    const stats = statsFor(campaign.id, campaign.month)
                    return (
                      <CampaignCard
                        key={campaign.id}
                        campaign={campaign}
                        stats={stats}
                        color={col.color}
                      />
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CampaignCard({ campaign, stats, color }: { campaign: Campaign; stats: Stats; color: string }) {
  return (
    <Card className="p-4 space-y-3" style={{ borderLeft: `4px solid ${color}` }}>
      <div>
        <p className="font-semibold text-sm leading-snug">{campaign.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {stats.total > 0
            ? `${stats.total} locales · ${stats.communes} comunas`
            : 'Sin datos aún'}
        </p>
      </div>

      {stats.total > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${stats.avgRate}%`, backgroundColor: color }} />
          </div>
          <span className="text-xs font-semibold text-gray-600 w-8 text-right shrink-0">{stats.avgRate}%</span>
        </div>
      )}

      <div className="flex gap-2 pt-1 flex-col">
        <div className="flex gap-2">
          <Link
            href={`/agrosuper/campaigns/${campaign.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Ver
          </Link>
          <Link
            href={`/agrosuper/campaigns/${campaign.id}/upload`}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg text-white hover:opacity-90 transition-opacity bg-primary"
          >
            <Upload className="h-3.5 w-3.5" />
            Resultados
          </Link>
        </div>
        <Link
          href={`/agrosuper/campaigns/${campaign.id}/scope`}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          Base de Locales
        </Link>
      </div>
    </Card>
  )
}
