// UserMenu Component - Shows current user info with dropdown menu

import { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { userAtom, accountAtom, logout, logoutAll } from '../../stores/authStore';

interface UserMenuProps {
  className?: string;
}

/**
 * UserMenu Component
 * Displays user avatar and name with dropdown for account actions
 */
export function UserMenu({ className = '' }: UserMenuProps) {
  const user = useStore(userAtom);
  const account = useStore(accountAtom);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {/* Avatar */}
        {user.image ? (
          <img
            src={user.image}
            alt={user.name || 'User'}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-medium">
            {initials}
          </div>
        )}

        {/* Name (hidden on mobile) */}
        <span className="hidden md:block text-sm font-medium text-gray-700">
          {user.name || user.email}
        </span>

        {/* Dropdown Arrow */}
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">{user.name || 'User'}</p>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
            {account && (
              <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                {account.tier}
              </span>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <a
              href="/dashboard/settings"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              Account Settings
            </a>
            <a
              href="/dashboard/api-keys"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              API Keys
            </a>
            <a
              href="/dashboard/usage"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              Usage & Billing
            </a>
          </div>

          {/* Logout */}
          <div className="border-t border-gray-100 py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Log Out
            </button>
            <button
              onClick={() => {
                setIsOpen(false);
                logoutAll();
              }}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Log Out of All Devices
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
