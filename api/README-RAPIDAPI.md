# RapidAPI Integration Guide

This document explains how the ScreenCraft API integrates with RapidAPI's marketplace.

## Overview

The API supports **dual authentication**:
1. **RapidAPI Headers** - Automatic user provisioning (prioritized)
2. **API Keys** - Direct API access for non-RapidAPI users

When requests come through RapidAPI, the middleware automatically creates/updates user accounts and maps RapidAPI subscriptions to internal tier levels.

## How It Works

### 1. RapidAPI Request Flow

```
RapidAPI User Request
  ↓
RapidAPI adds headers:
  - X-RapidAPI-Proxy-Secret
  - X-RapidAPI-User
  - X-RapidAPI-Subscription
  ↓
Auth Middleware validates:
  1. Check RapidAPI headers (priority)
  2. Fall back to API key if no headers
  ↓
RapidAPI Service:
  - Validates proxy secret
  - Gets/creates account
  - Maps subscription to tier
  ↓
Request.auth populated
  ↓
Rate limiting based on tier
  ↓
Process request
```

### 2. Authentication Priority

The middleware checks authentication in this order:

1. **RapidAPI Headers** (if `RAPIDAPI_ENABLED=true`)
   - Validates `X-RapidAPI-Proxy-Secret`
   - Creates account with email: `{username}@rapidapi.internal`
   - Maps subscription to tier

2. **Authorization Header** (fallback)
   - Validates API key: `Bearer sk_live_...`
   - Looks up existing account

## Configuration

### Environment Variables

Add to `.env`:

```env
# RapidAPI Integration
RAPIDAPI_ENABLED=true
RAPIDAPI_PROXY_SECRET=your_secret_here_from_rapidapi_dashboard
```

### Subscription Tier Mapping

RapidAPI subscriptions are mapped to internal tiers:

| RapidAPI Subscription | Internal Tier | Monthly Credits | Rate Limit |
|-----------------------|---------------|-----------------|------------|
| BASIC, free           | FREE          | 1,000           | 100/hour   |
| PRO, professional, plus | PRO         | 50,000          | 5,000/hour |
| BUSINESS, ultra, mega | BUSINESS      | 250,000         | 25,000/hour|
| ENTERPRISE, unlimited | ENTERPRISE    | Unlimited       | 100,000/hour|

**Default:** If subscription is unknown or missing → `FREE` tier

## RapidAPI Headers

RapidAPI automatically adds these headers to each request:

### Required Headers

```http
X-RapidAPI-Proxy-Secret: <secret_from_rapidapi>
X-RapidAPI-User: <username_of_api_consumer>
```

### Optional Headers

```http
X-RapidAPI-Subscription: <subscription_tier>
```

## Account Management

### Automatic Account Creation

When a RapidAPI user makes their first request:

1. Middleware extracts `X-RapidAPI-User` header
2. Generates email: `{username}@rapidapi.internal`
3. Checks if account exists
4. Creates account if needed with tier based on subscription
5. Caches account info in Redis (1 hour TTL)

### Account Updates

When subscription changes:

1. Middleware detects new `X-RapidAPI-Subscription` value
2. Updates account tier
3. Updates monthly credit limit
4. Invalidates cache

### Account Identification

- **Email Format:** `{rapidapi_username}@rapidapi.internal`
- **Example:** User `john_doe` → `john_doe@rapidapi.internal`

## Usage Tracking

RapidAPI requests are tracked identically to direct API requests:

```typescript
// Automatic tracking on each request
await rapidApiService.trackUsage(
  accountId,
  EventType.SCREENSHOT,
  { url: 'https://example.com', format: 'png' }
);
```

### Credit Costs

| Event Type             | Credits |
|------------------------|---------|
| SCREENSHOT             | 1       |
| SCREENSHOT_FULLPAGE    | 2       |
| PDF                    | 2       |
| PDF_WITH_TEMPLATE      | 3       |

## Code Examples

### Using the Middleware

```typescript
import { createAuthMiddleware } from './middleware';
import { ApiKeyService } from './services/auth/api-key.service';
import { RapidApiService } from './services/rapidapi/rapidapi.service';

const apiKeyService = new ApiKeyService(redis);
const rapidApiService = new RapidApiService(redis);

// Dual authentication middleware
const authMiddleware = createAuthMiddleware({
  apiKeyService,
  rapidApiService, // Optional - enables RapidAPI support
});

fastify.addHook('onRequest', authMiddleware);
```

### Checking Request Source

```typescript
import { isRapidApiRequest } from './middleware';

fastify.post('/screenshot', async (request, reply) => {
  if (isRapidApiRequest(request)) {
    console.log('Request from RapidAPI user');
  } else {
    console.log('Direct API key request');
  }

  // Both request types have request.auth populated
  console.log('Account ID:', request.auth.accountId);
  console.log('Tier:', request.auth.tier);
});
```

## Testing RapidAPI Integration

### Local Testing

Simulate RapidAPI requests using cURL:

```bash
# Set your proxy secret
export RAPIDAPI_SECRET="your_secret_here"

# Make request with RapidAPI headers
curl -X POST http://localhost:3000/api/v1/screenshot \
  -H "X-RapidAPI-Proxy-Secret: $RAPIDAPI_SECRET" \
  -H "X-RapidAPI-User: test_user" \
  -H "X-RapidAPI-Subscription: PRO" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "format": "png"
  }'
```

