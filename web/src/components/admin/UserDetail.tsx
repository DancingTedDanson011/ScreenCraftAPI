// UserDetail Component - Detailed user profile for admin panel

import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminMetrics';

interface UserDetails {
  account: {
    id: string;
    email: string;
    tier: string;
    monthlyCredits: number;
    usedCredits: number;
    stripeCustomerId: string | null;
    createdAt: string;
    updatedAt: string;
    lastResetAt: string | null;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    emailVerified: string | null;
    lastLoginAt: string | null;
    createdAt: string;
  } | null;
  apiKeys: Array<{
    id: string;
    prefix: string;
    name: string | null;
    isActive: boolean;
    lastUsedAt: string | null;
    createdAt: string;
  }>;
  recentActivity: {
    screenshots: Array<{
      id: string;
      url: string;
      status: string;
      createdAt: string;
    }>;
    pdfs: Array<{
      id: string;
      url: string | null;
      status: string;
      type: string;
      createdAt: string;
    }>;
  };
  stats: {
    totalScreenshots: number;
    totalPdfs: number;
    apiKeyCount: number;
    hasActiveSubscription: boolean;
  };
}

const tierColors: Record<string, string> = {
  FREE: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  PRO: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  BUSINESS: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  ENTERPRISE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const statusColors: Record<string, string> = {
  COMPLETED: 'text-green-400',
  PENDING: 'text-yellow-400',
  PROCESSING: 'text-blue-400',
  FAILED: 'text-red-400',
};

interface Props {
  userId?: string;
}

export function UserDetail({ userId: propUserId }: Props) {
  const api = useAdminApi();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(100);

  // Extract user ID from prop, query param, or URL path
  const userId = propUserId || (typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('id')
      || window.location.pathname.split('/').pop()
      || ''
    : '');

  async function loadUser() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/admin/api/users/${userId}`);
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
  }, [userId]);

  async function handleAction(action: string, body?: any) {
    setActionLoading(action);
    try {
      await api.post(`/admin/api/users/${userId}/${action}`, body);
      await loadUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleTierChange(tier: string) {
    setActionLoading('tier');
    try {
      await api.patch(`/admin/api/users/${userId}/tier`, { tier });
      await loadUser();
      setShowTierModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update tier');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddBonus() {
    setActionLoading('bonus');
    try {
      await api.post(`/admin/api/users/${userId}/bonus-credits`, { amount: bonusAmount });
      await loadUser();
      setShowBonusModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add bonus credits');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error || 'User not found'}</p>
        <a href="/admin/users" className="text-purple-400 hover:underline mt-2 inline-block">
          Back to Users
        </a>
      </div>
    );
  }

  const isBanned = user.account.tier === 'FREE' && user.account.monthlyCredits === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a
            href="/admin/users"
            className="p-2 rounded-lg hover:bg-[#21262D] text-[#8B949E] hover:text-[#F0F6FC] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div>
            <h1 className="text-2xl font-bold text-[#F0F6FC]">{user.user?.name || user.account.email}</h1>
            <p className="text-[#8B949E]">{user.account.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isBanned ? (
            <button
              onClick={() => handleAction('unban')}
              disabled={actionLoading === 'unban'}
              className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
            >
              Unban User
            </button>
          ) : (
            <button
              onClick={() => handleAction('ban', { reason: 'Banned by admin' })}
              disabled={actionLoading === 'ban'}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              Ban User
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Account Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Details */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[#F0F6FC] mb-4">Account Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#8B949E] uppercase">Account ID</label>
                <p className="text-[#F0F6FC] font-mono text-sm">{user.account.id}</p>
              </div>
              <div>
                <label className="text-xs text-[#8B949E] uppercase">Tier</label>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${tierColors[user.account.tier]}`}>
                    {user.account.tier}
                  </span>
                  <button
                    onClick={() => setShowTierModal(true)}
                    className="text-xs text-purple-400 hover:underline"
                  >
                    Change
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#8B949E] uppercase">Created</label>
                <p className="text-[#F0F6FC]">{new Date(user.account.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <label className="text-xs text-[#8B949E] uppercase">Last Login</label>
                <p className="text-[#F0F6FC]">
                  {user.user?.lastLoginAt ? new Date(user.user.lastLoginAt).toLocaleDateString() : 'Never'}
                </p>
              </div>
              <div>
                <label className="text-xs text-[#8B949E] uppercase">Stripe Customer</label>
                <p className="text-[#F0F6FC] font-mono text-sm">
                  {user.account.stripeCustomerId || 'None'}
                </p>
              </div>
              <div>
                <label className="text-xs text-[#8B949E] uppercase">Subscription</label>
                <p className={user.stats.hasActiveSubscription ? 'text-green-400' : 'text-[#8B949E]'}>
                  {user.stats.hasActiveSubscription ? 'Active' : 'None'}
                </p>
              </div>
            </div>
          </div>

          {/* Credits */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#F0F6FC]">Credits Usage</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBonusModal(true)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                >
                  Add Bonus
                </button>
                <button
                  onClick={() => handleAction('reset-credits')}
                  disabled={actionLoading === 'reset-credits'}
                  className="px-3 py-1.5 text-sm rounded-lg bg-[#21262D] text-[#F0F6FC] hover:bg-[#30363D] transition-colors disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#8B949E]">Used this month</span>
                  <span className="text-[#F0F6FC]">
                    {user.account.usedCredits.toLocaleString()} / {user.account.monthlyCredits.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-[#21262D] rounded-full">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (user.account.usedCredits / user.account.monthlyCredits) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#F0F6FC]">{user.stats.totalScreenshots}</p>
                  <p className="text-xs text-[#8B949E]">Total Screenshots</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#F0F6FC]">{user.stats.totalPdfs}</p>
                  <p className="text-xs text-[#8B949E]">Total PDFs</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#F0F6FC]">{user.stats.apiKeyCount}</p>
                  <p className="text-xs text-[#8B949E]">API Keys</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[#F0F6FC] mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {user.recentActivity.screenshots.length === 0 && user.recentActivity.pdfs.length === 0 ? (
                <p className="text-[#8B949E] text-center py-4">No recent activity</p>
              ) : (
                <>
                  {user.recentActivity.screenshots.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-[#30363D] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm text-[#F0F6FC] truncate max-w-xs">{item.url}</p>
                          <p className="text-xs text-[#8B949E]">{new Date(item.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <span className={`text-xs ${statusColors[item.status]}`}>{item.status}</span>
                    </div>
                  ))}
                  {user.recentActivity.pdfs.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-[#30363D] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm text-[#F0F6FC] truncate max-w-xs">{item.url || `PDF (${item.type})`}</p>
                          <p className="text-xs text-[#8B949E]">{new Date(item.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <span className={`text-xs ${statusColors[item.status]}`}>{item.status}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - API Keys */}
        <div className="space-y-6">
          {/* User Profile */}
          {user.user && (
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-[#F0F6FC] mb-4">User Profile</h2>
              <div className="flex items-center gap-4 mb-4">
                {user.user.image ? (
                  <img src={user.user.image} alt="" className="w-16 h-16 rounded-full" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-2xl text-purple-400">
                      {(user.user.name || user.user.email)[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-[#F0F6FC] font-medium">{user.user.name || 'No name'}</p>
                  <p className="text-sm text-[#8B949E]">{user.user.email}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Email Verified</span>
                  <span className={user.user.emailVerified ? 'text-green-400' : 'text-[#8B949E]'}>
                    {user.user.emailVerified ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8B949E]">Member Since</span>
                  <span className="text-[#F0F6FC]">{new Date(user.user.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* API Keys */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[#F0F6FC] mb-4">API Keys</h2>
            {user.apiKeys.length === 0 ? (
              <p className="text-[#8B949E] text-center py-4">No API keys</p>
            ) : (
              <div className="space-y-3">
                {user.apiKeys.map((key) => (
                  <div key={key.id} className="p-3 bg-[#0D1117] rounded-lg border border-[#30363D]">
                    <div className="flex items-center justify-between mb-1">
                      <code className="text-sm text-[#F0F6FC]">{key.prefix}...</code>
                      <span className={`text-xs px-2 py-0.5 rounded ${key.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {key.isActive ? 'Active' : 'Revoked'}
                      </span>
                    </div>
                    <p className="text-xs text-[#8B949E]">{key.name || 'Unnamed'}</p>
                    <p className="text-xs text-[#8B949E] mt-1">
                      Last used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tier Change Modal */}
      {showTierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[#F0F6FC] mb-4">Change Tier</h3>
            <div className="space-y-2">
              {['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'].map((tier) => (
                <button
                  key={tier}
                  onClick={() => handleTierChange(tier)}
                  disabled={actionLoading === 'tier'}
                  className={`w-full p-3 rounded-lg border text-left transition-colors disabled:opacity-50 ${
                    user.account.tier === tier
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-[#30363D] hover:border-[#8B949E]'
                  }`}
                >
                  <span className={`text-sm font-medium ${tierColors[tier].split(' ')[1]}`}>{tier}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowTierModal(false)}
              className="w-full mt-4 p-2 text-[#8B949E] hover:text-[#F0F6FC] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bonus Credits Modal */}
      {showBonusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[#F0F6FC] mb-4">Add Bonus Credits</h3>
            <div className="mb-4">
              <label className="block text-sm text-[#8B949E] mb-2">Amount</label>
              <input
                type="number"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(Number(e.target.value))}
                min={1}
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg px-4 py-2 text-[#F0F6FC] focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBonusModal(false)}
                className="flex-1 p-2 text-[#8B949E] hover:text-[#F0F6FC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBonus}
                disabled={actionLoading === 'bonus' || bonusAmount < 1}
                className="flex-1 p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
              >
                Add Credits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDetail;
