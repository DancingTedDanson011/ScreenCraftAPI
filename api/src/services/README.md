# ScreenCraft API Services

This directory contains core services for the ScreenCraft API.

## Services Overview

### StorageService (MinIO/S3)

Handles file storage operations using MinIO (S3-compatible).

**Features:**
- Upload screenshots and PDFs to object storage
- Generate signed URLs with configurable expiration
- Delete files from storage
- Automatic bucket creation
- Path generation for organized storage

**Usage:**

```typescript
import { storageService } from './services';

// Initialize (creates bucket if not exists)
await storageService.initialize();

// Upload a screenshot
const screenshotBuffer = Buffer.from(imageData);
const key = storageService.generateScreenshotKey('user123', 'homepage.png');
await storageService.upload(key, screenshotBuffer, 'image/png');

// Get signed URL (expires in 1 hour by default)
const url = await storageService.getSignedUrl(key);
// Custom expiration (30 minutes)
const url30min = await storageService.getSignedUrl(key, 1800);

// Delete a file
await storageService.delete(key);

// Check if file exists
const exists = await storageService.exists(key);
```

**Storage Structure:**
```
screenshots/
  {userId}/
    {timestamp}-{filename}
pdfs/
  {userId}/
    {timestamp}-{filename}
```

---

### CacheService (Redis)

Handles caching operations using Redis.

**Features:**
- Generic get/set operations with TTL support
- Screenshot and PDF cache key generation
- API key caching for faster authentication
- Rate limiting support
- Pattern-based cache invalidation
- Health checks

**Usage:**

```typescript
import { cacheService } from './services';

// Basic operations
await cacheService.set('mykey', { data: 'value' }, 3600); // 1 hour TTL
const data = await cacheService.get('mykey');
await cacheService.delete('mykey');

// Screenshot caching
const cacheKey = cacheService.generateScreenshotCacheKey(
  'https://example.com',
  { width: 1920, height: 1080, fullPage: true }
);
await cacheService.set(cacheKey, screenshotBuffer, 86400); // 24 hours

// API key caching
await cacheService.cacheApiKey(apiKeyHash, {
  id: 'key123',
  userId: 'user123',
  name: 'Production API',
  tier: 'pro',
  rateLimit: 1000,
  createdAt: new Date(),
});

const apiKey = await cacheService.getApiKey(apiKeyHash);

// Rate limiting
const count = await cacheService.incrementRateLimit('user123', 900); // 15 min window
if (count > 100) {
  throw new Error('Rate limit exceeded');
}

// Pattern deletion
await cacheService.deletePattern('user:123:*');

// Health check
const isHealthy = await cacheService.healthCheck();
```

---

## Configuration

All services are configured via environment variables (see `.env.example`):

### MinIO/S3
```env
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=screenshots
MINIO_USE_SSL=false
```

### Redis
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

## Error Handling

All services throw descriptive errors:

```typescript
try {
  await storageService.upload(key, buffer, 'image/png');
} catch (error) {
  console.error('Upload failed:', error.message);
  // Handle error appropriately
}
```

---

## Testing

Health checks are available for both services:

```typescript
// Storage (checks bucket access)
await storageService.initialize();

// Cache (ping/pong)
const redisHealthy = await cacheService.healthCheck();
```

---

## Development

Both services use singleton patterns and are initialized from environment variables automatically. You can also create custom instances:

```typescript
import { StorageService, CacheService } from './services';

// Custom storage instance
const customStorage = new StorageService({
  endpoint: 'custom-endpoint.com',
  bucket: 'custom-bucket',
});

// Custom cache instance
const customCache = new CacheService({
  host: 'custom-redis.com',
  keyPrefix: 'custom:',
});
```

---

## Docker Setup

Start all infrastructure services:

```bash
npm run docker:up
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- MinIO (port 9000, console 9001)

Access MinIO console: http://localhost:9001
- Username: minioadmin
- Password: minioadmin