### Verify Account Creation

```bash
# Check if account was created
psql $DATABASE_URL -c "SELECT * FROM accounts WHERE email = 'test_user@rapidapi.internal';"
```

## Security

### Proxy Secret Validation

The `X-RapidAPI-Proxy-Secret` header is validated against `RAPIDAPI_PROXY_SECRET`:

```typescript
// Configured in src/config/rapidapi.config.ts
export function validateProxySecret(secret: string | undefined): boolean {
  if (!rapidApiConfig.enabled) return false;
  if (!rapidApiConfig.proxySecret) {
    console.warn('RAPIDAPI_PROXY_SECRET not configured');
    return false;
  }
  return secret === rapidApiConfig.proxySecret;
}
```

**Important:** Keep `RAPIDAPI_PROXY_SECRET` secure and never commit to version control.

## Monitoring

### Log RapidAPI Requests

```typescript
// In your route handler
if (request.rapidApiHeaders) {
  console.log('RapidAPI Request:', {
    user: request.rapidApiHeaders['x-rapidapi-user'],
    subscription: request.rapidApiHeaders['x-rapidapi-subscription'],
    accountId: request.auth?.accountId,
  });
}
```

### Track RapidAPI vs Direct API Usage

```sql
-- Count requests by source
SELECT
  CASE
    WHEN email LIKE '%@rapidapi.internal' THEN 'RapidAPI'
    ELSE 'Direct'
  END as source,
  COUNT(*) as request_count
FROM usage_events ue
JOIN accounts a ON ue.account_id = a.id
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY source;
```

## Troubleshooting

### Issue: 401 Unauthorized

**Cause:** Invalid or missing proxy secret

**Solution:**
1. Verify `RAPIDAPI_PROXY_SECRET` is set in `.env`
2. Check RapidAPI dashboard for correct secret
3. Ensure `RAPIDAPI_ENABLED=true`

### Issue: Account Not Created

**Cause:** Missing `X-RapidAPI-User` header

**Solution:**
- Verify RapidAPI is sending the header
- Check middleware logs for errors

### Issue: Wrong Tier Assigned

**Cause:** Subscription mapping not found

**Solution:**
- Check `RAPIDAPI_SUBSCRIPTION_MAPPING` in `src/config/rapidapi.config.ts`
- Add custom subscription names if needed
- Default tier is `FREE` for unknown subscriptions

## API Reference

### RapidApiService

```typescript
class RapidApiService {
  // Get or create account for RapidAPI user
  async getOrCreateAccount(
    rapidApiUser: string,
    subscription?: string
  ): Promise<Account>

  // Update account tier based on subscription
  async updateAccountTier(
    accountId: string,
    newTier: Tier
  ): Promise<Account>

  // Track usage event
  async trackUsage(
    accountId: string,
    eventType: EventType,
    metadata?: Record<string, any>
  ): Promise<void>

  // Check if account has credits
  async hasCredits(
    accountId: string,
    eventType: EventType
  ): Promise<boolean>

  // Get usage statistics
  async getUsageStats(accountId: string): Promise<UsageStats>
}
```

### Middleware Functions

```typescript
// Require RapidAPI headers (strict)
function createRapidApiMiddleware(
  options: RapidApiMiddlewareOptions
): FastifyMiddleware

// Optional RapidAPI headers (permissive)
function createOptionalRapidApiMiddleware(
  options: RapidApiMiddlewareOptions
): FastifyMiddleware

// Check if request is from RapidAPI
function isRapidApiRequest(request: FastifyRequest): boolean
```

## Publishing to RapidAPI

When publishing your API to RapidAPI marketplace:

1. **Configure Proxy Secret**
   - Generate secret in RapidAPI dashboard
   - Add to `.env`: `RAPIDAPI_PROXY_SECRET=...`
   - Enable: `RAPIDAPI_ENABLED=true`

2. **Set Base URL**
   - Production: `https://your-api.com`
   - Staging: `https://staging-api.com`

3. **Configure Pricing Plans**
   - Map RapidAPI plan names to internal tiers
   - Update `RAPIDAPI_SUBSCRIPTION_MAPPING` if needed

4. **Test Integration**
   - Use RapidAPI's testing console
   - Verify account creation
   - Check tier assignment

5. **Monitor Usage**
   - Track RapidAPI requests in logs
   - Monitor credit consumption
   - Set up alerts for rate limit breaches

## Best Practices

1. **Always enable caching** - Redis caching reduces DB load
2. **Log RapidAPI errors** - Monitor proxy secret validation failures
3. **Track subscription changes** - Log tier updates for analytics
4. **Set up alerts** - Monitor unusual traffic patterns
5. **Regular secret rotation** - Update proxy secret periodically
6. **Test subscription tiers** - Verify each tier works correctly

## Support

For RapidAPI-specific issues:
- Check RapidAPI dashboard for proxy secret
- Verify headers are being sent correctly
- Review middleware logs for authentication errors

For API issues:
- Check account creation in database
- Verify tier mapping configuration
- Review usage tracking logs
