'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Upload, FileSpreadsheet, CheckCircle, XCircle, ArrowLeft, Loader2 } from 'lucide-react'

interface Props {
  campaignId: string
  campaignName: string
  monthLabel: string
  defaultBase: number
}

interface Result {
  success: boolean
  imported?: number; skipped?: number; total?: number; base?: number
  error?: string; details?: string
}

export default function UploadBaseForm({ campaignId, campaignName, monthLabel, defaultBase }: Props) {
  const router = useRouter()
  const [baseNumber, setBaseNumber] = useState(String(defaultBase))
  const [file, setFile]             = useState<File | null>(null)
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState<Result | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setResult(null)

    const body = new FormData()
    body.append('file', file)
    body.append('campaign_id', campaignId)
    body.append('base_number', baseNumber)

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
          <h1 className="text-2xl font-bold">Subir Base</h1>
          <p className="text-sm text-gray-500 mt-0.5">Para: <span className="font-medium text-gray-700">{campaignName}</span></p>
        </div>
      </div>

      {/* Campaign context banner */}
      <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: '#f0f8ff', borderLeft: '4px solid #007BFF' }}>
        <p className="font-semibold text-gray-700">{campaignName}</p>
        <p className="text-gray-500 text-xs mt-0.5">{monthLabel}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-5">

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Base</label>
            <select
              value={baseNumber}
              onChange={e => setBaseNumber(e.target.value)}
              disabled={loading}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="1">Base 1 — primera medición</option>
              <option value="2">Base 2 — segunda medición</option>
              <option value="3">Base 3 — tercera medición</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Excel (Datascope)</label>
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
            disabled={!file || loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 bg-primary"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Importando...</>
              : <><Upload className="h-4 w-4" />Importar Base {baseNumber}</>}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Proceso de ~5 a 30 segundos según el tamaño del archivo.
          </p>
        </Card>
      </form>

      {result && (
        <Card className={`p-4 flex items-start gap-3 border ${result.success ? 'bg-orange-50 border-[#FF740C]' : 'bg-red-50 border-red-200'}`}>
          {result.success
            ? <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#FF740C' }} />
            : <XCircle   className="h-5 w-5 text-red-600   shrink-0 mt-0.5" />}
          <div>
            {result.success ? (
              <>
                <p className="text-sm font-semibold" style={{ color: '#1E2C3E' }}>Base {result.base} importada para {campaignName}</p>
                <p className="text-xs mt-1" style={{ color: '#666' }}>{result.imported} locales importados de {result.total} filas.{result.skipped ? ` ${result.skipped} omitidos.` : ''}</p>
                <p className="text-xs mt-1" style={{ color: '#FF740C' }}>Redirigiendo...</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-red-800">{result.error}</p>
                {result.details && <p className="text-xs text-red-600 mt-1 break-all">{result.details}</p>}
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
