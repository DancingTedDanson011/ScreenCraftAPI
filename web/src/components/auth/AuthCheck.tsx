// AuthCheck Component - Protects routes that require authentication

import { useEffect, type ReactNode } from 'react';
import { useStore } from '@nanostores/react';
import {
  isAuthenticatedAtom,
  isLoadingAtom,
  checkSession,
} from '../../stores/authStore';

interface AuthCheckProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

/**
 * AuthCheck Component
 * Wraps content that requires authentication
 * Redirects to login if not authenticated
 */
export function AuthCheck({
  children,
  fallback,
  redirectTo = '/login',
}: AuthCheckProps) {
  const isAuthenticated = useStore(isAuthenticatedAtom);
  const isLoading = useStore(isLoadingAtom);

  useEffect(() => {
    checkSession();
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      )
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    if (typeof window !== 'undefined') {
      window.location.href = redirectTo;
    }
    return null;
  }

  return <>{children}</>;
}

/**
 * Loading Spinner Component
 * Can be used as a custom fallback
 */
export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500">{message}</p>
      </div>
    </div>
  );
}

/**
 * Unauthenticated Message Component
 * Shown when user is not authenticated and no redirect is desired
 */
export function UnauthenticatedMessage({
  message = 'Please log in to continue',
  showLoginButton = true,
}: {
  message?: string;
  showLoginButton?: boolean;
}) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Authentication Required
        </h2>
        <p className="text-gray-500 mb-6">{message}</p>
        {showLoginButton && (
          <a
            href="/login"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Log In
          </a>
        )}
      </div>
    </div>
  );
}

export default AuthCheck;
