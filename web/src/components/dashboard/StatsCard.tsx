// StatsCard Component - Displays a single statistic

import React from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
}

export function StatsCard({ label, value, icon, trend, description }: StatsCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-6 hover:border-border/80 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-secondary text-sm font-medium">{label}</span>
        {icon && (
          <div className="text-text-muted">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-text-primary">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>

        {trend && (
          <span
            className={`text-sm font-medium ${
              trend.isPositive ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>

      {description && (
        <p className="text-text-muted text-sm mt-2">{description}</p>
      )}
    </div>
  );
}

export default StatsCard;
