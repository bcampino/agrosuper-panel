import { Card } from '@/components/ui/card';
import { ArrowUp, ArrowDown } from 'lucide-react';

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
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600';
    if (trend === 'down') return 'text-red-600';
    return 'text-gray-500';
  };

  return (
    <Card
      className={`p-6 ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {value}
              {typeof value === 'number' && <span className="text-lg text-gray-500">{unit}</span>}
            </span>
          </div>
          {description && (
            <p className="mt-2 text-xs text-gray-500">{description}</p>
          )}
        </div>
        {percentage !== undefined && (
          <div className={`flex items-center gap-1 ${getTrendColor()}`}>
            {trend === 'up' && <ArrowUp size={16} />}
            {trend === 'down' && <ArrowDown size={16} />}
            <span className="text-sm font-medium">{percentage}%</span>
          </div>
        )}
      </div>
    </Card>
  );
}
