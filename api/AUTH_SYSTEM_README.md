# ScreenCraft API - Auth System Documentation

## Overview

Comprehensive authentication and authorization system with:
- API Key authentication (SHA256 hashed)
- Tier-based rate limiting (FREE, PRO, BUSINESS, ENTERPRISE)
- Credit-based usage tracking
- Redis caching for performance
- PostgreSQL persistent storage

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Request Flow                                             │
├─────────────────────────────────────────────────────────┤
│ 1. Client sends request with API key                    │
│ 2. Auth Middleware validates key (Redis cache → DB)     │
│ 3. Rate Limit Middleware checks tier limits             │
│ 4. Handler checks quota                                 │
│ 5. Process request                                       │
│ 6. Record usage event                                    │
│ 7. Return response with usage info                      │
└─────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Account Table
```prisma
model Account {
  id             String   @id @default(uuid())
  email          String   @unique
  tier           Tier     @default(FREE)
  monthlyCredits Int
  usedCredits    Int      @default(0)
  apiKeys        ApiKey[]
  usageEvents    UsageEvent[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  lastResetAt    DateTime @default(now())
}
```

### ApiKey Table
```prisma
model ApiKey {
  id         String    @id @default(uuid())
  key        String    @unique  // SHA256 hashed
  prefix     String             // Display prefix
  name       String?
  accountId  String
  account    Account   @relation(...)
  isActive   Boolean   @default(true)
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())
  revokedAt  DateTime?
}
```

### UsageEvent Table
```prisma
model UsageEvent {
  id         String    @id @default(uuid())
  accountId  String
  account    Account   @relation(...)
  eventType  EventType
  credits    Int
  metadata   Json?
  createdAt  DateTime  @default(now())
}
```

---

## Setup

### 1. Install Dependencies

Already included in `package.json`:
```json
{
  "@prisma/client": "^5.22.0",
  "ioredis": "^5.4.2",
  "rate-limiter-flexible": "^1.x.x"
}
```

### 2. Environment Variables

Add to `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/screencraft"
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""
```

### 3. Run Migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Start Redis

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

---

## Integration

### Basic Setup

```typescript
import { setupAuthSystem } from './lib/auth-setup.example.js';

const {
  apiKeyService,
  usageService,
  authMiddleware,
  rateLimitMiddleware,
} = setupAuthSystem();
```

### Protected Route

```typescript
app.post('/v1/screenshot', {
  preHandler: [authMiddleware, rateLimitMiddleware],
}, async (request, reply) => {
  const { auth } = request;

  // Check quota
  const credits = usageService.getCreditCost(EventType.SCREENSHOT);
  const hasQuota = await usageService.checkQuota(auth.accountId, credits);

  if (!hasQuota) {
    return reply.status(402).send({
      error: 'Insufficient Credits',
      code: 'INSUFFICIENT_CREDITS',
    });
  }

  // Process request...
  const result = await generateScreenshot(...);

  // Record usage
  await usageService.recordUsage({
    accountId: auth.accountId,
    eventType: EventType.SCREENSHOT,
    credits,
    metadata: { url: request.body.url },
  });

  return reply.send(result);
});
```

---

## API Key Management

### Generate API Key

```typescript
const newKey = await apiKeyService.createApiKey(
  accountId,
  'Production Key',
  'live' // or 'test'
);

// Response:
{
  key: 'sk_live_abc123...', // Show only once!
  prefix: 'sk_live_abc12345',
  keyId: 'uuid',
  accountId: 'uuid'
}
```

### Validate API Key

```typescript
const keyInfo = await apiKeyService.validateApiKey(rawKey);

// Response:
{
  id: 'key-uuid',
  accountId: 'account-uuid',
  tier: 'PRO',
  monthlyCredits: 50000,
  usedCredits: 1234,
  isActive: true
}
```

### Revoke API Key

```typescript
await apiKeyService.revokeApiKey(keyId, accountId);
```

