'use client'

import { useState, useMemo, useEffect, Fragment } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, ChevronUp, ChevronDown, FileText } from 'lucide-react'

const statusBadge = (rate: number) => {
  if (rate >= 80) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>
  if (rate >= 50) return <Badge className="bg-yellow-100 text-yellow-800">Parcial</Badge>
  return <Badge className="bg-red-100 text-red-800">Bajo</Badge>
}

const PHOTO_LABELS: Record<string, string> = {
  bandeja_jamon_lc: 'Bandeja Jamón LC',
  logo_vitrina_lc: 'Logo Vitrina LC',
  colgante_recomendacion_lc: 'Colgante LC',
  marca_precio_sc: 'Marca Precio SC',
  huincha_precio_sc: 'Huincha SC',
  cartel_panaderia: 'Cartel Panadería',
  portabolsas: 'Portabolsas',
  bolsas_papel: 'Bolsas Papel',
  tenazas: 'Tenazas',
  paloma: 'Paloma',
  cenefa_lc: 'Cenefa LC',
  bandera_muro_lc: 'Bandera Muro',
  bandera_rutera_lc: 'Bandera Rutera',
}

interface AbrilAudit {
  id: string
  form_code: number
  location_name: string
  location_code?: string | number
  submitted_at: string
  implementer_name?: string
  implementation_rate?: number
  pdf_url?: string | null
}

function PhotosPanel({ formCode }: { formCode: number }) {
  const [photos, setPhotos] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!formCode) return
    fetch(`/api/agrosuper/abril-photos?form_code=${formCode}`)
      .then(r => r.ok ? r.json() : {})
      .then(setPhotos)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [formCode])

  if (loading) return <div className="px-6 py-3 text-sm text-gray-400">Cargando fotos...</div>

  // Flatten all photos into a single list: [{label, url}]
  const allPhotos = Object.entries(photos).flatMap(([type, urls]) =>
    urls.map(url => ({ label: PHOTO_LABELS[type] ?? type, url }))
  )

  if (allPhotos.length === 0) {
    return <div className="px-6 py-3 text-sm text-gray-400">Sin fotos disponibles</div>
  }

  return (
    <div className="px-6 py-4 bg-gray-50">
      <div className="flex flex-wrap gap-3">
        {allPhotos.map(({ label, url }, idx) => (
          <div key={idx} className="flex flex-col items-center gap-1">
            <img
              src={url}
              alt={label}
              className="h-20 w-28 object-cover rounded border border-gray-200 hover:border-gray-400 transition-colors cursor-pointer"
              onClick={() => window.open(url, '_blank')}
              title={label}
            />
            <span className="text-xs text-gray-500 text-center w-28 truncate">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AbrilAuditsTable({ audits }: { audits: AbrilAudit[] }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'implementation_rate' | 'location_name' | 'date'>('implementation_rate')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = audits
    if (searchTerm) {
      const t = searchTerm.toLowerCase()
      list = list.filter(a =>
        a.location_name?.toLowerCase().includes(t) ||
        a.form_code?.toString().includes(t)
      )
    }
    return [...list].sort((a, b) => {
      let av: any, bv: any
      if (sortBy === 'implementation_rate') { av = a.implementation_rate ?? 0; bv = b.implementation_rate ?? 0 }
      else if (sortBy === 'location_name') { av = a.location_name ?? ''; bv = b.location_name ?? '' }
      else { av = new Date(a.submitted_at || 0).getTime(); bv = new Date(b.submitted_at || 0).getTime() }
      if (av < bv) return sortOrder === 'asc' ? -1 : 1
      if (av > bv) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [audits, searchTerm, sortBy, sortOrder])

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortOrder('desc') }
  }

  const SortIcon = ({ col }: { col: string }) =>
    sortBy !== col
      ? <ChevronDown className="h-3.5 w-3.5 opacity-30" />
      : sortOrder === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">📋 Todas las Visitas ({filtered.length})</h3>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por local o código..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="w-8 px-3 py-3" />
              <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('location_name')}>
                <div className="flex items-center gap-1">Local <SortIcon col="location_name" /></div>
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('date')}>
                <div className="flex items-center gap-1">Fecha <SortIcon col="date" /></div>
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-100" onClick={() => toggleSort('implementation_rate')}>
                <div className="flex items-center justify-end gap-1">% Implementación <SortIcon col="implementation_rate" /></div>
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Enlaces</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(audit => (
              <Fragment key={audit.id}>
                <tr className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => setExpandedId(expandedId === audit.id ? null : audit.id)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title={expandedId === audit.id ? 'Cerrar fotos' : 'Ver fotos'}
                    >
                      {expandedId === audit.id
                        ? <ChevronUp className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <div className="font-medium">{audit.location_name}</div>
                    {audit.form_code && <div className="text-xs text-gray-400">Form: {audit.form_code}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {new Date(audit.submitted_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-semibold">{audit.implementation_rate}%</span>
                      {statusBadge(audit.implementation_rate ?? 0)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setExpandedId(expandedId === audit.id ? null : audit.id)}
                        className="px-3 py-1 text-xs rounded transition-colors" style={{ border: '1px solid var(--color-primary)', color: 'var(--color-primary)' }}
                      >
                        📷 Fotos
                      </button>
                      {audit.pdf_url ? (
                        <a
                          href={audit.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 text-xs border border-green-200 text-green-700 rounded hover:bg-green-50 transition-colors flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" />
                          PDF
                        </a>
                      ) : (
                        <span className="px-3 py-1 text-xs border border-gray-200 text-gray-300 rounded flex items-center gap-1 cursor-not-allowed">
                          <FileText className="h-3 w-3" />
                          PDF
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === audit.id && (
                  <tr className="border-b">
                    <td colSpan={5} className="p-0">
                      <PhotosPanel formCode={audit.form_code} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-gray-500">No hay visitas que coincidan</div>
      )}
    </Card>
  )
}
