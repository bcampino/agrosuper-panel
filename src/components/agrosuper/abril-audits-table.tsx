'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, ChevronUp, ChevronDown, X, FileText } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

const statusBadge = (rate: number) => {
  if (rate >= 80) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>
  if (rate >= 50) return <Badge className="bg-yellow-100 text-yellow-800">Parcial</Badge>
  return <Badge className="bg-red-100 text-red-800">Bajo</Badge>
}

interface AbrilAudit {
  id: string
  form_code: number
  location_name: string
  location_code?: string | number
  submitted_at: string
  implementer_name?: string
  implementation_rate?: number
}

interface AbrilAuditsTableProps {
  audits: AbrilAudit[]
}

function PhotosPanel({ formCode, locationName }: { formCode: number; locationName: string }) {
  const [photos, setPhotos] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  useMemo(async () => {
    if (!formCode) return

    try {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from('agrosuper_abril_photos')
        .select('*')
        .eq('form_code', formCode)

      if (data && data.length > 0) {
        const photoData: Record<string, string[]> = {}

        data.forEach((photo: any) => {
          if (!photoData[photo.photo_type]) {
            photoData[photo.photo_type] = []
          }
          photoData[photo.photo_type].push(photo.photo_url)
        })

        setPhotos(photoData)
      }
    } catch (error) {
      console.error('Error loading photos:', error)
    } finally {
      setLoading(false)
    }
  }, [formCode])

  const getPhotoLabel = (key: string) => {
    const labels: Record<string, string> = {
      bandeja_jamon_lc: 'Bandeja Jamón LC',
      logo_vitrina_lc: 'Logo Vitrina LC',
      colgante_recomendacion_lc: 'Colgante LC',
      marca_precio_sc: 'Marca Precio SC',
      huincha_precio_sc: 'Huincha Precio SC',
      cartel_panaderia: 'Cartel Panadería',
      portabolsas: 'Portabolsas',
      bolsas_papel: 'Bolsas Papel',
      tenazas: 'Tenazas',
      paloma: 'Paloma',
      cenefa_lc: 'Cenefa LC',
      bandera_muro_lc: 'Bandera Muro LC',
      bandera_rutera_lc: 'Bandera Rutera LC'
    }
    return labels[key] || key
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Cargando fotos...</div>
  }

  const photoEntries = Object.entries(photos)

  if (photoEntries.length === 0) {
    return <div className="p-4 text-center text-gray-500">No hay fotos disponibles</div>
  }

  return (
    <div className="p-4 space-y-4">
      {photoEntries.map(([photoType, urls]) => (
        <div key={photoType}>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{getPhotoLabel(photoType)}</h4>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {urls.map((url, idx) => (
              <div key={idx} className="flex-shrink-0">
                <img
                  src={url}
                  alt={`${getPhotoLabel(photoType)} ${idx + 1}`}
                  className="h-24 w-32 object-cover rounded border border-gray-200 hover:border-blue-400 transition-colors cursor-pointer"
                  onClick={() => window.open(url, '_blank')}
                  title="Click para abrir en nueva ventana"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function AbrilAuditsTable({ audits }: AbrilAuditsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'implementation_rate' | 'location_name' | 'date'>('implementation_rate')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null)

  const filteredAudits = useMemo(() => {
    let filtered = audits

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(audit =>
        audit.location_name?.toLowerCase().includes(term) ||
        audit.form_code?.toString().includes(term)
      )
    }

    filtered.sort((a, b) => {
      let aVal: any, bVal: any

      if (sortBy === 'implementation_rate') {
        aVal = a.implementation_rate || 0
        bVal = b.implementation_rate || 0
      } else if (sortBy === 'location_name') {
        aVal = a.location_name || ''
        bVal = b.location_name || ''
      } else {
        aVal = new Date(a.submitted_at || 0).getTime()
        bVal = new Date(b.submitted_at || 0).getTime()
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [audits, searchTerm, sortBy, sortOrder])

  const toggleSort = (column: 'implementation_rate' | 'location_name' | 'date') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ChevronDown className="h-4 w-4 opacity-30" />
    return sortOrder === 'asc' ?
      <ChevronUp className="h-4 w-4" /> :
      <ChevronDown className="h-4 w-4" />
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-4">📋 Todas las Visitas ({filteredAudits.length})</h3>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por local o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 w-8"></th>
              <th
                className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleSort('location_name')}
              >
                <div className="flex items-center gap-1">
                  Local
                  <SortIcon column="location_name" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleSort('date')}
              >
                <div className="flex items-center gap-1">
                  Fecha
                  <SortIcon column="date" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleSort('implementation_rate')}
              >
                <div className="flex items-center justify-end gap-1">
                  % Implementación
                  <SortIcon column="implementation_rate" />
                </div>
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Enlaces</th>
            </tr>
          </thead>
          <tbody>
            {filteredAudits.map((audit) => (
              <tbody key={audit.id}>
                <tr className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setExpandedAuditId(expandedAuditId === audit.id ? null : audit.id)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title={expandedAuditId === audit.id ? 'Cerrar fotos' : 'Ver fotos'}
                    >
                      {expandedAuditId === audit.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-900 text-xs">
                    <div>{audit.location_name}</div>
                    {audit.form_code && <div className="text-gray-500 text-xs">Form: {audit.form_code}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {new Date(audit.submitted_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-semibold">{audit.implementation_rate}%</span>
                      {statusBadge(audit.implementation_rate || 0)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setExpandedAuditId(expandedAuditId === audit.id ? null : audit.id)}
                        className="px-3 py-1 text-xs border border-blue-200 text-blue-600 rounded hover:bg-blue-50 transition-colors"
                      >
                        📷 Fotos
                      </button>
                      <button
                        disabled
                        className="px-3 py-1 text-xs border border-gray-200 text-gray-400 rounded cursor-not-allowed flex items-center gap-1"
                        title="PDF disponible próximamente"
                      >
                        <FileText className="h-3 w-3" />
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedAuditId === audit.id && (
                  <tr className="border-b bg-gray-50">
                    <td colSpan={5}>
                      <PhotosPanel formCode={audit.form_code} locationName={audit.location_name} />
                    </td>
                  </tr>
                )}
              </tbody>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAudits.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No hay audits que coincidan con la búsqueda
        </div>
      )}
    </Card>
  )
}
