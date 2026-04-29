import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MOCK_AUDITS, MOCK_MATERIALS } from '@/lib/mock-data';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { formatDate } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AuditDetailPage({ params }: { params: { id: string } }) {
  const audit = MOCK_AUDITS.find(a => a.id === params.id);
  const materials = MOCK_MATERIALS.filter(m => m.audit_id === params.id);

  if (!audit) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Auditoría no encontrada</p>
      </div>
    );
  }

  const getStatusBadge = (rate: number) => {
    if (rate >= 80) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>;
    if (rate >= 50) return <Badge className="bg-yellow-100 text-yellow-800">Parcial</Badge>;
    return <Badge className="bg-red-100 text-red-800">Bajo</Badge>;
  };

  const getMaterialsBySpace = (space: string) => materials.filter(m => m.space === space);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/agrosuper" className="inline-flex items-center justify-center h-8 px-2.5 gap-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground font-medium text-sm">
          <ArrowLeft size={16} />
          Volver
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{audit.location_name}</h1>
          <p className="text-gray-500 mt-2">Auditoría #{audit.form_number}</p>
        </div>
      </div>

      {/* Key Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-600">Implementación</p>
          <p className="text-2xl font-bold mt-2">{audit.implementation_rate}%</p>
          {getStatusBadge(audit.implementation_rate)}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Auditor</p>
          <p className="text-lg font-semibold mt-2">{audit.implementer_name}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Fecha</p>
          <p className="text-lg font-semibold mt-2">
            {formatDate(new Date(audit.submitted_at), 'dd MMM yyyy', { locale: es })}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Teléfono</p>
          <p className="text-lg font-semibold mt-2">{audit.phone}</p>
        </Card>
      </div>

      {/* Metrics by Brand */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-6">Implementación por Marca</h3>
          <div className="space-y-4">
            {[
              { label: 'LA CRIANZA', value: audit.metrics_by_brand.la_crianza },
              { label: 'SUPER CERDO', value: audit.metrics_by_brand.super_cerdo },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-lg font-bold">{item.value}%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-6">Implementación por Espacio</h3>
          <div className="space-y-4">
            {[
              { label: 'PANADERÍA', value: audit.metrics_by_space.panaderia },
              { label: 'FACHADA EXTERNA', value: audit.metrics_by_space.fachada_externa },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-lg font-bold">{item.value}%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600"
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Materials by Space */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LA CRIANZA & SUPER CERDO (Interior) */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Marcas (Interior)</h3>
          <div className="space-y-3">
            {materials
              .filter(m => m.brand !== null)
              .sort((a, b) => (b.brand?.localeCompare(a.brand || '') || 0))
              .map((material) => (
                <div key={material.id} className="flex items-center justify-between pb-3 border-b last:border-b-0">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{material.material}</p>
                    <p className="text-xs text-gray-500">{material.brand}</p>
                  </div>
                  <div className="text-right">
                    {material.implemented ? (
                      <Badge className="bg-green-100 text-green-800">✓ Implementado</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">✗ No implementado</Badge>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </Card>

        {/* PANADERÍA & FACHADA */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Espacios</h3>
          <div className="space-y-3">
            {materials
              .filter(m => m.brand === null)
              .sort((a, b) => a.space.localeCompare(b.space))
              .map((material) => (
                <div key={material.id} className="flex items-center justify-between pb-3 border-b last:border-b-0">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{material.material}</p>
                    <p className="text-xs text-gray-500">{material.space}</p>
                  </div>
                  <div className="text-right">
                    {material.implemented ? (
                      <Badge className="bg-green-100 text-green-800">✓ Implementado</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800">✗ No implementado</Badge>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      </div>

      {/* Summary Stats */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Resumen</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Materiales</p>
            <p className="text-2xl font-bold mt-2">{materials.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Implementados</p>
            <p className="text-2xl font-bold mt-2 text-green-600">{materials.filter(m => m.implemented).length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">No Implementados</p>
            <p className="text-2xl font-bold mt-2 text-red-600">{materials.filter(m => !m.implemented).length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Tasa Éxito</p>
            <p className="text-2xl font-bold mt-2">{audit.implementation_rate}%</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
