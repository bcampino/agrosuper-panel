'use client';

import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { AgrosuperMaterial } from '@/types/agrosuper';

function calcMaterialRate(materials: AgrosuperMaterial[], materialName: string): number {
  const relevant = materials.filter(m => m.material === materialName);
  if (relevant.length === 0) return 0;
  return Math.round((relevant.filter(m => m.implemented).length / relevant.length) * 100);
}

interface MaterialChartProps {
  materials: AgrosuperMaterial[];
}

export function PanaderiaChart({ materials }: MaterialChartProps) {
  const chartData = [
    { name: 'Cartel Panadería', value: calcMaterialRate(materials, 'CARTEL_PANADERIA') },
    { name: 'Portabolsas',      value: calcMaterialRate(materials, 'PORTABOLSAS') },
    { name: 'Bolsas de papel',  value: calcMaterialRate(materials, 'BOLSAS_PAPEL') },
    { name: 'Tenazas',          value: calcMaterialRate(materials, 'TENAZAS_2') },
  ];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-1">Implementación en Panadería</h3>
      <p className="text-sm text-gray-500 mb-4">% de locales con cada material implementado</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => [`${value}%`, 'Implementado']} />
          <Bar dataKey="value" fill="#FF740C" radius={[0, 6, 6, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={['#FF740C','#FF9139','#FFB380','#FFD4B3'][i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function FachadaChart({ materials }: MaterialChartProps) {
  const chartData = [
    { name: 'Paloma',          value: calcMaterialRate(materials, 'PALOMA') },
    { name: 'Cenefa LC',       value: calcMaterialRate(materials, 'CENEFA_LC') },
    { name: 'Bandera Muro LC', value: calcMaterialRate(materials, 'BANDERA_MURO_LC') },
    { name: 'Bandera Rutera',  value: calcMaterialRate(materials, 'BANDERA_RUTERA_LC') },
  ];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-1">Implementación en Fachada</h3>
      <p className="text-sm text-gray-500 mb-4">% de locales con cada material implementado</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => [`${value}%`, 'Implementado']} />
          <Bar dataKey="value" fill="#007BFF" radius={[0, 6, 6, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={['#007BFF','#3399FF','#66B3FF','#99CCFF'][i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

interface DistributionChartProps {
  success: number;
  partial: number;
  low: number;
}

const ALL_MATERIALS = [
  { key: 'BANDEJA_JAMON_LC',          label: 'Bandeja Jamón LC',          color: '#007BFF' },
  { key: 'LOGO_VITRINA_LC',           label: 'Logo Vitrina LC',           color: '#007BFF' },
  { key: 'COLGANTE_RECOMENDACION_LC', label: 'Colgante Recomendación LC', color: '#007BFF' },
  { key: 'MARCA_PRECIO_SC',           label: 'Marca Precio SC',           color: '#FF740C' },
  { key: 'HUINCHA_PRECIO_SC',         label: 'Huincha Precio SC',         color: '#FF740C' },
  { key: 'CARTEL_PANADERIA',          label: 'Cartel Panadería',          color: '#FF740C' },
  { key: 'PORTABOLSAS',              label: 'Portabolsas',               color: '#FF740C' },
  { key: 'BOLSAS_PAPEL',             label: 'Bolsas de Papel',           color: '#FF740C' },
  { key: 'TENAZAS_2',               label: 'Tenazas',                   color: '#FF740C' },
  { key: 'PALOMA',                   label: 'Paloma',                    color: '#007BFF' },
  { key: 'CENEFA_LC',               label: 'Cenefa LC',                 color: '#007BFF' },
  { key: 'BANDERA_MURO_LC',         label: 'Bandera Muro LC',           color: '#007BFF' },
  { key: 'BANDERA_RUTERA_LC',       label: 'Bandera Rutera LC',         color: '#007BFF' },
]

export function AllMaterialsChart({ materials }: MaterialChartProps) {
  const chartData = ALL_MATERIALS.map(m => ({
    name:  m.label,
    value: calcMaterialRate(materials, m.key),
    color: m.color,
  }))

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-1">Implementación por Material POP</h3>
      <p className="text-sm text-gray-500 mb-2">% de locales con cada material implementado</p>
      <div className="flex gap-4 mb-4 flex-wrap">
        {[
          { label: 'La Crianza',    color: '#007BFF' },
          { label: 'Super Cerdo',   color: '#FF740C' },
          { label: 'Panadería',     color: '#FF740C' },
          { label: 'Fachada',       color: '#007BFF' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: l.color }} />
            <span className="text-xs text-gray-600">{l.label}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 32 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={175} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => [`${value}%`, 'Implementado']} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

export function ImplementationDistributionChart({ success, partial, low }: DistributionChartProps) {
  const chartData = [
    { name: 'Excelente (≥80%)', value: success, color: '#007BFF' },
    { name: 'Parcial (50-80%)', value: partial, color: '#FF740C' },
    { name: 'Bajo (<50%)', value: low, color: '#EF4444' },
  ];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Distribución de Locales</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${value} locales`} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
