// WebhookTable Component - Displays webhooks with actions

import React, { useState } from 'react';
import type { WebhookItem } from '../../lib/api';

interface WebhookTableProps {
  webhooks: WebhookItem[];
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function WebhookTable({ webhooks, onDelete, isLoading }: WebhookTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
      setShowConfirm(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const truncateUrl = (url: string, maxLength: number = 40) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  };

  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
          <span className="ml-3 text-text-secondary">Loading webhooks...</span>
        </div>
      </div>
    );
  }

  if (webhooks.length === 0) {
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
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-text-primary mb-2">No Webhooks</h3>
        <p className="text-text-secondary">
          Create a webhook to receive real-time notifications when screenshots or PDFs are completed.
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
              URL
            </th>
            <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">
              Events
            </th>
            <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">
              Status
            </th>
            <th className="px-6 py-4 text-left text-sm font-medium text-text-secondary">
              Last Triggered
            </th>
            <th className="px-6 py-4 text-right text-sm font-medium text-text-secondary">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {webhooks.map((webhook) => (
            <tr key={webhook.id} className="hover:bg-surface-hover transition-colors">
              <td className="px-6 py-4">
                <div className="font-mono text-sm text-text-primary" title={webhook.url}>
                  {truncateUrl(webhook.url)}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  {webhook.events.map((event) => (
                    <span
                      key={event}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent-secondary/20 text-accent-secondary"
                    >
                      {event}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-6 py-4">
                {webhook.isActive ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                      Active
                    </span>
                    {webhook.failCount > 0 && (
                      <span className="text-xs text-yellow-400">
                        {webhook.failCount} failures
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                    Inactive
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-text-secondary">
                {formatDate(webhook.lastTriggeredAt)}
              </td>
              <td className="px-6 py-4 text-right">
                {showConfirm === webhook.id ? (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setShowConfirm(null)}
                      className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(webhook.id)}
                      disabled={deletingId === webhook.id}
                      className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {deletingId === webhook.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowConfirm(webhook.id)}
                    className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default WebhookTable;
