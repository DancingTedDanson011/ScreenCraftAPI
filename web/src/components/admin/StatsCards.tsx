// StatsCards Component - Quick overview stats for dashboard

import { useState, useEffect } from 'react';
import { useAdminApi } from '../../hooks/useAdminMetrics';

interface Stats {
  accounts: number;
  apiKeys: number;
  screenshots: number;
  pdfs: number;
  activeSubscriptions: number;
}

interface ActivityStats {
  screenshotsCreated: number;
  pdfsCreated: number;
  newAccounts: number;
  apiKeysCreated: number;
}

interface StatCardProps {
  title: string;
  value: number | string;
  subValue?: string;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  accentColor: string;
}

function StatCard({ title, value, subValue, icon, trend, trendValue, accentColor }: StatCardProps) {
  const trendColors = {
    up: 'text-green-500',
    down: 'text-red-500',
    neutral: 'text-[#8B949E]',
  };

  const trendIcons = {
    up: 'M5 10l7-7m0 0l7 7m-7-7v18',
    down: 'M19 14l-7 7m0 0l-7-7m7 7V3',
    neutral: 'M5 12h14',
  };

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#8B949E] mb-1">{title}</p>
          <p className={`text-2xl font-bold ${accentColor}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subValue && (
            <p className="text-xs text-[#8B949E] mt-1">{subValue}</p>
          )}
        </div>
        <div className="text-2xl opacity-50">{icon}</div>
      </div>

      {trend && trendValue && (
        <div className={`flex items-center gap-1 mt-3 text-sm ${trendColors[trend]}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={trendIcons[trend]} />
          </svg>
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}

export function StatsCards() {
  const api = useAdminApi();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [dbStats, activityStats] = await Promise.all([
          api.get('/admin/api/metrics/database'),
          api.get('/admin/api/metrics/activity?hours=24'),
        ]);
        setStats(dbStats);
        setActivity(activityStats);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();

    // Refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);

    // Also refresh on custom event
    const handleRefresh = () => loadStats();
    window.addEventListener('admin-refresh', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('admin-refresh', handleRefresh);
    };
  }, []);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 animate-pulse">
            <div className="h-4 bg-[#21262D] rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-[#21262D] rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Accounts"
        value={stats.accounts}
        subValue={activity ? `+${activity.newAccounts} today` : undefined}
        icon="👥"
        trend={activity && activity.newAccounts > 0 ? 'up' : 'neutral'}
        trendValue={activity ? `${activity.newAccounts} new` : undefined}
        accentColor="text-blue-400"
      />
      <StatCard
        title="Active API Keys"
        value={stats.apiKeys}
        subValue={activity ? `+${activity.apiKeysCreated} today` : undefined}
        icon="🔑"
        trend={activity && activity.apiKeysCreated > 0 ? 'up' : 'neutral'}
        trendValue={activity ? `${activity.apiKeysCreated} created` : undefined}
        accentColor="text-green-400"
      />
      <StatCard
        title="Screenshots"
        value={stats.screenshots}
        subValue={activity ? `+${activity.screenshotsCreated} today` : undefined}
        icon="📸"
        trend={activity && activity.screenshotsCreated > 0 ? 'up' : 'neutral'}
        trendValue={activity ? `${activity.screenshotsCreated} today` : undefined}
        accentColor="text-purple-400"
      />
      <StatCard
        title="PDFs Generated"
        value={stats.pdfs}
        subValue={activity ? `+${activity.pdfsCreated} today` : undefined}
        icon="📄"
        trend={activity && activity.pdfsCreated > 0 ? 'up' : 'neutral'}
        trendValue={activity ? `${activity.pdfsCreated} today` : undefined}
        accentColor="text-pink-400"
      />
    </div>
  );
}

export default StatsCards;
