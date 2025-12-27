// ServerHealth Component - Display server health metrics

import type { ServerMetrics } from '../../hooks/useAdminMetrics';

interface ServerHealthProps {
  metrics: ServerMetrics | null;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

function getStatusColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 75) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function ServerHealth({ metrics }: ServerHealthProps) {
  if (!metrics) {
    return (
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-[#21262D] rounded w-1/3 mb-4"></div>
        <div className="space-y-4">
          <div className="h-4 bg-[#21262D] rounded"></div>
          <div className="h-4 bg-[#21262D] rounded"></div>
          <div className="h-4 bg-[#21262D] rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#F0F6FC]">Server Health</h3>
        <span className="text-xs text-[#8B949E]">{metrics.hostname}</span>
      </div>

      <div className="space-y-4">
        {/* CPU */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[#8B949E]">CPU Usage</span>
            <span className="text-[#F0F6FC] font-medium">{metrics.cpu}%</span>
          </div>
          <div className="h-2 bg-[#21262D] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getStatusColor(metrics.cpu)}`}
              style={{ width: `${metrics.cpu}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-[#8B949E]">Memory</span>
            <span className="text-[#F0F6FC] font-medium">
              {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
            </span>
          </div>
          <div className="h-2 bg-[#21262D] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getStatusColor(metrics.memory.percentage)}`}
              style={{ width: `${metrics.memory.percentage}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#30363D]">
          <div className="bg-[#21262D] rounded-lg p-3">
            <div className="text-xs text-[#8B949E] mb-1">Uptime</div>
            <div className="text-sm font-medium text-[#F0F6FC]">{formatUptime(metrics.uptime)}</div>
          </div>
          <div className="bg-[#21262D] rounded-lg p-3">
            <div className="text-xs text-[#8B949E] mb-1">Platform</div>
            <div className="text-sm font-medium text-[#F0F6FC] capitalize">{metrics.platform}</div>
          </div>
          <div className="bg-[#21262D] rounded-lg p-3">
            <div className="text-xs text-[#8B949E] mb-1">Node.js</div>
            <div className="text-sm font-medium text-[#F0F6FC]">{metrics.nodeVersion}</div>
          </div>
          <div className="bg-[#21262D] rounded-lg p-3">
            <div className="text-xs text-[#8B949E] mb-1">PID</div>
            <div className="text-sm font-medium text-[#F0F6FC]">{metrics.pid}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServerHealth;
