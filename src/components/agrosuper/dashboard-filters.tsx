'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const MONTH_LABELS: Record<string, string> = {
  '2026-01': 'Enero 2026',   '2026-02': 'Febrero 2026', '2026-03': 'Marzo 2026',
  '2026-04': 'Abril 2026',   '2026-05': 'Mayo 2026',    '2026-06': 'Junio 2026',
  '2026-07': 'Julio 2026',   '2026-08': 'Agosto 2026',  '2026-09': 'Septiembre 2026',
  '2026-10': 'Octubre 2026', '2026-11': 'Noviembre 2026','2026-12': 'Diciembre 2026',
  '2025-01': 'Enero 2025',   '2025-02': 'Febrero 2025', '2025-03': 'Marzo 2025',
  '2025-04': 'Abril 2025',   '2025-05': 'Mayo 2025',    '2025-06': 'Junio 2025',
  '2025-07': 'Julio 2025',   '2025-08': 'Agosto 2025',  '2025-09': 'Septiembre 2025',
  '2025-10': 'Octubre 2025', '2025-11': 'Noviembre 2025','2025-12': 'Diciembre 2025',
}

interface Props {
  months: string[]
  campaigns: string[]
  selectedMonth: string
  selectedCampaign: string
}

export function DashboardFilters({ months, campaigns, selectedMonth, selectedCampaign }: Props) {
  const router = useRouter()
  const sp = useSearchParams()

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString())
    params.set(key, value)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Mes</label>
        <select
          value={selectedMonth}
          onChange={e => update('month', e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {months.map(m => (
            <option key={m} value={m}>{MONTH_LABELS[m] ?? m}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Campaña</label>
        <select
          value={selectedCampaign}
          onChange={e => update('campaign', e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {campaigns.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
