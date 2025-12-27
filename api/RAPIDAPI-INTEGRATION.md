# RapidAPI Integration - Quick Start

## Setup in 3 Steps

### Step 1: Configure Environment

Add to `.env`:

```env
RAPIDAPI_ENABLED=true
RAPIDAPI_PROXY_SECRET=your_secret_from_rapidapi_dashboard
```

### Step 2: Initialize Services

In your `server.ts` or `app.ts`:

```typescript
import { Redis } from 'ioredis';
import { ApiKeyService } from './services/auth/api-key.service';
import { RapidApiService } from './services/rapidapi/rapidapi.service';
import { createAuthMiddleware } from './middleware';

// Initialize Redis
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
});

// Initialize services
const apiKeyService = new ApiKeyService(redis);
const rapidApiService = new RapidApiService(redis);

// Create auth middleware with RapidAPI support
const authMiddleware = createAuthMiddleware({
  apiKeyService,
  rapidApiService, // <-- This enables RapidAPI support
});

// Apply to all protected routes
fastify.addHook('onRequest', authMiddleware);
```

### Step 3: Use in Routes

Your routes automatically work with both RapidAPI and direct API keys:

```typescript
import { isRapidApiRequest } from './middleware';

fastify.post('/api/v1/screenshot', async (request, reply) => {
  // request.auth is populated by either RapidAPI or API key
  const { accountId, tier, monthlyCredits, usedCredits } = request.auth;

  // Optional: Check request source
  if (isRapidApiRequest(request)) {
    console.log('RapidAPI user:', request.rapidApiHeaders['x-rapidapi-user']);
  }

  // Your existing logic works unchanged
  const screenshot = await screenshotService.create({
    accountId,
    url: request.body.url,
    // ... other options
  });

  return screenshot;
});
```

## Migration from Pure API Key Auth

**Good news:** No breaking changes needed!

### Before (API Key only)

```typescript
const authMiddleware = createAuthMiddleware({
  apiKeyService,
});
```

### After (API Key + RapidAPI)

```typescript
const authMiddleware = createAuthMiddleware({
  apiKeyService,
  rapidApiService, // <-- Just add this
});
```

That's it! Your existing routes work with both authentication methods.

## Testing

### Test RapidAPI Request

```bash
curl -X POST http://localhost:3000/api/v1/screenshot \
  -H "X-RapidAPI-Proxy-Secret: your_secret" \
  -H "X-RapidAPI-User: test_user" \
  -H "X-RapidAPI-Subscription: PRO" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Test API Key Request (still works)

```bash
curl -X POST http://localhost:3000/api/v1/screenshot \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## How Accounts are Created

### RapidAPI Users

- **Email:** `{username}@rapidapi.internal`
- **Created:** Automatically on first request
- **Tier:** Based on `X-RapidAPI-Subscription` header

Example:
- RapidAPI user: `john_doe`
- Email created: `john_doe@rapidapi.internal`
- Subscription: `PRO` → Tier: `PRO`

### Direct API Users

- **Email:** User-provided during signup
- **Created:** Manual account creation
- **Tier:** Set during signup or upgrade

## Subscription Tier Mapping

| RapidAPI Plan | Internal Tier | Credits/Month | Rate Limit/Hour |
|---------------|---------------|---------------|-----------------|
| BASIC, free   | FREE          | 1,000         | 100             |
| PRO, plus     | PRO           | 50,000        | 5,000           |
| BUSINESS, ultra | BUSINESS    | 250,000       | 25,000          |
| ENTERPRISE    | ENTERPRISE    | Unlimited     | 100,000         |

**Custom mapping:** Edit `src/config/rapidapi.config.ts`

## Monitoring RapidAPI Usage

### Check Account Creation

```sql
SELECT email, tier, used_credits, monthly_credits, created_at
FROM accounts
WHERE email LIKE '%@rapidapi.internal'
ORDER BY created_at DESC;
```

### Track Usage by Source

```sql
SELECT
  CASE
    WHEN a.email LIKE '%@rapidapi.internal' THEN 'RapidAPI'
    ELSE 'Direct'
  END as source,
  COUNT(*) as events,
  SUM(ue.credits) as total_credits
FROM usage_events ue
JOIN accounts a ON ue.account_id = a.id
WHERE ue.created_at > NOW() - INTERVAL '24 hours'
GROUP BY source;
```

## Common Issues

### 401: Invalid proxy secret

**Solution:**
1. Check `.env`: `RAPIDAPI_PROXY_SECRET` matches RapidAPI dashboard
2. Verify `RAPIDAPI_ENABLED=true`
3. Restart server after changing `.env`

### Account not created

**Solution:**
1. Check logs for errors during account creation
2. Verify PostgreSQL is accessible
3. Ensure Prisma migrations are up to date: `npx prisma migrate deploy`

### Wrong tier assigned

**Solution:**
1. Check `X-RapidAPI-Subscription` header value
2. Verify mapping in `src/config/rapidapi.config.ts`
3. Unknown subscriptions default to `FREE` tier

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Auth Middleware                     │
│                                                      │
│  ┌────────────────────┐    ┌────────────────────┐  │
│  │  RapidAPI Headers  │    │   API Key Header   │  │
│  │   (Priority 1)     │    │   (Priority 2)     │  │
│  └─────────┬──────────┘    └─────────┬──────────┘  │
│            │                          │             │
│            v                          v             │
│  ┌────────────────────┐    ┌────────────────────┐  │
│  │ RapidApiService    │    │  ApiKeyService     │  │
│  │ - Get/Create Acct  │    │  - Validate Key    │  │
│  │ - Map Subscription │    │  - Load Account    │  │
│  └─────────┬──────────┘    └─────────┬──────────┘  │
│            │                          │             │
│            └──────────┬───────────────┘             │
│                       v                             │
│              request.auth populated                 │
└─────────────────────────────────────────────────────┘
                        │
                        v
┌─────────────────────────────────────────────────────┐
│                 Your Route Handler                   │
│  - Access: request.auth.accountId                   │
│  - Access: request.auth.tier                        │
│  - Access: request.auth.monthlyCredits              │
└─────────────────────────────────────────────────────┘
```

## Next Steps

1. **Enable RapidAPI:** Set `RAPIDAPI_ENABLED=true` in `.env`
2. **Add Proxy Secret:** Get from RapidAPI dashboard
3. **Test Integration:** Use cURL examples above
4. **Monitor Usage:** Track accounts and usage
5. **Publish to RapidAPI:** Submit your API to marketplace

For detailed documentation, see [README-RAPIDAPI.md](./README-RAPIDAPI.md)
