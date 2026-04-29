import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { EvaluacionesUploader } from '@/components/capacitaciones/evaluaciones-uploader'

export default async function NuevaPruebaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('role').eq('id', user?.id ?? '').single()

  if (profile?.role !== 'treid_admin') {
    redirect('/capacitaciones/evaluaciones')
  }

  const { data: files } = await supabase
    .from('evaluacion_files')
    .select('id, file_name, file_path, size_bytes, mime_type, gestor_name, description, created_at, uploaded_by')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-4">
      <Link
        href="/capacitaciones/evaluaciones"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver a Evaluaciones
      </Link>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Evaluaciones</p>
        <h1 className="text-2xl font-black tracking-tight">Nueva prueba</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Sube el archivo de la evaluación (PDF, Word, Excel, imágenes o videos)
        </p>
      </div>

      <EvaluacionesUploader initialFiles={files ?? []} />
    </div>
  )
}
