// UsageChart Component - Line chart for usage timeline

import React, { useState, useMemo } from 'react';
import type { UsageTimelineItem } from '../../lib/api';

interface UsageChartProps {
  data: UsageTimelineItem[];
  period: 'day' | 'week' | 'month';
  onPeriodChange: (period: 'day' | 'week' | 'month') => void;
  isLoading?: boolean;
}

export function UsageChart({ data, period, onPeriodChange, isLoading }: UsageChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Calculate chart dimensions and data
  const chartData = useMemo(() => {
    if (!data.length) return { points: [], maxCredits: 0 };

    const maxCredits = Math.max(...data.map((d) => d.credits), 1);
    const chartHeight = 200;
    const chartWidth = 100; // percentage

    const points = data.map((item, index) => {
      const x = (index / (data.length - 1 || 1)) * chartWidth;
      const y = chartHeight - (item.credits / maxCredits) * chartHeight;
      return { ...item, x, y };
    });

    return { points, maxCredits };
  }, [data]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (period === 'day') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Generate SVG path for the line
  const linePath = useMemo(() => {
    if (chartData.points.length < 2) return '';

    return chartData.points.reduce((path, point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }
      return `${path} L ${point.x} ${point.y}`;
    }, '');
  }, [chartData.points]);

  // Generate area path (for gradient fill)
  const areaPath = useMemo(() => {
    if (chartData.points.length < 2) return '';

    const pathStart = `M ${chartData.points[0].x} 200`;
    const pathLine = chartData.points
      .map((p, i) => `L ${p.x} ${p.y}`)
      .join(' ');
    const pathEnd = `L ${chartData.points[chartData.points.length - 1].x} 200 Z`;

    return `${pathStart} ${pathLine} ${pathEnd}`;
  }, [chartData.points]);

  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-text-primary">Usage Over Time</h3>

        {/* Period Selector */}
        <div className="flex bg-background rounded-lg p-1">
          {(['day', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-accent-primary text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-text-muted">
          No usage data available for this period.
        </div>
      ) : (
        <div className="relative h-64">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-text-muted">
            <span>{chartData.maxCredits}</span>
            <span>{Math.round(chartData.maxCredits / 2)}</span>
            <span>0</span>
          </div>

          {/* Chart Area */}
          <div
            className="ml-14 h-full relative"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <svg
              viewBox="0 0 100 200"
              preserveAspectRatio="none"
              className="w-full h-[calc(100%-2rem)]"
            >
              {/* Grid lines */}
              <line
                x1="0"
                y1="0"
                x2="100"
                y2="0"
                stroke="currentColor"
                className="text-border"
                strokeWidth="0.5"
              />
              <line
                x1="0"
                y1="100"
                x2="100"
                y2="100"
                stroke="currentColor"
                className="text-border"
                strokeWidth="0.5"
              />
              <line
                x1="0"
                y1="200"
                x2="100"
                y2="200"
                stroke="currentColor"
                className="text-border"
                strokeWidth="0.5"
              />

              {/* Area fill */}
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#238636" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#238636" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#areaGradient)" />

              {/* Line */}
              <path
                d={linePath}
                fill="none"
                stroke="#238636"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />

              {/* Data points */}
              {chartData.points.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r={hoveredIndex === index ? 4 : 3}
                  fill={hoveredIndex === index ? '#238636' : '#0D1117'}
                  stroke="#238636"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() => setHoveredIndex(index)}
                  className="cursor-pointer"
                />
              ))}
            </svg>

            {/* X-axis labels */}
            <div className="flex justify-between text-xs text-text-muted mt-2">
              {data.length > 0 && (
                <>
                  <span>{formatDate(data[0].date)}</span>
                  {data.length > 2 && (
                    <span>{formatDate(data[Math.floor(data.length / 2)].date)}</span>
                  )}
                  <span>{formatDate(data[data.length - 1].date)}</span>
                </>
              )}
            </div>

            {/* Tooltip */}
            {hoveredIndex !== null && chartData.points[hoveredIndex] && (
              <div
                className="absolute bg-surface border border-border rounded-lg p-3 shadow-lg z-10 pointer-events-none"
                style={{
                  left: `${chartData.points[hoveredIndex].x}%`,
                  top: `${(chartData.points[hoveredIndex].y / 200) * 100}%`,
                  transform: 'translate(-50%, -120%)',
                }}
              >
                <div className="text-text-primary font-medium">
                  {formatDate(chartData.points[hoveredIndex].date)}
                </div>
                <div className="text-sm text-text-secondary mt-1">
                  <div>Credits: {chartData.points[hoveredIndex].credits}</div>
                  <div>Screenshots: {chartData.points[hoveredIndex].screenshots}</div>
                  <div>PDFs: {chartData.points[hoveredIndex].pdfs}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent-primary"></div>
          <span className="text-sm text-text-secondary">Credits Used</span>
        </div>
      </div>
    </div>
  );
}

export default UsageChart;
