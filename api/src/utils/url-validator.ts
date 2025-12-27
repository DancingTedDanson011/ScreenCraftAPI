/**
 * URL Validator with SSRF Protection
 * Blocks access to internal networks and dangerous protocols
 */

// Blocked IP ranges (SSRF protection)
const BLOCKED_IP_PATTERNS = [
  // Localhost
  /^127\./,
  /^localhost$/i,
  /^::1$/,
  /^\[::1\]$/,

  // Private networks (RFC 1918)
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,

  // Link-local
  /^169\.254\./,
  /^fe80:/i,

  // Docker internal
  /^172\.17\./,
  /^host\.docker\.internal$/i,

  // Kubernetes internal
  /^kubernetes/i,
  /\.local$/i,
  /\.internal$/i,
  /\.cluster$/i,

  // Cloud metadata endpoints
  /^169\.254\.169\.254$/,  // AWS/GCP metadata
  /^metadata\.google\.internal$/i,
  /^metadata\.azure\.internal$/i,
];

// Blocked hostnames
const BLOCKED_HOSTNAMES = [
  'localhost',
  '0.0.0.0',
  'redis',
  'postgres',
  'postgresql',
  'mysql',
  'mongodb',
  'minio',
  'elasticsearch',
  'rabbitmq',
  'memcached',
];

// Allowed protocols
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlValidationError';
  }
}

/**
 * Validates a URL for SSRF protection
 * @param urlString - URL to validate
 * @throws UrlValidationError if URL is blocked
 */
export function validateUrl(urlString: string): void {
  let url: URL;

  try {
    url = new URL(urlString);
  } catch {
    throw new UrlValidationError('Invalid URL format');
  }

  // Check protocol
  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    throw new UrlValidationError(`Protocol ${url.protocol} is not allowed. Use http: or https:`);
  }

  // Check hostname against blocked patterns
  const hostname = url.hostname.toLowerCase();

  // Check blocked hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new UrlValidationError(`Access to ${hostname} is not allowed`);
  }

  // Check blocked IP patterns
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new UrlValidationError('Access to internal networks is not allowed');
    }
  }

  // Check port (block common internal service ports)
  const blockedPorts = [
    5432,  // PostgreSQL
    3306,  // MySQL
    6379,  // Redis
    27017, // MongoDB
    9200,  // Elasticsearch
    5672,  // RabbitMQ
    11211, // Memcached
    9000,  // MinIO
  ];

  if (url.port && blockedPorts.includes(parseInt(url.port))) {
    throw new UrlValidationError(`Port ${url.port} is blocked for security reasons`);
  }
}

/**
 * Check if URL is safe (returns boolean instead of throwing)
 */
export function isUrlSafe(urlString: string): boolean {
  try {
    validateUrl(urlString);
    return true;
  } catch {
    return false;
  }
}
