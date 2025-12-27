// JobTable Component - Job queue management table

import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminMetrics';

interface Job {
  id: string;
  type: 'screenshot' | 'pdf';
  status: string;
  accountId: string;
  url: string | null;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-400',
  PROCESSING: 'bg-blue-500/20 text-blue-400',
  COMPLETED: 'bg-green-500/20 text-green-400',
  FAILED: 'bg-red-500/20 text-red-400',
};

export function JobTable() {
  const api = useAdminApi();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadJobs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        type: typeFilter,
      });
      if (statusFilter) params.append('status', statusFilter);
      if (search) params.append('search', search);

      const data = await api.get(`/admin/api/jobs?${params}`);
      setJobs(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, [pagination.page, typeFilter, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (pagination.page === 1) {
        loadJobs();
      } else {
        setPagination(p => ({ ...p, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  async function handleCancel(jobId: string, type: string) {
    if (!confirm('Are you sure you want to cancel this job?')) return;

    setActionLoading(jobId);
    try {
      await api.post(`/admin/api/jobs/${type}/${jobId}/cancel`);
      await loadJobs();
    } catch (error) {
      console.error('Failed to cancel job:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRetry(jobId: string, type: string) {
    setActionLoading(jobId);
    try {
      await api.post(`/admin/api/jobs/${type}/${jobId}/retry`);
      await loadJobs();
    } catch (error) {
      console.error('Failed to retry job:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(jobId: string, type: string) {
    if (!confirm('Are you sure you want to delete this job?')) return;

    setActionLoading(jobId);
    try {
      await api.delete(`/admin/api/jobs/${type}/${jobId}`);
      await loadJobs();
    } catch (error) {
      console.error('Failed to delete job:', error);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8B949E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by URL..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg pl-10 pr-4 py-2.5 text-[#F0F6FC] placeholder-[#8B949E] focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2.5 text-[#F0F6FC] focus:outline-none focus:border-purple-500"
        >
          <option value="all">All Types</option>
          <option value="screenshot">Screenshots</option>
          <option value="pdf">PDFs</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2.5 text-[#F0F6FC] focus:outline-none focus:border-purple-500"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#21262D] border-b border-[#30363D]">
              <tr>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Job</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Type</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">URL</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Created</th>
                <th className="text-right text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363D]">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-48"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#8B949E]">
                    No jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[#21262D]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs text-[#8B949E]">{job.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        job.type === 'screenshot'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {job.type === 'screenshot' ? 'Screenshot' : 'PDF'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[job.status] || 'bg-gray-500/20 text-gray-400'}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs truncate text-sm text-[#F0F6FC]" title={job.url || ''}>
                        {job.url || '-'}
                      </div>
                      {job.error && (
                        <div className="text-xs text-red-400 mt-1 truncate" title={job.error}>
                          {job.error}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#8B949E]">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(job.status === 'PENDING' || job.status === 'PROCESSING') && (
                          <button
                            onClick={() => handleCancel(job.id, job.type)}
                            disabled={actionLoading === job.id}
                            className="p-2 rounded-lg hover:bg-yellow-500/20 text-yellow-400 transition-colors disabled:opacity-50"
                            title="Cancel Job"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        {job.status === 'FAILED' && (
                          <button
                            onClick={() => handleRetry(job.id, job.type)}
                            disabled={actionLoading === job.id}
                            className="p-2 rounded-lg hover:bg-green-500/20 text-green-400 transition-colors disabled:opacity-50"
                            title="Retry Job"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(job.id, job.type)}
                          disabled={actionLoading === job.id}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-[#8B949E] hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Delete Job"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#30363D]">
            <div className="text-sm text-[#8B949E]">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} jobs
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

export default JobTable;
