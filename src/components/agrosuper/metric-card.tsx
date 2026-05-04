import { Card } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: number | string;
  percentage?: number;
  trend?: 'up' | 'down' | 'neutral';
  unit?: string;
  description?: string;
  onClick?: () => void;
}

export function MetricCard({
  label,
  value,
  percentage,
  trend,
  unit = '%',
  description,
  onClick,
}: MetricCardProps) {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
  const TrendIcon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus

  return (
    <Card
      className={`p-5 border-l-4 ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      style={{ borderLeftColor: 'var(--color-primary)' }}
      onClick={onClick}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold" style={{ color: 'var(--color-secondary)' }}>
            {value}
          </span>
          {typeof value === 'number' && (
            <span className="text-base font-medium text-gray-400">{unit}</span>
          )}
        </div>
        {(percentage !== undefined || trend) && (
          <div className={`flex items-center gap-1 ${trendColor} shrink-0`}>
            <TrendIcon size={14} />
            {percentage !== undefined && (
              <span className="text-xs font-semibold">{percentage}%</span>
            )}
          </div>
        )}
      </div>
      {description && (
        <p className="mt-2 text-xs text-gray-400">{description}</p>
      )}
    </Card>
  );
}
