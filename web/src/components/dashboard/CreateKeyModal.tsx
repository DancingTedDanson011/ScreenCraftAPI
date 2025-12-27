// CreateKeyModal Component - Modal to create and display new API key

import React, { useState } from 'react';
import type { CreatedApiKey } from '../../lib/api';

interface CreateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name?: string) => Promise<CreatedApiKey>;
}

export function CreateKeyModal({ isOpen, onClose, onCreate }: CreateKeyModalProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await onCreate(name || undefined);
      setCreatedKey(result);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;

    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleClose = () => {
    setStep('form');
    setName('');
    setError(null);
    setCreatedKey(null);
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
            {step === 'form' ? 'Create API Key' : 'API Key Created'}
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
              <div className="mb-6">
                <label
                  htmlFor="keyName"
                  className="block text-sm font-medium text-text-secondary mb-2"
                >
                  Key Name (optional)
                </label>
                <input
                  type="text"
                  id="keyName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Production Server"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all"
                  autoFocus
                />
                <p className="text-text-muted text-sm mt-2">
                  A friendly name to help you identify this key.
                </p>
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
                  {isLoading ? 'Creating...' : 'Create Key'}
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
                      Save this key now!
                    </p>
                    <p className="text-yellow-400/80 text-sm mt-1">
                      This is the only time you will be able to see this key. Store it securely.
                    </p>
                  </div>
                </div>
              </div>

              {/* Key Display */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Your API Key
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={createdKey?.key || ''}
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

              {/* Key Info */}
              {createdKey?.name && (
                <div className="mb-6 text-sm">
                  <span className="text-text-muted">Name: </span>
                  <span className="text-text-primary">{createdKey.name}</span>
                </div>
              )}

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

export default CreateKeyModal;
