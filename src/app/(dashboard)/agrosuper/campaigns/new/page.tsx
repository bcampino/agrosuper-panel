'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Upload, FileSpreadsheet, CheckCircle, XCircle, ArrowLeft, Loader2 } from 'lucide-react'

const COLUMN_OPTIONS = [
  { value: 'total',       label: 'Campaña Total' },
  { value: 'la_crianza',  label: 'La Crianza' },
  { value: 'super_cerdo', label: 'Super Cerdo' },
  { value: 'agrosuper',   label: 'Agrosuper' },
]

interface Result {
  success: boolean
  imported?: number; skipped?: number; total?: number; base?: number
  error?: string; details?: string; hint?: string
}

export default function NuevaCampañaPage() {
  const router = useRouter()
  const [name, setName]         = useState('')
  const [colType, setColType]   = useState('total')
  const [file, setFile]         = useState<File | null>(null)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<Result | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !name.trim()) return

    setLoading(true)
    setResult(null)

    const body = new FormData()
    body.append('file', file)
    body.append('base_number', '1')
    body.append('campaign_name', name.trim())
    body.append('campaign_type', colType)

    try {
      const res  = await fetch('/api/agrosuper/upload-base', { method: 'POST', body })
      const json = await res.json() as Result
      setResult(json)
      if (json.success) setTimeout(() => router.push('/agrosuper/campaigns'), 2500)
    } catch {
      setResult({ success: false, error: 'Error de conexión. Intenta nuevamente.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/agrosuper/campaigns" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nueva Campaña</h1>
          <p className="text-sm text-gray-500 mt-0.5">Crea la campaña y sube la Base 1</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-5">

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre de la campaña y fecha</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Implementación POP RM — May 26"
              disabled={loading}
              required
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Columna</label>
            <select
              value={colType}
              onChange={e => setColType(e.target.value)}
              disabled={loading}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {COLUMN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Excel Base 1 (Datascope)</label>
            <label className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${file ? 'border-[#FF740C] bg-orange-50' : 'border-gray-300 bg-gray-50 hover:border-[#007BFF] hover:bg-blue-50'} ${loading ? 'pointer-events-none opacity-50' : ''}`}>
              <div className="flex flex-col items-center gap-2 px-4 text-center">
                {file ? (
                  <>
                    <FileSpreadsheet className="h-9 w-9" style={{ color: '#FF740C' }} />
                    <span className="text-sm font-semibold text-gray-800">{file.name}</span>
                    <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-9 w-9 text-gray-400" />
                    <span className="text-sm text-gray-600">Arrastra el Excel o haz clic para seleccionar</span>
                    <span className="text-xs text-gray-400">.xlsx · .xls</span>
                  </>
                )}
              </div>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { setFile(e.target.files?.[0] ?? null); setResult(null) }} />
            </label>
          </div>

          <button
            type="submit"
            disabled={!file || !name.trim() || loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 bg-primary"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Creando campaña...</> : <><Upload className="h-4 w-4" />Crear Campaña y subir Base 1</>}
          </button>

          <p className="text-xs text-gray-400 text-center">
            El período se detecta automáticamente desde el Excel.
          </p>
        </Card>
      </form>

      {result && (
        <Card className={`p-4 flex items-start gap-3 border ${result.success ? 'bg-orange-50 border-[#FF740C]' : 'bg-red-50 border-red-200'}`}>
          {result.success ? <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#FF740C' }} /> : <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
          <div>
            {result.success ? (
              <>
                <p className="text-sm font-semibold" style={{ color: '#1E2C3E' }}>Campaña creada — Base 1 importada</p>
                <p className="text-xs mt-1" style={{ color: '#666' }}>{result.imported} locales importados de {result.total} filas.{result.skipped ? ` ${result.skipped} omitidos.` : ''}</p>
                <p className="text-xs mt-1" style={{ color: '#FF740C' }}>Redirigiendo...</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-red-800">{result.error}</p>
                {result.hint    && <p className="text-xs text-red-600 mt-1 break-all">{result.hint}</p>}
                {result.details && <p className="text-xs text-red-600 mt-1 break-all">{result.details}</p>}
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
