// useAdminMetrics - React Hook for Real-time Admin Metrics via WebSocket

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ServerMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  platform: string;
  hostname: string;
  nodeVersion: string;
  pid: number;
}

export interface BrowserPoolMetrics {
  totalBrowsers: number;
  activeBrowsers: number;
  totalContexts: number;
  activeContexts: number;
  averageContextsPerBrowser: number;
  oldestBrowserAge: number;
  totalUsageCount: number;
}

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface AllQueueMetrics {
  screenshot: QueueMetrics;
  pdf: QueueMetrics;
}

export interface OverviewMetrics {
  server: ServerMetrics;
  browser: BrowserPoolMetrics;
  queue: AllQueueMetrics;
  timestamp: string;
}

export interface WebSocketMessage {
  type: 'metrics' | 'alert' | 'job_update' | 'user_activity';
  data: any;
  timestamp: string;
}

export interface UseAdminMetricsOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface UseAdminMetricsReturn {
  metrics: OverviewMetrics | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastUpdate: Date | null;
  alerts: WebSocketMessage[];
  jobUpdates: WebSocketMessage[];
  connect: () => void;
  disconnect: () => void;
  refresh: () => void;
  clearAlerts: () => void;
}

// Dynamic URLs - computed at runtime inside hooks
function getApiUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  return window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : `${window.location.protocol}//${window.location.hostname}`;
}

function getWsUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3000';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return window.location.hostname === 'localhost'
    ? 'ws://localhost:3000'
    : `${protocol}//${window.location.hostname}`;
}

export function useAdminMetrics(options: UseAdminMetricsOptions = {}): UseAdminMetricsReturn {
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
  } = options;

  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [alerts, setAlerts] = useState<WebSocketMessage[]>([]);
  const [jobUpdates, setJobUpdates] = useState<WebSocketMessage[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const token = localStorage.getItem('adminToken');
    if (!token) {
      setError('No authentication token');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(`${getWsUrl()}/admin/ws?token=${encodeURIComponent(token)}`);

      ws.onopen = () => {
        setConnected(true);
        setConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Update connection status in UI
        const statusEl = document.getElementById('ws-status');
        const statusTextEl = document.getElementById('ws-status-text');
        if (statusEl) {
          statusEl.classList.remove('bg-[#8B949E]', 'bg-[#F85149]');
          statusEl.classList.add('ws-connected');
        }
        if (statusTextEl) {
          statusTextEl.textContent = 'Connected';
          statusTextEl.classList.remove('text-[#8B949E]', 'text-[#F85149]');
          statusTextEl.classList.add('text-[#238636]');
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'metrics':
              setMetrics(message.data as OverviewMetrics);
              setLastUpdate(new Date(message.timestamp));
              break;
            case 'alert':
              setAlerts((prev) => [...prev.slice(-49), message]);
              break;
            case 'job_update':
              setJobUpdates((prev) => [...prev.slice(-49), message]);
              break;
            default:
              break;
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        setConnecting(false);
        wsRef.current = null;

        // Update connection status in UI
        const statusEl = document.getElementById('ws-status');
        const statusTextEl = document.getElementById('ws-status-text');
        if (statusEl) {
          statusEl.classList.remove('ws-connected', 'bg-[#8B949E]');
          statusEl.classList.add('bg-[#F85149]');
        }
        if (statusTextEl) {
          statusTextEl.textContent = 'Disconnected';
          statusTextEl.classList.remove('text-[#8B949E]', 'text-[#238636]');
          statusTextEl.classList.add('text-[#F85149]');
        }

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, reconnectInterval);
        } else {
          setError('Max reconnection attempts reached');
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
        setConnecting(false);
      };

      wsRef.current = ws;
    } catch (err) {
      setError('Failed to create WebSocket connection');
      setConnecting(false);
    }
  }, [maxReconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
    setConnecting(false);
  }, []);

  const refresh = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'refresh' }));
    }
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Listen for refresh events from keyboard shortcuts
    const handleRefresh = () => refresh();
    window.addEventListener('admin-refresh', handleRefresh);

    return () => {
      disconnect();
      window.removeEventListener('admin-refresh', handleRefresh);
    };
  }, [autoConnect, connect, disconnect, refresh]);

  return {
    metrics,
    connected,
    connecting,
    error,
    lastUpdate,
    alerts,
    jobUpdates,
    connect,
    disconnect,
    refresh,
    clearAlerts,
  };
}

// Utility hook for fetching admin data
export function useAdminApi() {
  const getToken = () => localStorage.getItem('adminToken');

  const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${getApiUrl()}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  };

  return {
    get: (endpoint: string) => fetchWithAuth(endpoint),
    post: (endpoint: string, data?: any) =>
      fetchWithAuth(endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      }),
    patch: (endpoint: string, data?: any) =>
      fetchWithAuth(endpoint, {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
      }),
    delete: (endpoint: string) =>
      fetchWithAuth(endpoint, { method: 'DELETE' }),
  };
}

export default useAdminMetrics;
