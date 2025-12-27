import { storageService, cacheService } from '../services/index.js';
import type { HealthCheckResult } from '../types/index.js';

/**
 * Perform health checks on all services
 * @returns Health check result
 */
export async function checkHealth(): Promise<HealthCheckResult> {
  const services: HealthCheckResult['services'] = {};
  const checks: Promise<{ name: string; healthy: boolean }>[] = [];

  // Redis health check
  checks.push(
    cacheService
      .healthCheck()
      .then((healthy) => ({ name: 'redis', healthy }))
      .catch(() => ({ name: 'redis', healthy: false }))
  );

  // Storage health check (bucket access)
  checks.push(
    storageService
      .initialize()
      .then(() => ({ name: 'storage', healthy: true }))
      .catch(() => ({ name: 'storage', healthy: false }))
  );

  // Wait for all checks
  const results = await Promise.all(checks);

  // Map results
  for (const result of results) {
    services[result.name as keyof HealthCheckResult['services']] = result.healthy;
  }

  // Determine overall status
  const allHealthy = Object.values(services).every((s) => s === true);
  const someHealthy = Object.values(services).some((s) => s === true);

  const status: HealthCheckResult['status'] = allHealthy
    ? 'healthy'
    : someHealthy
    ? 'degraded'
    : 'unhealthy';

  return {
    status,
    services,
    timestamp: new Date().toISOString(),
  };
}
