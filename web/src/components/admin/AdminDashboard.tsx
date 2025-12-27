// AdminDashboard Component - Main dashboard with real-time metrics

import { useAdminMetrics } from '../../hooks/useAdminMetrics';
import { ServerHealth } from './ServerHealth';
import { BrowserPoolStatus } from './BrowserPoolStatus';
import { QueueStatus } from './QueueStatus';
import { StatsCards } from './StatsCards';

export function AdminDashboard() {
  const { metrics, connected, lastUpdate, error } = useAdminMetrics();

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Stats Overview */}
      <StatsCards />

      {/* Real-time Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ServerHealth metrics={metrics?.server || null} />
        <BrowserPoolStatus metrics={metrics?.browser || null} />
        <QueueStatus metrics={metrics?.queue || null} />
      </div>

      {/* Connection Status Footer */}
      <div className="flex items-center justify-between text-sm text-[#8B949E] bg-[#161B22] border border-[#30363D] rounded-lg p-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span>
            {connected ? 'Real-time updates active' : 'Disconnected - Reconnecting...'}
          </span>
        </div>
        {lastUpdate && (
          <span>
            Last update: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-[#F0F6FC] mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/admin/users"
            className="flex flex-col items-center gap-2 p-4 bg-[#21262D] rounded-lg hover:bg-[#30363D] transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-sm text-[#F0F6FC]">Manage Users</span>
          </a>

          <a
            href="/admin/api-keys"
            className="flex flex-col items-center gap-2 p-4 bg-[#21262D] rounded-lg hover:bg-[#30363D] transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <span className="text-sm text-[#F0F6FC]">API Keys</span>
          </a>

          <a
            href="/admin/jobs"
            className="flex flex-col items-center gap-2 p-4 bg-[#21262D] rounded-lg hover:bg-[#30363D] transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <span className="text-sm text-[#F0F6FC]">View Jobs</span>
          </a>

          <a
            href="/admin/logs"
            className="flex flex-col items-center gap-2 p-4 bg-[#21262D] rounded-lg hover:bg-[#30363D] transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/30 transition-colors">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm text-[#F0F6FC]">Audit Logs</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
