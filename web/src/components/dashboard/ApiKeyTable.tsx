// ApiKeyTable Component - Displays API keys with actions

import React, { useState } from 'react';
import type { ApiKeyItem } from '../../lib/api';

interface ApiKeyTableProps {
  keys: ApiKeyItem[];
  onRevoke: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function ApiKeyTable({ keys, onRevoke, isLoading }: ApiKeyTableProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await onRevoke(id);
    } finally {
      setRevokingId(null);
      setShowConfirm(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return 'Never used';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
          <span className="ml-3 text-text-secondary">Loading API keys...</span>
        </div>
      </div>
    );
  }

  if (keys.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center">
        <div className="text-text-muted mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 mx-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-text-primary mb-2">No API Keys</h3>
        <p className="text-text-secondary mb-4">
          Create your first API key to start using the ScreenCraft API.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">
              Name / Key
            </th>
            <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">
              Status
            </th>
            <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">
              Created
            </th>
            <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">
              Last Used
            </th>
            <th className="px-6 py-4 text-right text-sm font-medium text-text-secondary">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {keys.map((key) => (
            <tr key={key.id} className="hover:bg-surface-hover transition-colors">
              <td className="px-6 py-4">
                <div>
                  <div className="font-medium text-text-primary">
                    {key.name || 'Unnamed Key'}
                  </div>
                  <div className="text-sm text-text-muted font-mono">
                    {key.prefix}...
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                {key.isActive ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                    Revoked
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-text-secondary">
                {formatDate(key.createdAt)}
              </td>
              <td className="px-6 py-4 text-sm text-text-secondary">
                {formatRelativeTime(key.lastUsedAt)}
              </td>
              <td className="px-6 py-4 text-right">
                {key.isActive && (
                  <>
                    {showConfirm === key.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setShowConfirm(null)}
                          className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRevoke(key.id)}
                          disabled={revokingId === key.id}
                          className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {revokingId === key.id ? 'Revoking...' : 'Confirm'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowConfirm(key.id)}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ApiKeyTable;