### List API Keys

```typescript
const keys = await apiKeyService.listApiKeys(accountId);

// Response:
[
  {
    id: 'uuid',
    prefix: 'sk_live_abc12345',
    name: 'Production Key',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastUsedAt: '2024-01-15T10:30:00Z',
    revokedAt: null
  }
]
```

---

## Tier Configuration

### Rate Limits

| Tier       | Requests/Hour | Monthly Credits | Block Duration |
|------------|---------------|-----------------|----------------|
| FREE       | 100           | 1,000           | 60s            |
| PRO        | 5,000         | 50,000          | 60s            |
| BUSINESS   | 25,000        | 250,000         | 60s            |
| ENTERPRISE | 100,000       | Unlimited       | 60s            |

### Credit Costs

| Operation              | Credits |
|------------------------|---------|
| Screenshot (viewport)  | 1       |
| Screenshot (full page) | 2       |
| PDF (simple)           | 2       |
| PDF (with template)    | 3       |

### Modify Limits

Edit `src/types/auth.types.ts`:

```typescript
export const TIER_CONFIG: Record<Tier, TierLimits> = {
  FREE: {
    points: 100,      // Requests per hour
    duration: 3600,   // 1 hour
    credits: 1000,    // Monthly credits
  },
  // ...
};

export const CREDIT_COSTS: Record<EventType, number> = {
  SCREENSHOT: 1,
  SCREENSHOT_FULLPAGE: 2,
  PDF: 2,
  PDF_WITH_TEMPLATE: 3,
};
```

---

## Usage Tracking

### Record Usage

```typescript
await usageService.recordUsage({
  accountId: 'account-uuid',
  eventType: EventType.SCREENSHOT,
  credits: 1,
  metadata: {
    url: 'https://example.com',
    viewport: { width: 1920, height: 1080 },
    duration: 1234,
  },
});
```

### Get Usage Stats

```typescript
const stats = await usageService.getUsage(accountId);

// Response:
{
  accountId: 'uuid',
  tier: 'PRO',
  monthlyCredits: 50000,
  usedCredits: 1234,
  remainingCredits: 48766,
  currentPeriodStart: '2024-01-01T00:00:00Z',
  currentPeriodEnd: '2024-02-01T00:00:00Z'
}
```

### Check Quota

```typescript
const hasQuota = await usageService.checkQuota(accountId, 10);
// Returns: true/false
```

### Estimate Cost

```typescript
const cost = usageService.estimateCost({
  eventType: EventType.SCREENSHOT_FULLPAGE,
  quantity: 100,
});

// Response:
{
  credits: 200,
  cost: '$0.2000'
}
```

### Usage Breakdown

```typescript
const breakdown = await usageService.getUsageBreakdown(
  accountId,
  new Date('2024-01-01'),
  new Date('2024-01-31')
);

// Response:
[
  { eventType: 'SCREENSHOT', totalCredits: 500, count: 500 },
  { eventType: 'PDF', totalCredits: 200, count: 100 }
]
```

---

## Rate Limiting

### Response Headers

Every request includes:

```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4999
X-RateLimit-Reset: 2024-01-15T11:00:00Z
X-RateLimit-Tier: PRO
```

