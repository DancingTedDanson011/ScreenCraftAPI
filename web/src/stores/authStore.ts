// Auth Store - Nanostores for Authentication State

import { atom, computed } from 'nanostores';

// Types
interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

interface Account {
  id: string;
  tier: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  monthlyCredits: number;
  usedCredits: number;
}

// Normalize API URL: Remove trailing /api if present to avoid /api/api/ double prefix
function normalizeApiUrl(url: string): string {
  const normalized = url.replace(/\/+$/, '');
  if (normalized.endsWith('/api')) {
    return normalized.slice(0, -4);
  }
  return normalized;
}

// API URL from environment
const API_URL = normalizeApiUrl(import.meta.env.PUBLIC_API_URL || 'http://localhost:3000');

// Atoms (reactive state)
export const userAtom = atom<User | null>(null);
export const accountAtom = atom<Account | null>(null);
export const isLoadingAtom = atom(true);
export const authErrorAtom = atom<string | null>(null);

// Computed values
export const isAuthenticatedAtom = computed(userAtom, (user) => user !== null);

export const availableCreditsAtom = computed(accountAtom, (account) => {
  if (!account) return 0;
  return account.monthlyCredits - account.usedCredits;
});

export const tierAtom = computed(accountAtom, (account) => {
  return account?.tier || 'FREE';
});

/**
 * Check current session and load user data
 */
export async function checkSession(): Promise<boolean> {
  isLoadingAtom.set(true);
  authErrorAtom.set(null);

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      userAtom.set(data.user);
      accountAtom.set(data.account);
      return true;
    } else {
      userAtom.set(null);
      accountAtom.set(null);
      return false;
    }
  } catch (error) {
    console.error('Session check failed:', error);
    userAtom.set(null);
    accountAtom.set(null);
    return false;
  } finally {
    isLoadingAtom.set(false);
  }
}

/**
 * Redirect to Google OAuth login
 */
export function login(): void {
  window.location.href = `${API_URL}/api/v1/auth/google`;
}

/**
 * Logout and clear session
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Logout failed:', error);
  } finally {
    userAtom.set(null);
    accountAtom.set(null);
    window.location.href = '/';
  }
}

/**
 * Logout from all devices
 */
export async function logoutAll(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/v1/auth/logout-all`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Logout all failed:', error);
  } finally {
    userAtom.set(null);
    accountAtom.set(null);
    window.location.href = '/';
  }
}

/**
 * Get all active sessions for the current user
 */
export async function getSessions(): Promise<Array<{
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}>> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/sessions`, {
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      return data.sessions;
    }
    return [];
  } catch (error) {
    console.error('Failed to get sessions:', error);
    return [];
  }
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to revoke session:', error);
    return false;
  }
}

/**
 * Refresh user data without full session check
 */
export async function refreshUserData(): Promise<void> {
  if (!userAtom.get()) return;

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      userAtom.set(data.user);
      accountAtom.set(data.account);
    }
  } catch (error) {
    console.error('Failed to refresh user data:', error);
  }
}
