// MessagesTable Component - Contact messages list for admin panel

import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminMetrics';

interface Message {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'NEW' | 'READ' | 'REPLIED' | 'SPAM' | 'ARCHIVED';
  ipAddress: string | null;
  userAgent: string | null;
  repliedAt: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-500/20 text-blue-400',
  READ: 'bg-gray-500/20 text-gray-400',
  REPLIED: 'bg-green-500/20 text-green-400',
  SPAM: 'bg-red-500/20 text-red-400',
  ARCHIVED: 'bg-yellow-500/20 text-yellow-400',
};

const statusLabels: Record<string, string> = {
  NEW: 'New',
  READ: 'Read',
  REPLIED: 'Replied',
  SPAM: 'Spam',
  ARCHIVED: 'Archived',
};

export function MessagesTable() {
  const api = useAdminApi();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadMessages() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const data = await api.get(`/admin/api/messages?${params}`);
      setMessages(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
  }, [pagination.page, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (pagination.page === 1) {
        loadMessages();
      } else {
        setPagination(p => ({ ...p, page: 1 }));
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => loadMessages();
    window.addEventListener('admin-refresh', handleRefresh);
    return () => window.removeEventListener('admin-refresh', handleRefresh);
  }, []);

  async function handleStatusChange(messageId: string, status: string) {
    setActionLoading(messageId);
    try {
      await api.patch(`/admin/api/messages/${messageId}/status`, { status });
      await loadMessages();
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(prev => prev ? { ...prev, status: status as Message['status'] } : null);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(messageId: string) {
    if (!confirm('Are you sure you want to delete this message?')) return;

    setActionLoading(messageId);
    try {
      await api.delete(`/admin/api/messages/${messageId}`);
      await loadMessages();
      if (selectedMessage?.id === messageId) {
        setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
              placeholder="Search messages by name, email, subject..."
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
          <option value="NEW">New</option>
          <option value="READ">Read</option>
          <option value="REPLIED">Replied</option>
          <option value="SPAM">Spam</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Messages List */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
          <div className="overflow-y-auto max-h-[600px]">
            {loading ? (
              <div className="p-4 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse p-4 border border-[#30363D] rounded-lg">
                    <div className="h-4 bg-[#21262D] rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-[#21262D] rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-[#21262D] rounded w-1/4"></div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="p-8 text-center text-[#8B949E]">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p>No messages found</p>
              </div>
            ) : (
              <div className="divide-y divide-[#30363D]">
                {messages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => {
                      setSelectedMessage(msg);
                      if (msg.status === 'NEW') {
                        handleStatusChange(msg.id, 'READ');
                      }
                    }}
                    className={`w-full text-left p-4 hover:bg-[#21262D] transition-colors ${
                      selectedMessage?.id === msg.id ? 'bg-[#21262D] border-l-2 border-purple-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-[#F0F6FC] truncate">{msg.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[msg.status]}`}>
                        {statusLabels[msg.status]}
                      </span>
                    </div>
                    <p className="text-sm text-[#8B949E] truncate">{msg.email}</p>
                    <p className="text-sm text-[#F0F6FC] font-medium truncate mt-1">{msg.subject}</p>
                    <p className="text-xs text-[#8B949E] mt-1">{formatDate(msg.createdAt)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="border-t border-[#30363D] px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-[#8B949E]">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1.5 rounded-lg bg-[#21262D] text-[#F0F6FC] hover:bg-[#30363D] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1.5 rounded-lg bg-[#21262D] text-[#F0F6FC] hover:bg-[#30363D] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Message Detail */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden">
          {selectedMessage ? (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-[#30363D]">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-[#F0F6FC]">{selectedMessage.subject}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[selectedMessage.status]}`}>
                    {statusLabels[selectedMessage.status]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-[#8B949E]">
                  <span>
                    <strong className="text-[#F0F6FC]">From:</strong> {selectedMessage.name}
                  </span>
                  <span>
                    <strong className="text-[#F0F6FC]">Email:</strong>{' '}
                    <a href={`mailto:${selectedMessage.email}`} className="text-purple-400 hover:underline">
                      {selectedMessage.email}
                    </a>
                  </span>
                </div>
                <p className="text-xs text-[#8B949E] mt-2">{formatDate(selectedMessage.createdAt)}</p>
              </div>

              {/* Message Content */}
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="bg-[#0D1117] rounded-lg p-4 whitespace-pre-wrap text-[#F0F6FC]">
                  {selectedMessage.message}
                </div>

                {/* Metadata */}
                <div className="mt-4 text-xs text-[#8B949E] space-y-1">
                  {selectedMessage.ipAddress && (
                    <p><strong>IP:</strong> {selectedMessage.ipAddress}</p>
                  )}
                  {selectedMessage.userAgent && (
                    <p className="truncate"><strong>User Agent:</strong> {selectedMessage.userAgent}</p>
                  )}
                  {selectedMessage.repliedAt && (
                    <p><strong>Replied:</strong> {formatDate(selectedMessage.repliedAt)}</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-[#30363D] flex flex-wrap gap-2">
                <a
                  href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`}
                  onClick={() => handleStatusChange(selectedMessage.id, 'REPLIED')}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Reply
                </a>
                <select
                  value={selectedMessage.status}
                  onChange={(e) => handleStatusChange(selectedMessage.id, e.target.value)}
                  disabled={actionLoading === selectedMessage.id}
                  className="px-4 py-2 bg-[#21262D] border border-[#30363D] rounded-lg text-[#F0F6FC] focus:outline-none focus:border-purple-500"
                >
                  <option value="NEW">Mark as New</option>
                  <option value="READ">Mark as Read</option>
                  <option value="REPLIED">Mark as Replied</option>
                  <option value="SPAM">Mark as Spam</option>
                  <option value="ARCHIVED">Archive</option>
                </select>
                <button
                  onClick={() => handleDelete(selectedMessage.id)}
                  disabled={actionLoading === selectedMessage.id}
                  className="flex items-center gap-2 px-4 py-2 bg-[#21262D] text-[#F85149] rounded-lg hover:bg-[#F85149]/10 transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-8 text-[#8B949E]">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p>Select a message to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessagesTable;
