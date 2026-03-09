import type { LucideIcon } from 'lucide-react';
import { classNames } from '@/utils/formatters';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray';
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-100',
    icon: 'text-blue-600',
  },
  green: {
    bg: 'bg-success-100',
    icon: 'text-success-600',
  },
  purple: {
    bg: 'bg-purple-100',
    icon: 'text-purple-600',
  },
  orange: {
    bg: 'bg-orange-100',
    icon: 'text-orange-600',
  },
  red: {
    bg: 'bg-danger-100',
    icon: 'text-danger-600',
  },
  gray: {
    bg: 'bg-gray-100',
    icon: 'text-gray-600',
  },
};

export default function StatsCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  trend,
}: StatsCardProps) {
  const colors = colorClasses[color];

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {trend && (
            <p
              className={classNames(
                'text-xs mt-2',
                trend.isPositive ? 'text-success-600' : 'text-danger-600'
              )}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className={classNames('flex items-center justify-center w-12 h-12 rounded-lg', colors.bg)}>
          <Icon className={classNames('w-6 h-6', colors.icon)} />
        </div>
      </div>
    </div>
  );
}
