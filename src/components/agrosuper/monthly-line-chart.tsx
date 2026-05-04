'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card } from '@/components/ui/card'

interface MonthlyDataPoint {
  mes: string
  visitas: number
  implementados: number
  avgRate: number
}

export function MonthlyLineChart({ data }: { data: MonthlyDataPoint[] }) {
  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Evolución Mensual</h3>
        <p className="text-sm text-gray-400">Sin datos suficientes para mostrar el gráfico.</p>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-secondary)' }}>
        Evolución Mensual
      </h3>
      <p className="text-sm text-gray-500 mb-6">Visitas, implementaciones y % promedio por mes</p>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 12, fill: '#6C757D' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="count"
            tick={{ fontSize: 12, fill: '#6C757D' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fontSize: 12, fill: '#6C757D' }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 13 }}
            formatter={(value: any, name: string) => {
              if (name === '% Promedio') return [`${value}%`, name]
              return [value.toLocaleString('es-CL'), name]
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 13, paddingTop: 12 }}
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="visitas"
            name="Visitas"
            stroke="#007BFF"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#007BFF' }}
            activeDot={{ r: 6 }}
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="implementados"
            name="Implementados"
            stroke="#FF740C"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#FF740C' }}
            activeDot={{ r: 6 }}
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="avgRate"
            name="% Promedio"
            stroke="#1E2C3E"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 3, fill: '#1E2C3E' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}
