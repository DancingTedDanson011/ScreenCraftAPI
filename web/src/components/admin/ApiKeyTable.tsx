// ApiKeyTable Component - API Key management table

import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminMetrics';

interface ApiKey {
  id: string;
  prefix: string;
  name: string | null;
  accountId: string;
  accountEmail: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function ApiKeyTable() {
  const api = useAdminApi();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadKeys() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.append('search', search);
      if (statusFilter) params.append('isActive', statusFilter);

      const data = await api.get(`/admin/api/api-keys?${params}`);
      setKeys(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKeys();
  }, [pagination.page, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (pagination.page === 1) {
        loadKeys();
      } else {
        setPagination(p => ({ ...p, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  async function handleToggleStatus(keyId: string, isActive: boolean) {
    setActionLoading(keyId);
    try {
      await api.post(`/admin/api/api-keys/${keyId}/${isActive ? 'revoke' : 'reactivate'}`);
      await loadKeys();
    } catch (error) {
      console.error('Failed to update API key:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(keyId: string) {
    if (!confirm('Are you sure you want to permanently delete this API key?')) return;

    setActionLoading(keyId);
    try {
      await api.delete(`/admin/api/api-keys/${keyId}`);
      await loadKeys();
    } catch (error) {
      console.error('Failed to delete API key:', error);
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
              placeholder="Search by prefix, name, or account email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg pl-10 pr-4 py-2.5 text-[#F0F6FC] placeholder-[#8B949E] focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2.5 text-[#F0F6FC] focus:outline-none focus:border-purple-500"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Revoked</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#21262D] border-b border-[#30363D]">
              <tr>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">API Key</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Account</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Last Used</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Created</th>
                <th className="text-right text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363D]">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-40"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#8B949E]">
                    No API keys found
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr key={key.id} className="hover:bg-[#21262D]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-mono text-sm text-[#F0F6FC]">{key.prefix}...</div>
                        {key.name && <div className="text-xs text-[#8B949E]">{key.name}</div>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#F0F6FC]">
                      <a href={`/admin/users/${key.accountId}`} className="hover:text-purple-400 transition-colors">
                        {key.accountEmail}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        key.isActive
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {key.isActive ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#8B949E]">
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 text-sm text-[#8B949E]">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleStatus(key.id, key.isActive)}
                          disabled={actionLoading === key.id}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                            key.isActive
                              ? 'hover:bg-red-500/20 text-red-400'
                              : 'hover:bg-green-500/20 text-green-400'
                          }`}
                          title={key.isActive ? 'Revoke Key' : 'Reactivate Key'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                              key.isActive
                                ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            } />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(key.id)}
                          disabled={actionLoading === key.id}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-[#8B949E] hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Delete Key"
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
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} keys
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

export default ApiKeyTable;
