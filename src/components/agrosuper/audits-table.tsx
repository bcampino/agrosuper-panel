'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

const statusBadge = (rate: number) => {
  if (rate >= 80) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>
  if (rate >= 50) return <Badge className="bg-yellow-100 text-yellow-800">Parcial</Badge>
  return <Badge className="bg-red-100 text-red-800">Bajo</Badge>
}

interface Audit {
  id: string
  location_name: string
  location_code?: string | number
  submitted_at: string
  implementer_name?: string
  colgantes_3_lc?: string
  reloj_lc?: string
  bandejas_2_jamon_lc?: string
  logo_2_vitrina_lc?: string
  carteles_4_jamon_lc?: string
  afiches_2_sc?: string
  marcos_2_precio_sc?: string
  huinchas_2_precio_sc?: string
  implementation_rate?: number
}

interface AuditsTableProps {
  audits: Audit[]
  isFiambres?: boolean
}

interface PhotosModalProps {
  isOpen: boolean
  locationName: string
  locationCode?: string | number
  onClose: () => void
}

function PhotosModal({ isOpen, locationName, locationCode, onClose }: PhotosModalProps) {
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const loadPhotos = async () => {
    if (!locationCode) return

    setLoading(true)
    try {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from('agrosuper_fiambres_photos')
        .select('*')
        .eq('audit_location_code', locationCode)
        .single()

      if (data) {
        const photoData: Record<string, string> = {}
        const photoKeys = [
          'foto_fachada_externa',
          'foto_kit_bienvenida',
          'foto_colgantes_lc',
          'foto_reloj_lc',
          'foto_bandejas_lc',
          'foto_logo_lc',
          'foto_carteles_lc',
          'foto_afiches_sc',
          'foto_marcos_sc',
          'foto_huinchas_sc',
          'foto_paloma',
          'foto_cartel_panaderia',
          'foto_portabolsas',
          'foto_tenazas'
        ]

        photoKeys.forEach(key => {
          if (data[key as keyof typeof data]) {
            photoData[key] = data[key as keyof typeof data]
          }
        })

        setPhotos(photoData)
      }
    } catch (error) {
      console.error('Error loading photos:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPhotoLabel = (key: string) => {
    const labels: Record<string, string> = {
      foto_fachada_externa: 'Fachada Externa',
      foto_kit_bienvenida: 'Kit Bienvenida',
      foto_colgantes_lc: '3 Colgantes LC',
      foto_reloj_lc: 'Reloj LC',
      foto_bandejas_lc: '2 Bandejas LC',
      foto_logo_lc: '2 Logo LC',
      foto_carteles_lc: '4 Carteles LC',
      foto_afiches_sc: '2 Afiches SC',
      foto_marcos_sc: '2 Marcos SC',
      foto_huinchas_sc: '2 Huinchas SC',
      foto_paloma: 'Paloma',
      foto_cartel_panaderia: 'Cartel Panadería',
      foto_portabolsas: 'Portabolsas',
      foto_tenazas: 'Tenazas'
    }
    return labels[key] || key
  }

  if (!isOpen) return null

  if (loading && Object.keys(photos).length === 0) {
    loadPhotos()
  }

  const photoEntries = Object.entries(photos)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{locationName}</h2>
            <p className="text-sm text-gray-500">Código: {locationCode}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {photoEntries.length === 0 ? (
            <p className="text-center text-gray-500">No hay fotos disponibles para este local</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {photoEntries.map(([key, url]) => (
                <div key={key} className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">{getPhotoLabel(key)}</p>
                  <img
                    src={url}
                    alt={getPhotoLabel(key)}
                    className="w-full h-48 object-cover rounded-lg border border-gray-200 hover:border-blue-400 transition-colors cursor-pointer"
                    onClick={() => window.open(url, '_blank')}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export function AuditsTable({ audits, isFiambres = false }: AuditsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'implementation_rate' | 'location_name' | 'date'>('implementation_rate')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null)
  const [showPhotosModal, setShowPhotosModal] = useState(false)

  const filteredAudits = useMemo(() => {
    const isPrueba = (text: string) =>
      text.toLowerCase().includes('prueba') ||
      text.toLowerCase().includes('piloto') ||
      text.toLowerCase().includes('local de prueba')

    let filtered = audits
      .filter(audit => !isPrueba(audit.location_name || ''))
      .map((audit: any) => {
        if (isFiambres) {
          const materialsCount = [
            audit.colgantes_3_lc,
            audit.reloj_lc,
            audit.bandejas_2_jamon_lc,
            audit.logo_2_vitrina_lc,
            audit.carteles_4_jamon_lc,
            audit.afiches_2_sc,
            audit.marcos_2_precio_sc,
            audit.huinchas_2_precio_sc
          ].filter(m => m?.toLowerCase?.() === 'si').length
          return {
            ...audit,
            implementation_rate: Math.round((materialsCount / 8) * 100)
          }
        }
        return audit
      })

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(audit =>
        audit.location_name?.toLowerCase().includes(term) ||
        audit.location_code?.toString().includes(term)
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
  }, [audits, searchTerm, sortBy, sortOrder, isFiambres])

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
    <>
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
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Fotos/PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAudits.map((audit) => (
                <tr key={audit.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-900 text-xs">
                    <div>{audit.location_name}</div>
                    {audit.location_code && <div className="text-gray-500 text-xs">Código: {audit.location_code}</div>}
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
                    <button
                      onClick={() => {
                        setSelectedAudit(audit)
                        setShowPhotosModal(true)
                      }}
                      className="px-3 py-1 text-xs border border-blue-200 text-blue-600 rounded hover:bg-blue-50 transition-colors"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
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

      <PhotosModal
        isOpen={showPhotosModal}
        locationName={selectedAudit?.location_name || ''}
        locationCode={selectedAudit?.location_code}
        onClose={() => {
          setShowPhotosModal(false)
          setSelectedAudit(null)
        }}
      />
    </>
  )
}
