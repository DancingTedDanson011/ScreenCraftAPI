# Auth System Quick Start Guide

Get the ScreenCraft API auth system up and running in 5 minutes.

---

## Prerequisites

- PostgreSQL running (via Docker or local)
- Redis running (via Docker or local)
- Node.js 20+

---

## Step 1: Start Infrastructure

```bash
# Start PostgreSQL and Redis with Docker
npm run docker:up

# Or start individually:
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=screencraft postgres:16-alpine
docker run -d -p 6379:6379 redis:7-alpine
```

---

## Step 2: Configure Environment

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
DATABASE_URL="postgresql://postgres:screencraft@localhost:5432/screencraft"

# Redis
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# Server
PORT=3000
NODE_ENV=development
```

---

## Step 3: Generate Prisma Client & Run Migrations

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations (creates tables)
npm run prisma:migrate

# Seed test data (optional)
npm run prisma:seed
```

**Output:**
```
✅ Created account: free@screencraft.dev (FREE)
   🔑 API Key: sk_test_abc123...
   📋 Prefix: sk_test_abc12345
```

💾 **Save these API keys!** They're shown only once.

---

## Step 4: Test Authentication

### Start the Server

```bash
npm run dev
```

### Test with cURL

```bash
# Test without API key (should fail)
curl http://localhost:3000/v1/health

# Test with API key
curl -H "Authorization: Bearer sk_test_abc123..." \
  http://localhost:3000/v1/health
```

---

## Step 5: Integrate Into Your App

### Basic Integration

Create `src/app.ts`:

```typescript
import Fastify from 'fastify';
import { setupAuthSystem } from './lib/auth-setup.example.js';

const app = Fastify();
const {
  authMiddleware,
  rateLimitMiddleware,
  usageService,
} = setupAuthSystem();

// Protected route
app.post('/v1/screenshot', {
  preHandler: [authMiddleware, rateLimitMiddleware],
}, async (request, reply) => {
  const { auth } = request;

  // Your screenshot logic here...

  return { success: true };
});

app.listen({ port: 3000 });
```

---

## Step 6: Create Your First API Key

### Option A: Using Prisma Studio (GUI)

```bash
npm run prisma:studio
```

1. Open http://localhost:5555
2. Create an `Account`
3. Note the account ID
4. Use the API key service to generate a key

### Option B: Using Code

Create `scripts/create-api-key.ts`:

```typescript
import { ApiKeyService } from './src/services/auth/api-key.service.js';
import { Redis } from 'ioredis';

const redis = new Redis();
const apiKeyService = new ApiKeyService(redis);

const accountId = 'your-account-uuid';

const apiKey = await apiKeyService.createApiKey(
  accountId,
  'Production Key',
  'live'
);

console.log('API Key:', apiKey.key);
console.log('Save this key securely!');

await redis.quit();
process.exit(0);
```

Run it:

```bash
tsx scripts/create-api-key.ts
```

---

## Common Commands

```bash
# Development
npm run dev                  # Start server with hot reload
npm run worker:dev          # Start queue worker

# Database
npm run prisma:generate     # Generate Prisma client
npm run prisma:migrate      # Run migrations
npm run prisma:studio       # Open Prisma Studio
npm run prisma:seed         # Seed test data

# Docker
npm run docker:up           # Start all services
npm run docker:down         # Stop all services
npm run docker:logs         # View logs
```

---

## Testing the System

### 1. Test Authentication

```bash
# Missing auth
curl http://localhost:3000/v1/screenshot
# Response: 401 Unauthorized

# Valid auth
curl -H "Authorization: Bearer sk_test_..." \
  -X POST http://localhost:3000/v1/screenshot \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
# Response: Success
```

### 2. Test Rate Limiting

```bash
# Send requests until rate limit
for i in {1..101}; do
  curl -H "Authorization: Bearer sk_test_..." \
    http://localhost:3000/v1/screenshot
done
# After 100 requests: 429 Too Many Requests
```

### 3. Test Usage Tracking

Check credits used:

```bash
curl -H "Authorization: Bearer sk_test_..." \
  http://localhost:3000/v1/usage
```

Response:
```json
{
  "tier": "FREE",
  "usedCredits": 50,
  "remainingCredits": 950,
  "monthlyCredits": 1000
}
```

---

## Troubleshooting

### Database Connection Error

```
Error: Can't reach database server
```

**Fix:**
- Check PostgreSQL is running: `docker ps`
- Verify `DATABASE_URL` in `.env`
- Test connection: `psql $DATABASE_URL`

### Redis Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Fix:**
- Check Redis is running: `docker ps`
- Verify `REDIS_HOST` and `REDIS_PORT` in `.env`
- Test connection: `redis-cli ping`

### Prisma Client Not Generated

```
Error: @prisma/client did not initialize yet
```

**Fix:**
```bash
npm run prisma:generate
```

### API Key Not Working

```
401 Unauthorized - Invalid API key
```

**Fix:**
- Check you're using the **raw key** (starts with `sk_`)
- Verify key hasn't been revoked
- Check key exists in database: `npm run prisma:studio`

---

## Next Steps

1. **Read the full docs**: `AUTH_SYSTEM_README.md`
2. **Customize tiers**: Edit `src/types/auth.types.ts`
3. **Add custom routes**: See examples in `src/lib/auth-setup.example.ts`
4. **Setup monitoring**: Add logging and alerts
5. **Configure backups**: Setup automated DB backups

---

## File Structure

```
api/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Test data seeder
├── src/
│   ├── lib/
│   │   ├── db.ts              # Prisma client
│   │   └── auth-setup.example.ts  # Integration examples
│   ├── middleware/
│   │   ├── auth.middleware.ts     # Auth validation
│   │   └── rate-limit.middleware.ts  # Rate limiting
│   ├── services/
│   │   ├── auth/
│   │   │   └── api-key.service.ts
│   │   └── billing/
│   │       └── usage.service.ts
│   └── types/
│       └── auth.types.ts      # Type definitions
├── .env                       # Environment config
└── package.json
```

---

## Support

- **Full Documentation**: `AUTH_SYSTEM_README.md`
- **Code Examples**: `src/lib/auth-setup.example.ts`
- **Schema Reference**: `prisma/schema.prisma`

Happy coding! 🚀
