import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
} from '@/lib/constants'
import type { Campaign, CampaignLocation } from '@/types'

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>
}

const RESULT_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

const RESULT_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  success: 'Exitoso',
  failed: 'Fallido',
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select(
      '*, creator:users!created_by(id,full_name,email,role), campaign_locations(*, location:locations(id,code,name))'
    )
    .eq('id', id)
    .single()

  if (!campaign) {
    notFound()
  }

  const typedCampaign = campaign as Campaign

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black tracking-tight">{typedCampaign.name}</h1>

      {/* Campaign Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles de la Campaña</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Estado</dt>
              <dd className="mt-1">
                <Badge className={CAMPAIGN_STATUS_COLORS[typedCampaign.status]}>
                  {CAMPAIGN_STATUS_LABELS[typedCampaign.status]}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tipo</dt>
              <dd className="mt-1 font-medium">{typedCampaign.campaign_type ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fecha Inicio</dt>
              <dd className="mt-1 font-medium">{formatDate(typedCampaign.start_date)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Fecha Fin</dt>
              <dd className="mt-1 font-medium">{formatDate(typedCampaign.end_date)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Creador</dt>
              <dd className="mt-1 font-medium">
                {typedCampaign.creator?.full_name ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Alcance</dt>
              <dd className="mt-1 font-medium">
                {typedCampaign.target_type === 'all'
                  ? 'Todos los locales'
                  : typedCampaign.target_type === 'segment'
                    ? 'Por segmento'
                    : 'Individual'}
              </dd>
            </div>
            {typedCampaign.description && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Descripción</dt>
                <dd className="mt-1">{typedCampaign.description}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Locations Table */}
      {typedCampaign.campaign_locations && typedCampaign.campaign_locations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Locales Asignados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Fecha Ejecución</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typedCampaign.campaign_locations.map((cl: CampaignLocation) => (
                  <TableRow key={cl.id}>
                    <TableCell className="font-mono text-sm">
                      {cl.location?.code ?? '—'}
                    </TableCell>
                    <TableCell>{cl.location?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={RESULT_COLORS[cl.result]}>
                        {RESULT_LABELS[cl.result]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cl.executed_at
                        ? new Date(cl.executed_at).toLocaleDateString('es-CL')
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
