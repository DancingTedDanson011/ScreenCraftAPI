// BrowserPoolStatus Component - Display browser pool metrics

import type { BrowserPoolMetrics } from '../../hooks/useAdminMetrics';

interface BrowserPoolStatusProps {
  metrics: BrowserPoolMetrics | null;
}

function formatAge(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}

export function BrowserPoolStatus({ metrics }: BrowserPoolStatusProps) {
  if (!metrics) {
    return (
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-[#21262D] rounded w-1/3 mb-4"></div>
        <div className="space-y-4">
          <div className="h-16 bg-[#21262D] rounded"></div>
          <div className="h-16 bg-[#21262D] rounded"></div>
        </div>
      </div>
    );
  }

  const browserUsage = metrics.totalBrowsers > 0
    ? Math.round((metrics.activeBrowsers / metrics.totalBrowsers) * 100)
    : 0;

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#F0F6FC]">Browser Pool</h3>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${metrics.activeBrowsers > 0 ? 'bg-green-500' : 'bg-[#8B949E]'}`}></div>
          <span className="text-xs text-[#8B949E]">
            {metrics.activeBrowsers > 0 ? 'Active' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[#21262D] rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-purple-400">{metrics.activeBrowsers}</div>
          <div className="text-xs text-[#8B949E] mt-1">Active Browsers</div>
        </div>
        <div className="bg-[#21262D] rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-blue-400">{metrics.activeContexts}</div>
          <div className="text-xs text-[#8B949E] mt-1">Active Contexts</div>
        </div>
      </div>

      {/* Usage Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-[#8B949E]">Pool Utilization</span>
          <span className="text-[#F0F6FC] font-medium">{browserUsage}%</span>
        </div>
        <div className="h-2 bg-[#21262D] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-purple-500 transition-all duration-500"
            style={{ width: `${browserUsage}%` }}
          />
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 pt-3 border-t border-[#30363D]">
        <div className="flex justify-between text-sm">
          <span className="text-[#8B949E]">Total Browsers</span>
          <span className="text-[#F0F6FC]">{metrics.totalBrowsers}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#8B949E]">Total Contexts</span>
          <span className="text-[#F0F6FC]">{metrics.totalContexts}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#8B949E]">Avg Contexts/Browser</span>
          <span className="text-[#F0F6FC]">{metrics.averageContextsPerBrowser.toFixed(1)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#8B949E]">Total Usage Count</span>
          <span className="text-[#F0F6FC]">{metrics.totalUsageCount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#8B949E]">Oldest Browser Age</span>
          <span className="text-[#F0F6FC]">
            {metrics.oldestBrowserAge > 0 ? formatAge(metrics.oldestBrowserAge) : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default BrowserPoolStatus;
