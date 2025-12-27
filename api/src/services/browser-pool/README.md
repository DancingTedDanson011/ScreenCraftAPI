# Browser Pool Service

Production-ready Playwright browser pool with anti-detection and memory optimization.

## Features

- **Pool Management**: Up to 4 browser instances, 4 contexts each (16 concurrent operations)
- **Anti-Detection**: Stealth configurations with randomized fingerprints
- **Memory Efficient**: 500MB target per context with resource blocking
- **Auto-Recycling**: Browsers recycle after 50 uses to prevent memory leaks
- **Health Monitoring**: Automatic cleanup of stale browsers and contexts
- **Graceful Shutdown**: Clean resource cleanup on shutdown

## Installation

```bash
npm install playwright-core
```

## Basic Usage

```typescript
import { getBrowserPool } from './services/browser-pool';

const pool = getBrowserPool();

// Acquire a context
const { context, contextId } = await pool.acquireContext();

try {
  const page = await context.newPage();
  await page.goto('https://example.com');
  const screenshot = await page.screenshot();

  // Do work...
} finally {
  // Always release context
  await pool.releaseContext(contextId);
}
```

## Convenience Method: acquirePage

```typescript
const { page, contextId } = await pool.acquirePage({
  viewport: { width: 1920, height: 1080 }
});

try {
  await page.goto('https://example.com');
  const screenshot = await page.screenshot({ fullPage: true });
} finally {
  await pool.releaseContext(contextId);
}
```

## Custom Context Options

```typescript
const { context, contextId } = await pool.acquireContext({
  // Override stealth config
  userAgent: 'Custom User Agent',
  viewport: { width: 1366, height: 768 },
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',

  // Geolocation
  geolocation: { latitude: 52.52, longitude: 13.405 },
  permissions: ['geolocation'],

  // Extra headers
  extraHTTPHeaders: {
    'X-Custom-Header': 'value'
  }
});
```

## Resource Blocking

```typescript
// Block images and media to reduce memory
const { page, contextId } = await pool.acquirePage();

await page.route('**/*', (route) => {
  const type = route.request().resourceType();
  if (['image', 'media', 'font'].includes(type)) {
    route.abort();
  } else {
    route.continue();
  }
});

await page.goto('https://example.com');
```

## Health Check

```typescript
const health = await pool.checkHealth();

console.log(health);
// {
//   healthy: true,
//   issues: [],
//   stats: {
//     totalBrowsers: 2,
//     activeBrowsers: 2,
//     totalContexts: 5,
//     activeContexts: 5,
//     averageContextsPerBrowser: 2.5,
//     oldestBrowserAge: 120000,
//     totalUsageCount: 45
//   }
// }
```

## Pool Statistics

```typescript
const stats = pool.getStats();

console.log(stats);
// {
//   totalBrowsers: 2,
//   activeBrowsers: 2,
//   totalContexts: 5,
//   activeContexts: 5,
//   averageContextsPerBrowser: 2.5,
//   oldestBrowserAge: 120000,
//   totalUsageCount: 45
// }
```

## Graceful Shutdown

```typescript
// Call on application shutdown
process.on('SIGTERM', async () => {
  await pool.shutdown();
  process.exit(0);
});
```

## Error Handling

```typescript
import {
  getBrowserPool,
  BrowserPoolExhaustedError,
  ContextTimeoutError
} from './services/browser-pool';

try {
  const { context, contextId } = await pool.acquireContext();
  // Use context...
} catch (error) {
  if (error instanceof BrowserPoolExhaustedError) {
    console.error('Pool exhausted, retry later');
  } else if (error instanceof ContextTimeoutError) {
    console.error('Context timed out');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Auto-Release Timeout

Contexts automatically release after 30 seconds (configurable):

```typescript
// Context will auto-release after 30s if not manually released
const { context, contextId } = await pool.acquireContext();

// Long operation...
await doSomething(); // If this takes >30s, context auto-releases

