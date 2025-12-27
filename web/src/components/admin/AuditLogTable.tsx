// AuditLogTable Component - Audit log viewer

import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminMetrics';

interface AuditLog {
  id: string;
  adminId: string | null;
  adminEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const actionColors: Record<string, string> = {
  ADMIN_LOGIN: 'bg-blue-500/20 text-blue-400',
  UPDATE_USER_TIER: 'bg-purple-500/20 text-purple-400',
  BAN_USER: 'bg-red-500/20 text-red-400',
  UNBAN_USER: 'bg-green-500/20 text-green-400',
  REVOKE_API_KEY: 'bg-orange-500/20 text-orange-400',
  DELETE_USER: 'bg-red-500/20 text-red-400',
  CANCEL_JOB: 'bg-yellow-500/20 text-yellow-400',
  RETRY_JOB: 'bg-blue-500/20 text-blue-400',
};

export function AuditLogTable() {
  const api = useAdminApi();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [actions, setActions] = useState<string[]>([]);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  async function loadLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (actionFilter) params.append('action', actionFilter);

      const data = await api.get(`/admin/api/logs/audit?${params}`);
      setLogs(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadActions() {
    try {
      const actionList = await api.get('/admin/api/logs/actions');
      setActions(actionList);
    } catch (error) {
      console.error('Failed to load action types:', error);
    }
  }

  useEffect(() => {
    loadLogs();
    loadActions();
  }, [pagination.page, actionFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2.5 text-[#F0F6FC] focus:outline-none focus:border-purple-500"
        >
          <option value="">All Actions</option>
          {actions.map(action => (
            <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#21262D] border-b border-[#30363D]">
              <tr>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Timestamp</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Admin</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Action</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Target</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">IP Address</th>
                <th className="text-right text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363D]">
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-40"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-28"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-28"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-8 ml-auto"></div></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#8B949E]">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <>
                    <tr key={log.id} className="hover:bg-[#21262D]/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-[#8B949E]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-[#F0F6FC]">
                        {log.adminEmail || 'System'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${actionColors[log.action] || 'bg-gray-500/20 text-gray-400'}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#8B949E]">
                        {log.targetType && (
                          <span>
                            {log.targetType}: <span className="font-mono text-xs">{log.targetId?.slice(0, 8)}...</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-[#8B949E]">
                        {log.ipAddress || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {log.details && (
                          <button
                            onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                            className="p-2 rounded-lg hover:bg-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] transition-colors"
                          >
                            <svg className={`w-4 h-4 transform transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedLog === log.id && log.details && (
                      <tr key={`${log.id}-details`}>
                        <td colSpan={6} className="px-6 py-4 bg-[#0D1117]">
                          <pre className="text-xs text-[#8B949E] overflow-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#30363D]">
            <div className="text-sm text-[#8B949E]">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} logs
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 rounded-lg bg-[#21262D] text-[#F0F6FC] hover:bg-[#30363D] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-[#8B949E]">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1.5 rounded-lg bg-[#21262D] text-[#F0F6FC] hover:bg-[#30363D] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuditLogTable;
