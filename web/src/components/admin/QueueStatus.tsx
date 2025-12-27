// QueueStatus Component - Display job queue metrics

import type { AllQueueMetrics, QueueMetrics } from '../../hooks/useAdminMetrics';

interface QueueStatusProps {
  metrics: AllQueueMetrics | null;
}

interface QueueCardProps {
  title: string;
  icon: string;
  metrics: QueueMetrics;
  accentColor: string;
}

function QueueCard({ title, icon, metrics, accentColor }: QueueCardProps) {
  const total = metrics.waiting + metrics.active + metrics.completed + metrics.failed;
  const successRate = total > 0
    ? Math.round((metrics.completed / total) * 100)
    : 0;

  return (
    <div className="bg-[#21262D] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="font-medium text-[#F0F6FC]">{title}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="text-center p-2 bg-[#0D1117] rounded">
          <div className="text-lg font-bold text-yellow-500">{metrics.waiting}</div>
          <div className="text-xs text-[#8B949E]">Waiting</div>
        </div>
        <div className="text-center p-2 bg-[#0D1117] rounded">
          <div className={`text-lg font-bold ${accentColor}`}>{metrics.active}</div>
          <div className="text-xs text-[#8B949E]">Active</div>
        </div>
        <div className="text-center p-2 bg-[#0D1117] rounded">
          <div className="text-lg font-bold text-green-500">{metrics.completed}</div>
          <div className="text-xs text-[#8B949E]">Completed</div>
        </div>
        <div className="text-center p-2 bg-[#0D1117] rounded">
          <div className="text-lg font-bold text-red-500">{metrics.failed}</div>
          <div className="text-xs text-[#8B949E]">Failed</div>
        </div>
      </div>

      {/* Success Rate */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[#8B949E]">Success Rate</span>
          <span className="text-[#F0F6FC]">{successRate}%</span>
        </div>
        <div className="h-1.5 bg-[#0D1117] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${successRate}%` }}
          />
        </div>
      </div>

      {metrics.delayed > 0 && (
        <div className="mt-2 text-xs text-orange-400">
          {metrics.delayed} delayed job{metrics.delayed > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

export function QueueStatus({ metrics }: QueueStatusProps) {
  if (!metrics) {
    return (
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-[#21262D] rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-40 bg-[#21262D] rounded"></div>
          <div className="h-40 bg-[#21262D] rounded"></div>
        </div>
      </div>
    );
  }

  const totalActive = metrics.screenshot.active + metrics.pdf.active;
  const totalWaiting = metrics.screenshot.waiting + metrics.pdf.waiting;

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#F0F6FC]">Job Queues</h3>
        <div className="flex items-center gap-3 text-xs">
          {totalActive > 0 && (
            <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
              {totalActive} active
            </span>
          )}
          {totalWaiting > 0 && (
            <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
              {totalWaiting} waiting
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <QueueCard
          title="Screenshots"
          icon="📸"
          metrics={metrics.screenshot}
          accentColor="text-purple-400"
        />
        <QueueCard
          title="PDFs"
          icon="📄"
          metrics={metrics.pdf}
          accentColor="text-blue-400"
        />
      </div>
    </div>
  );
}

export default QueueStatus;
