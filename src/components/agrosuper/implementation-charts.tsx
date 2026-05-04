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
          <Bar dataKey="value" fill={COLOR_PAN} radius={[0, 6, 6, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={['#007BFF','#3395FF','#66B0FF','#99CBFF'][i]} />
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
          <Bar dataKey="value" fill={COLOR_FACHADA} radius={[0, 6, 6, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={['#FF740C','#FF9139','#FFB380','#FFD4B3'][i]} />
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
  none?: number;
  insight?: string;
}

// Colores por categoría según identidad de marca
const COLOR_LC      = '#1A1A1A' // Negro — La Crianza (logo negro)
const COLOR_SC      = '#CC0000' // Rojo — Super Cerdo (logo rojo)
const COLOR_PAN     = '#007BFF' // Azul — Panadería (Agrosuper azul)
const COLOR_FACHADA = '#FF740C' // Naranja — Fachada (Agrosuper naranja)

const ALL_MATERIALS = [
  { key: 'BANDEJA_JAMON_LC',          label: 'Bandeja Jamón LC',          color: COLOR_LC },
  { key: 'LOGO_VITRINA_LC',           label: 'Logo Vitrina LC',           color: COLOR_LC },
  { key: 'COLGANTE_RECOMENDACION_LC', label: 'Colgante Recomendación LC', color: COLOR_LC },
  { key: 'MARCA_PRECIO_SC',           label: 'Marca Precio SC',           color: COLOR_SC },
  { key: 'HUINCHA_PRECIO_SC',         label: 'Huincha Precio SC',         color: COLOR_SC },
  { key: 'CARTEL_PANADERIA',          label: 'Cartel Panadería',          color: COLOR_PAN },
  { key: 'PORTABOLSAS',               label: 'Portabolsas',               color: COLOR_PAN },
  { key: 'BOLSAS_PAPEL',              label: 'Bolsas de Papel',           color: COLOR_PAN },
  { key: 'TENAZAS_2',                 label: 'Tenazas',                   color: COLOR_PAN },
  { key: 'PALOMA',                    label: 'Paloma',                    color: COLOR_FACHADA },
  { key: 'CENEFA_LC',                 label: 'Cenefa LC',                 color: COLOR_FACHADA },
  { key: 'BANDERA_MURO_LC',           label: 'Bandera Muro LC',           color: COLOR_FACHADA },
  { key: 'BANDERA_RUTERA_LC',         label: 'Bandera Rutera LC',         color: COLOR_FACHADA },
]

export function AllMaterialsChart({ materials }: MaterialChartProps) {
  const chartData = ALL_MATERIALS.map(m => ({
    name:  m.label,
    value: calcMaterialRate(materials, m.key),
    color: m.color,
  })).sort((a, b) => b.value - a.value)

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-1">Implementación por Material POP</h3>
      <p className="text-sm text-gray-500 mb-2">% de locales con cada material implementado</p>
      <div className="flex gap-4 mb-4 flex-wrap">
        {[
          { label: 'La Crianza',  color: COLOR_LC },
          { label: 'Super Cerdo', color: COLOR_SC },
          { label: 'Panadería',   color: COLOR_PAN },
          { label: 'Fachada',     color: COLOR_FACHADA },
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

export function ImplementationDistributionChart({ success, partial, low, none = 0, insight }: DistributionChartProps) {
  const chartData = [
    { name: 'Excelente (≥80%)', value: success, color: '#007BFF' },
    { name: 'Parcial (50-80%)', value: partial, color: '#FF740C' },
    { name: 'Bajo (<50%)', value: low, color: '#EF4444' },
    ...(none > 0 ? [{ name: 'Sin POP (0%)', value: none, color: '#9CA3AF' }] : []),
  ].filter(d => d.value > 0);

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-1">Distribución de Locales</h3>
      {insight && (
        <p className="text-sm text-gray-500 mb-4 leading-relaxed">{insight}</p>
      )}
      {!insight && <div className="mb-4" />}
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
