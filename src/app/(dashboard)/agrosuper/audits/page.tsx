'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MOCK_AUDITS } from '@/lib/mock-data';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Search } from 'lucide-react';

export default function AuditsListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'excellent' | 'partial' | 'low'>('all');

  const getStatusBadge = (rate: number) => {
    if (rate >= 80) return <Badge className="bg-green-100 text-green-800">Excelente</Badge>;
    if (rate >= 50) return <Badge className="bg-yellow-100 text-yellow-800">Parcial</Badge>;
    return <Badge className="bg-red-100 text-red-800">Bajo</Badge>;
  };

  const getStatusColor = (rate: number) => {
    if (rate >= 80) return 'border-l-4 border-l-green-600';
    if (rate >= 50) return 'border-l-4 border-l-yellow-600';
    return 'border-l-4 border-l-red-600';
  };

  const filteredAudits = MOCK_AUDITS.filter((audit) => {
    const matchesSearch = audit.location_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         audit.implementer_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'excellent' && audit.implementation_rate >= 80) ||
      (statusFilter === 'partial' && audit.implementation_rate >= 50 && audit.implementation_rate < 80) ||
      (statusFilter === 'low' && audit.implementation_rate < 50);

    return matchesSearch && matchesStatus;
  }).sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Auditorías</h1>
          <p className="text-gray-500 mt-2">Listado completo de auditorías realizadas</p>
        </div>
        <Link href="/agrosuper" className="inline-flex items-center justify-center h-8 px-2.5 gap-1.5 rounded-lg border border-transparent bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/80">
          Volver al Dashboard
        </Link>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Buscar por local o auditor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value: any) => setStatusFilter(value)}
          >
            <option value="all">Todos los estados</option>
            <option value="excellent">Excelente (≥80%)</option>
            <option value="partial">Parcial (50-80%)</option>
            <option value="low">Bajo (&lt;50%)</option>
          </Select>
        </div>
      </Card>

      {/* Results */}
      <div className="text-sm text-gray-500">
        Mostrando {filteredAudits.length} de {MOCK_AUDITS.length} auditorías
      </div>

      {/* Audits List */}
      <div className="space-y-4">
        {filteredAudits.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">No se encontraron auditorías que coincidan con los filtros</p>
          </Card>
        ) : (
          filteredAudits.map((audit) => (
            <Link key={audit.id} href={`/agrosuper/audits/${audit.id}`}>
              <Card className={`p-6 hover:shadow-lg transition-shadow cursor-pointer ${getStatusColor(audit.implementation_rate)}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
                  {/* Location */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Local</p>
                    <p className="text-lg font-bold mt-1">{audit.location_name}</p>
                  </div>

                  {/* Implementer */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Auditor</p>
                    <p className="text-sm mt-1">{audit.implementer_name}</p>
                  </div>

                  {/* Implementation Rate */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Implementación</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600"
                          style={{ width: `${audit.implementation_rate}%` }}
                        />
                      </div>
                      <span className="font-bold text-lg w-12 text-right">{audit.implementation_rate}%</span>
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Fecha</p>
                    <p className="text-sm mt-1">
                      {formatDistanceToNow(new Date(audit.submitted_at), { locale: es, addSuffix: true })}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="text-right">
                    {getStatusBadge(audit.implementation_rate)}
                  </div>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
