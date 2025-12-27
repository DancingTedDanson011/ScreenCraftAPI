// QuotaCard Component - Displays usage quota progress

import React from 'react';

interface QuotaCardProps {
  label: string;
  used: number;
  limit: number;
  icon?: React.ReactNode;
  suffix?: string;
}

export function QuotaCard({ label, used, limit, icon, suffix = '' }: QuotaCardProps) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  const getProgressColor = () => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (percentage >= 90) return 'Critical';
    if (percentage >= 70) return 'Warning';
    return 'Healthy';
  };

  const getStatusColor = () => {
    if (percentage >= 90) return 'text-red-400';
    if (percentage >= 70) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-6 hover:border-border/80 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <span className="text-text-secondary text-sm font-medium">{label}</span>
        {icon && (
          <div className="text-text-muted">
            {icon}
          </div>
        )}
      </div>

      <div className="mb-4">
        <span className="text-3xl font-bold text-text-primary">
          {used.toLocaleString()}
        </span>
        <span className="text-lg text-text-muted ml-1">
          / {limit.toLocaleString()}{suffix}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-surface-hover rounded-full overflow-hidden mb-3">
        <div
          className={`h-full ${getProgressColor()} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Status */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-muted">
          {Math.round(percentage)}% used
        </span>
        <span className={getStatusColor()}>
          {getStatusText()}
        </span>
      </div>
    </div>
  );
}

export default QuotaCard;