### Rate Limit Exceeded (429)

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded for PRO tier. Try again in 45 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 45,
  "tier": "PRO"
}
```

### IP-based Rate Limiting

For unauthenticated requests:
- 20 requests per minute
- Block for 5 minutes if exceeded

```typescript
app.get('/public', {
  preHandler: [ipRateLimitMiddleware],
}, async (request, reply) => {
  // ...
});
```

---

## Error Codes

| Code                      | Status | Description                        |
|---------------------------|--------|------------------------------------|
| `MISSING_AUTH_HEADER`     | 401    | No Authorization header            |
| `INVALID_AUTH_FORMAT`     | 401    | Invalid header format              |
| `INVALID_API_KEY`         | 401    | Key not found or invalid           |
| `REVOKED_API_KEY`         | 401    | Key has been revoked               |
| `RATE_LIMIT_EXCEEDED`     | 429    | Too many requests for tier         |
| `IP_RATE_LIMIT_EXCEEDED`  | 429    | Too many unauthenticated requests  |
| `INSUFFICIENT_CREDITS`    | 402    | Account out of credits             |
| `AUTH_REQUIRED`           | 401    | Auth required for this endpoint    |

---

## Security Best Practices

### API Key Storage

```typescript
// ✅ CORRECT: Hash before storage
const hashedKey = apiKeyService.hashApiKey(rawKey);
await db.apiKey.create({ data: { key: hashedKey } });

// ❌ WRONG: Never store raw keys
await db.apiKey.create({ data: { key: rawKey } });
```

### Key Generation

- Uses `crypto.randomBytes(32)` for cryptographic randomness
- SHA256 hashing for storage
- Prefix for easy identification
- One-time display of raw key

### Redis Caching

- 1-hour TTL for API key lookups
- Automatic invalidation on revoke
- Graceful fallback to DB on cache miss

### Rate Limiting

- Per-account limiting (not IP-based for authenticated)
- Tier-based limits
- 60-second block duration on exceed

---

## Maintenance

### Monthly Credit Reset

Create a cron job:

```typescript
import { UsageService } from './services/billing/index.js';

const usageService = new UsageService();

// Run on 1st of every month
await usageService.resetMonthlyCredits();
```

### Cleanup Old Events

```sql
-- Delete events older than 90 days
DELETE FROM usage_events
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Monitor Redis

```bash
# Check memory usage
redis-cli INFO memory

# Monitor commands
redis-cli MONITOR

# Check key count
redis-cli DBSIZE
```

---

## Testing

### Create Test Account

```typescript
const account = await prisma.account.create({
  data: {
    email: 'test@example.com',
    tier: 'FREE',
    monthlyCredits: 1000,
  },
});

const apiKey = await apiKeyService.createApiKey(account.id, 'Test Key', 'test');
console.log('Test API Key:', apiKey.key);
```

### Test Authentication

```bash
curl -H "Authorization: Bearer sk_test_abc123..." \
  http://localhost:3000/v1/screenshot
```

### Test Rate Limiting

```bash
# Send 101 requests (FREE tier limit is 100/hour)
for i in {1..101}; do
  curl -H "Authorization: Bearer sk_test_..." \
    http://localhost:3000/v1/screenshot
done
```

---

## Files Created

```
api/
├── prisma/
│   └── schema.prisma              # Database schema
├── src/
│   ├── lib/
│   │   ├── db.ts                  # Prisma client singleton
│   │   └── auth-setup.example.ts  # Setup examples
│   ├── middleware/
│   │   ├── auth.middleware.ts     # API key validation
│   │   ├── rate-limit.middleware.ts  # Rate limiting
│   │   └── index.ts
│   ├── services/
│   │   ├── auth/
│   │   │   ├── api-key.service.ts # Key management
│   │   │   └── index.ts
│   │   └── billing/
│   │       ├── usage.service.ts   # Usage tracking
│   │       └── index.ts
│   └── types/
│       └── auth.types.ts          # Type definitions
```

---

## Next Steps

1. **Run migrations**: `npm run prisma:migrate`
2. **Start Redis**: `docker-compose -f docker/docker-compose.yml up redis -d`
3. **Create test account** using Prisma Studio
4. **Generate API key** with `apiKeyService.createApiKey()`
5. **Integrate middlewares** into your routes
6. **Test authentication** with curl/Postman

---

## Support

For issues or questions:
- Check `src/lib/auth-setup.example.ts` for integration examples
- Review error codes and status codes
- Check Redis and PostgreSQL logs
- Verify environment variables

Happy coding! 🚀
