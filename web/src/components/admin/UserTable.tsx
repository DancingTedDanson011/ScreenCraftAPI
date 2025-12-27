// UserTable Component - Paginated user list for admin panel

import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminMetrics';

interface User {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  monthlyCredits: number;
  usedCredits: number;
  apiKeyCount: number;
  createdAt: string;
  lastLoginAt: string | null;
  isBanned: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const tierColors: Record<string, string> = {
  FREE: 'bg-gray-500/20 text-gray-400',
  PRO: 'bg-blue-500/20 text-blue-400',
  BUSINESS: 'bg-purple-500/20 text-purple-400',
  ENTERPRISE: 'bg-yellow-500/20 text-yellow-400',
};

export function UserTable() {
  const api = useAdminApi();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.append('search', search);
      if (tierFilter) params.append('tier', tierFilter);

      const data = await api.get(`/admin/api/users?${params}`);
      setUsers(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [pagination.page, tierFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (pagination.page === 1) {
        loadUsers();
      } else {
        setPagination(p => ({ ...p, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  async function handleBan(userId: string, isBanned: boolean) {
    setActionLoading(userId);
    try {
      await api.post(`/admin/api/users/${userId}/${isBanned ? 'unban' : 'ban'}`);
      await loadUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResetCredits(userId: string) {
    setActionLoading(userId);
    try {
      await api.post(`/admin/api/users/${userId}/reset-credits`);
      await loadUsers();
    } catch (error) {
      console.error('Failed to reset credits:', error);
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
              placeholder="Search users by email or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg pl-10 pr-4 py-2.5 text-[#F0F6FC] placeholder-[#8B949E] focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2.5 text-[#F0F6FC] focus:outline-none focus:border-purple-500"
        >
          <option value="">All Tiers</option>
          <option value="FREE">Free</option>
          <option value="PRO">Pro</option>
          <option value="BUSINESS">Business</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#21262D] border-b border-[#30363D]">
              <tr>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">User</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Tier</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Credits</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">API Keys</th>
                <th className="text-left text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Created</th>
                <th className="text-right text-xs font-medium text-[#8B949E] uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363D]">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-48"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-8"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-[#21262D] rounded w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#8B949E]">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#21262D]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-[#F0F6FC]">{user.email}</div>
                        {user.name && <div className="text-xs text-[#8B949E]">{user.name}</div>}
                        {user.isBanned && (
                          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">Banned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${tierColors[user.tier]}`}>
                        {user.tier}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#F0F6FC]">
                        {user.usedCredits.toLocaleString()} / {user.monthlyCredits.toLocaleString()}
                      </div>
                      <div className="w-24 h-1.5 bg-[#21262D] rounded-full mt-1">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${Math.min(100, (user.usedCredits / user.monthlyCredits) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#F0F6FC]">
                      {user.apiKeyCount}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#8B949E]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleResetCredits(user.id)}
                          disabled={actionLoading === user.id}
                          className="p-2 rounded-lg hover:bg-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] transition-colors disabled:opacity-50"
                          title="Reset Credits"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleBan(user.id, user.isBanned)}
                          disabled={actionLoading === user.id}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                            user.isBanned
                              ? 'hover:bg-green-500/20 text-green-400'
                              : 'hover:bg-red-500/20 text-red-400'
                          }`}
                          title={user.isBanned ? 'Unban User' : 'Ban User'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={user.isBanned ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"} />
                          </svg>
                        </button>
                        <a
                          href={`/admin/users/${user.id}`}
                          className="p-2 rounded-lg hover:bg-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] transition-colors"
                          title="View Details"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </a>
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
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
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

export default UserTable;
