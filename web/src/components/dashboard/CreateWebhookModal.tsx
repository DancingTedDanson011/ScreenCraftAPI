// CreateWebhookModal Component - Modal to create and display new webhook

import React, { useState } from 'react';
import type { CreatedWebhook } from '../../lib/api';

interface CreateWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (url: string, events: string[]) => Promise<CreatedWebhook>;
}

const AVAILABLE_EVENTS = [
  { value: 'screenshot.completed', label: 'Screenshot Completed' },
  { value: 'screenshot.failed', label: 'Screenshot Failed' },
  { value: 'pdf.completed', label: 'PDF Completed' },
  { value: 'pdf.failed', label: 'PDF Failed' },
];

export function CreateWebhookModal({ isOpen, onClose, onCreate }: CreateWebhookModalProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdWebhook, setCreatedWebhook] = useState<CreatedWebhook | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url) {
      setError('URL is required');
      return;
    }

    if (selectedEvents.length === 0) {
      setError('Please select at least one event');
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setIsLoading(true);

    try {
      const result = await onCreate(url, selectedEvents);
      setCreatedWebhook(result);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdWebhook) return;

    try {
      await navigator.clipboard.writeText(createdWebhook.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const handleClose = () => {
    setStep('form');
    setUrl('');
    setSelectedEvents([]);
    setError(null);
    setCreatedWebhook(null);
    setCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-surface border border-border rounded-xl shadow-lg w-full max-w-md mx-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">
            {step === 'form' ? 'Create Webhook' : 'Webhook Created'}
          </h2>
          <button
            onClick={handleClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'form' ? (
            <form onSubmit={handleSubmit}>
              {/* URL Input */}
              <div className="mb-6">
                <label
                  htmlFor="webhookUrl"
                  className="block text-sm font-medium text-text-secondary mb-2"
                >
                  Endpoint URL
                </label>
                <input
                  type="url"
                  id="webhookUrl"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                  autoFocus
                />
              </div>

              {/* Event Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-secondary mb-3">
                  Events to Subscribe
                </label>
                <div className="space-y-2">
                  {AVAILABLE_EVENTS.map((event) => (
                    <label
                      key={event.value}
                      className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg cursor-pointer hover:border-accent-primary/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event.value)}
                        onChange={() => toggleEvent(event.value)}
                        className="w-4 h-4 rounded border-border text-accent-primary focus:ring-accent-primary focus:ring-offset-0 bg-background"
                      />
                      <span className="text-text-primary text-sm">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Webhook'}
                </button>
              </div>
            </form>
          ) : (
            <div>
              {/* Warning */}
              <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-yellow-400 font-medium text-sm">
                      Save this secret now!
                    </p>
                    <p className="text-yellow-400/80 text-sm mt-1">
                      This is the only time you will be able to see this secret. Use it to verify webhook signatures.
                    </p>
                  </div>
                </div>
              </div>

              {/* Secret Display */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Webhook Secret
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={createdWebhook?.secret || ''}
                    readOnly
                    className="w-full px-4 py-3 pr-24 bg-background border border-border rounded-lg text-text-primary font-mono text-sm focus:outline-none"
                  />
                  <button
                    onClick={handleCopy}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-accent-primary hover:bg-accent-primary/90 text-white text-sm rounded-md font-medium transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Webhook Info */}
              <div className="mb-6 space-y-2 text-sm">
                <div>
                  <span className="text-text-muted">URL: </span>
                  <span className="text-text-primary font-mono">{createdWebhook?.url}</span>
                </div>
                <div>
                  <span className="text-text-muted">Events: </span>
                  <span className="text-text-primary">{createdWebhook?.events.join(', ')}</span>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full px-4 py-2.5 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg font-medium transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateWebhookModal;
