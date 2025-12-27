# Browser Pool Installation Guide

## Prerequisites

- Node.js >= 18.0.0
- NPM or Yarn
- 4GB+ RAM recommended

## Installation Steps

### 1. Install Dependencies

```bash
cd api
npm install
```

This will install:
- `playwright-core` - Browser automation (without browsers)
- All other dependencies from package.json

### 2. Install Playwright Browsers

```bash
# Install only Chromium (recommended for production)
npx playwright install chromium

# Or install all browsers (for testing)
npx playwright install
```

### 3. System Dependencies (Linux/Docker)

If running in Docker or Linux, install system dependencies:

```bash
# Ubuntu/Debian
npx playwright install-deps chromium

# Or manually:
apt-get update && apt-get install -y \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2
```

### 4. Configure Environment

Copy `.env.example` to `.env` and adjust settings:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Browser Pool Configuration
BROWSER_POOL_MAX_BROWSERS=4
BROWSER_POOL_MAX_CONTEXTS_PER_BROWSER=4
BROWSER_POOL_CONTEXT_TIMEOUT=30000
BROWSER_POOL_RECYCLE_AFTER_USES=50
```

### 5. Build TypeScript

```bash
npm run build
```

### 6. Test Installation

Create a test file `test-pool.ts`:

```typescript
import { getBrowserPool } from './src/services/browser-pool/index.js';

async function test() {
  const pool = getBrowserPool();

  const { page, contextId } = await pool.acquirePage();

  await page.goto('https://example.com');
  console.log('Title:', await page.title());

  await pool.releaseContext(contextId);
  await pool.shutdown();
}

test();
```

Run test:

```bash
npx tsx test-pool.ts
```

Expected output:
```
Title: Example Domain
```

## Docker Installation

### Dockerfile Example

```dockerfile
FROM node:20-slim

# Install Playwright dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install Playwright browser
RUN npx playwright install chromium

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Set environment
ENV NODE_ENV=production
ENV BROWSER_HEADLESS=true

EXPOSE 3000

CMD ["npm", "start"]
```

### Docker Compose Example

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - BROWSER_POOL_MAX_BROWSERS=4
      - BROWSER_POOL_MAX_CONTEXTS_PER_BROWSER=4
    mem_limit: 4g
    shm_size: 2g  # Important for browser stability
    restart: unless-stopped
```

## Troubleshooting

### Error: "Browser executable not found"

**Solution**: Install Playwright browsers:
```bash
npx playwright install chromium
```

### Error: "Shared library not found" (Linux)

**Solution**: Install system dependencies:
```bash
npx playwright install-deps chromium
```

### Error: "Cannot allocate memory"

**Solution**: Increase Docker memory limit or reduce pool size:
```env
BROWSER_POOL_MAX_BROWSERS=2
BROWSER_POOL_MAX_CONTEXTS_PER_BROWSER=2
```

### Error: "Session closed" or "Browser disconnected"

**Solution**: Increase `shm_size` in Docker or use `--disable-dev-shm-usage`:
```yaml
# docker-compose.yml
shm_size: 2g
```

Already configured in `browser.config.ts`:
```typescript
args: ['--disable-dev-shm-usage']
```

### High Memory Usage

**Solution**:
1. Enable resource blocking (images, media, fonts)
2. Reduce pool size
3. Lower `recycleAfterUses` value
4. Implement request interception to block unnecessary resources

### Slow Performance

**Solution**:
1. Increase pool size (if memory allows)
2. Use `waitUntil: 'domcontentloaded'` instead of `'networkidle'`
3. Block images/media/fonts
4. Reduce `contextTimeout` for faster recycling

## Performance Tuning

### Low Traffic (< 10 req/min)

```env
BROWSER_POOL_MAX_BROWSERS=2
BROWSER_POOL_MAX_CONTEXTS_PER_BROWSER=2
# Total: 4 concurrent operations
```

### Medium Traffic (10-50 req/min)

```env
BROWSER_POOL_MAX_BROWSERS=4
BROWSER_POOL_MAX_CONTEXTS_PER_BROWSER=4
# Total: 16 concurrent operations
```

### High Traffic (> 50 req/min)

```env
BROWSER_POOL_MAX_BROWSERS=8
BROWSER_POOL_MAX_CONTEXTS_PER_BROWSER=4
# Total: 32 concurrent operations
# Requires 8GB+ RAM
```

## Production Checklist

- [ ] Playwright browsers installed
- [ ] System dependencies installed (Linux/Docker)
- [ ] Environment variables configured
- [ ] Docker memory limits set (4GB+)
- [ ] Docker shm_size set (2GB+)
- [ ] Health check endpoint configured
- [ ] Monitoring/logging enabled
- [ ] Graceful shutdown implemented
- [ ] Rate limiting configured
- [ ] Resource blocking enabled
- [ ] Auto-scaling configured (if using K8s)

## Monitoring

### Health Check Endpoint (Example)

```typescript
import { getBrowserPool } from './services/browser-pool';

app.get('/health', async (req, res) => {
  const pool = getBrowserPool();
  const health = await pool.checkHealth();

  res.status(health.healthy ? 200 : 503).json(health);
});
```

### Metrics to Monitor

- Pool statistics (browsers, contexts)
- Memory usage per process
- Average response time
- Pool exhaustion rate
- Browser crash rate
- Context timeout rate

## Next Steps

1. Integrate with your API routes
2. Implement request validation
3. Add authentication/authorization
4. Configure rate limiting
5. Set up monitoring/alerting
6. Load test your configuration

## Support

For issues, check:
1. Playwright documentation: https://playwright.dev
2. GitHub issues: https://github.com/microsoft/playwright/issues
3. This README troubleshooting section