// Manual release is still recommended
await pool.releaseContext(contextId);
```

## Configuration

Edit `api/src/config/browser.config.ts`:

```typescript
export const BROWSER_POOL_CONFIG = {
  maxBrowsers: 4,              // Max browser instances
  maxContextsPerBrowser: 4,    // Max contexts per browser
  contextTimeout: 30000,       // Auto-release timeout (ms)
  recycleAfterUses: 50,        // Recycle browser after N uses
  healthCheckInterval: 60000,  // Health check interval (ms)
  gracefulShutdownTimeout: 10000, // Shutdown timeout (ms)
};
```

## Anti-Detection Features

### Automatic Stealth Config

Each context gets randomized:
- User Agent (Chrome on Windows/macOS/Linux)
- Viewport size (1920x1080, 1366x768, etc.)
- Device scale factor
- WebGL vendor/renderer
- Timezone
- Locale
- Language preferences

### Injected Stealth Script

Automatically hides automation signals:
- `navigator.webdriver` → undefined
- `navigator.plugins` → realistic plugins
- WebGL fingerprinting protection
- Chrome runtime object
- Battery API spoofing
- Console debug protection

### Custom Stealth Script

```typescript
import { getStealthInitScript } from './services/browser-pool';

const customScript = getStealthInitScript({
  vendor: 'Google Inc. (NVIDIA)',
  renderer: 'ANGLE (NVIDIA, GeForce RTX 3080)'
});

// Inject into context
await context.addInitScript(customScript);
```

## Memory Optimization

### Browser Launch Args

```typescript
// Already configured in browser.config.ts
'--max-old-space-size=512',  // 512MB heap limit per process
'--disable-dev-shm-usage',    // Use /tmp instead of /dev/shm
'--single-process',           // More stable in containers
```

### Resource Blocking

```typescript
import { RESOURCE_BLOCKING_CONFIG } from './services/browser-pool';

console.log(RESOURCE_BLOCKING_CONFIG.blockedResourceTypes);
// ['image', 'media', 'font', 'stylesheet', 'manifest', 'other']

console.log(RESOURCE_BLOCKING_CONFIG.blockedDomains);
// ['google-analytics.com', 'googletagmanager.com', ...]
```

## Production Best Practices

### 1. Always Release Contexts

```typescript
const { context, contextId } = await pool.acquireContext();

try {
  // Use context
} finally {
  await pool.releaseContext(contextId); // Always release!
}
```

### 2. Monitor Pool Health

```typescript
setInterval(async () => {
  const health = await pool.checkHealth();
  if (!health.healthy) {
    console.warn('Pool issues:', health.issues);
  }
}, 60000); // Check every minute
```

### 3. Handle Exhaustion

```typescript
let retries = 0;
while (retries < 3) {
  try {
    const { context, contextId } = await pool.acquireContext();
    break;
  } catch (error) {
    if (error instanceof BrowserPoolExhaustedError) {
      retries++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      throw error;
    }
  }
}
```

### 4. Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  console.log('Shutting down browser pool...');
  await pool.shutdown();
  console.log('Browser pool shutdown complete');
  process.exit(0);
});
```

## Architecture

```
BrowserPoolService (Singleton)
├── Browser 1
│   ├── Context 1
│   ├── Context 2
│   ├── Context 3
│   └── Context 4
├── Browser 2
│   ├── Context 5
│   └── Context 6
...
└── Browser 4 (max)
```

## Performance Targets

- **Memory**: ~500MB per context (2GB total for 4 browsers)
- **Startup**: <2s to acquire first context
- **Recycling**: <5s to recycle browser
- **Throughput**: 16 concurrent operations (4 browsers × 4 contexts)

## Logging

Integrate with your logger:

```typescript
import pino from 'pino';

const logger = pino();

const { context, contextId } = await pool.acquireContext();
logger.info({ contextId }, 'Context acquired');

// ... use context

await pool.releaseContext(contextId);
logger.info({ contextId }, 'Context released');
```

## Docker Considerations

The browser launch options are pre-configured for Docker:

- `--no-sandbox` enabled
- `/dev/shm` usage disabled
- Single-process mode for stability
- Memory limits enforced

Ensure Docker has sufficient memory (recommended: 4GB+).

## License

Part of ScreenCraft API.
