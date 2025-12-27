# Browser Pool Quick Start

**Get started in 5 minutes!**

## 1. Install Playwright Browser

```bash
cd api
npx playwright install chromium
```

## 2. Basic Usage

Create `test.ts`:

```typescript
import { getBrowserPool } from './src/services/browser-pool/index.js';

async function main() {
  const pool = getBrowserPool();

  // Take a screenshot
  const { page, contextId } = await pool.acquirePage();

  try {
    await page.goto('https://example.com');
    const screenshot = await page.screenshot({ path: 'test.png' });
    console.log('Screenshot saved to test.png');
  } finally {
    await pool.releaseContext(contextId);
    await pool.shutdown();
  }
}

main();
```

## 3. Run

```bash
npx tsx test.ts
```

## 4. Check Result

```bash
ls -lh test.png
# Screenshot should be ~8-10 KB
```

## That's it! ✅

For more examples, see:
- `examples.ts` - 10 real-world examples
- `README.md` - Full documentation
- `INSTALLATION.md` - Production setup

## Common Use Cases

### Screenshot
```typescript
const { page, contextId } = await pool.acquirePage();
await page.goto('https://example.com');
const screenshot = await page.screenshot({ fullPage: true });
await pool.releaseContext(contextId);
```

### PDF
```typescript
const { page, contextId } = await pool.acquirePage();
await page.goto('https://example.com');
const pdf = await page.pdf({ format: 'A4' });
await pool.releaseContext(contextId);
```

### Scrape
```typescript
const { page, contextId } = await pool.acquirePage();
await page.goto('https://example.com');
const title = await page.title();
const content = await page.textContent('body');
await pool.releaseContext(contextId);
```

### Health Check
```typescript
const health = await pool.checkHealth();
console.log(health.healthy ? 'OK' : 'ISSUES');
```

## Troubleshooting

### Error: Browser executable not found
```bash
npx playwright install chromium
```

### Error: Shared library not found (Linux)
```bash
npx playwright install-deps chromium
```

### High memory usage
See `README.md` → Performance Tuning section

## Next Steps

1. Read `README.md` for full documentation
2. Check `examples.ts` for real-world use cases
3. Run tests: `npm test`
4. Deploy with Docker (see `INSTALLATION.md`)
