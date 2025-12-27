# Node.js/TypeScript Examples - ScreenCraft API

Complete examples for integrating ScreenCraft API into your Node.js or TypeScript application.

## Table of Contents

- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [TypeScript Client](#typescript-client)
- [Screenshots](#screenshots)
- [PDFs](#pdfs)
- [Advanced Patterns](#advanced-patterns)
- [Error Handling](#error-handling)
- [Testing](#testing)

---

## Installation

```bash
# Using npm
npm install axios

# Using yarn
yarn add axios

# Using pnpm
pnpm add axios

# For TypeScript
npm install -D @types/node
```

---

## Basic Setup

### Environment Variables

Create a `.env` file:

```env
SCREENCRAFT_API_KEY=your-api-key-here
SCREENCRAFT_API_URL=https://api.screencraft.com
```

### Simple Client (JavaScript)

```javascript
// client.js
const axios = require('axios');

const client = axios.create({
  baseURL: process.env.SCREENCRAFT_API_URL || 'https://api.screencraft.com',
  headers: {
    'X-API-Key': process.env.SCREENCRAFT_API_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

module.exports = client;
```

---

## TypeScript Client

### Type Definitions

```typescript
// types.ts
export interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  isLandscape?: boolean;
}

export interface Clip {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WaitOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
  delay?: number;
  selector?: string;
}

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface ScreenshotRequest {
  url: string;
  viewport?: Viewport;
  fullPage?: boolean;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  clip?: Clip;
  omitBackground?: boolean;
  encoding?: 'base64' | 'binary';
  waitOptions?: WaitOptions;
  headers?: Record<string, string>;
  cookies?: Cookie[];
  userAgent?: string;
  blockResources?: Array<'image' | 'stylesheet' | 'font' | 'script' | 'media'>;
  async?: boolean;
  webhookUrl?: string;
  metadata?: Record<string, any>;
}

export interface ScreenshotData {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  url: string;
  format: 'png' | 'jpeg' | 'webp';
  fileSize?: number;
  downloadUrl?: string;
  error?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  completedAt?: string;
}

export interface ScreenshotResponse {
  success: boolean;
  data: ScreenshotData;
  meta: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface PdfMargin {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

export type PdfFormat = 'Letter' | 'Legal' | 'Tabloid' | 'Ledger' | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';

export interface PdfFromUrlRequest {
  type: 'url';
  url: string;
  format?: PdfFormat;
  landscape?: boolean;
  printBackground?: boolean;
  margin?: PdfMargin;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  pageRanges?: string;
  preferCSSPageSize?: boolean;
  width?: string;
  height?: string;
  scale?: number;
  waitOptions?: WaitOptions;
  headers?: Record<string, string>;
  cookies?: Cookie[];
  userAgent?: string;
  async?: boolean;
  webhookUrl?: string;
  metadata?: Record<string, any>;
}

export interface PdfFromHtmlRequest {
  type: 'html';
  html: string;
  format?: PdfFormat;
  landscape?: boolean;
  printBackground?: boolean;
  margin?: PdfMargin;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  pageRanges?: string;
  preferCSSPageSize?: boolean;
  width?: string;
  height?: string;
  scale?: number;
  async?: boolean;
  webhookUrl?: string;
  metadata?: Record<string, any>;
}

export type PdfRequest = PdfFromUrlRequest | PdfFromHtmlRequest;

export interface PdfData {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  type: 'url' | 'html';
  format: PdfFormat;
  fileSize?: number;
  pages?: number;
  downloadUrl?: string;
  error?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  completedAt?: string;
}

export interface PdfResponse {
  success: boolean;
  data: PdfData;
  meta: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}
```

### Full TypeScript Client

```typescript
// screencraft-client.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  ScreenshotRequest,
  ScreenshotResponse,
  PdfRequest,
  PdfResponse,
  ScreenshotData,
  PdfData,
  ErrorResponse,
} from './types';

export class ScreenCraftClient {
  private client: AxiosInstance;

  constructor(apiKey: string, baseURL: string = 'https://api.screencraft.com') {
    this.client = axios.create({
      baseURL,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ErrorResponse>) => {
        if (error.response?.data) {
          throw new ScreenCraftError(
            error.response.data.error.message,
            error.response.data.error.code,
            error.response.status,
            error.response.data.error.details
          );
        }
        throw error;
      }
    );
  }

  // Screenshots

  async createScreenshot(request: ScreenshotRequest): Promise<ScreenshotResponse> {
    const response = await this.client.post<ScreenshotResponse>('/v1/screenshots', request);
    return response.data;
  }

  async getScreenshot(id: string): Promise<ScreenshotResponse> {
    const response = await this.client.get<ScreenshotResponse>(`/v1/screenshots/${id}`);
    return response.data;
  }

  async listScreenshots(params?: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    sortBy?: 'createdAt' | 'completedAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ success: boolean; data: ScreenshotData[]; meta: any }> {
    const response = await this.client.get('/v1/screenshots', { params });
    return response.data;
  }

  async downloadScreenshot(id: string): Promise<Buffer> {
    const response = await this.client.get(`/v1/screenshots/${id}/download`, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  }

  async deleteScreenshot(id: string): Promise<void> {
    await this.client.delete(`/v1/screenshots/${id}`);
  }

  async waitForScreenshot(id: string, maxAttempts: number = 60, intervalMs: number = 2000): Promise<ScreenshotData> {
    for (let i = 0; i < maxAttempts; i++) {
      const { data } = await this.getScreenshot(id);

      if (data.status === 'completed') {
        return data;
      }

      if (data.status === 'failed') {
        throw new Error(`Screenshot failed: ${data.error}`);
      }

      await this.sleep(intervalMs);
    }

    throw new Error('Screenshot timeout: max attempts reached');
  }

  // PDFs

  async createPdf(request: PdfRequest): Promise<PdfResponse> {
    const response = await this.client.post<PdfResponse>('/v1/pdfs', request);
    return response.data;
  }

  async getPdf(id: string): Promise<PdfResponse> {
    const response = await this.client.get<PdfResponse>(`/v1/pdfs/${id}`);
    return response.data;
  }

  async listPdfs(params?: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    type?: 'url' | 'html';
    sortBy?: 'createdAt' | 'completedAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ success: boolean; data: PdfData[]; meta: any }> {
    const response = await this.client.get('/v1/pdfs', { params });
    return response.data;
  }

  async downloadPdf(id: string): Promise<Buffer> {
    const response = await this.client.get(`/v1/pdfs/${id}/download`, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  }

  async deletePdf(id: string): Promise<void> {
    await this.client.delete(`/v1/pdfs/${id}`);
  }

  async waitForPdf(id: string, maxAttempts: number = 60, intervalMs: number = 2000): Promise<PdfData> {
    for (let i = 0; i < maxAttempts; i++) {
      const { data } = await this.getPdf(id);

      if (data.status === 'completed') {
        return data;
      }

      if (data.status === 'failed') {
        throw new Error(`PDF generation failed: ${data.error}`);
      }

      await this.sleep(intervalMs);
    }

    throw new Error('PDF timeout: max attempts reached');
  }

  // Utils

  async healthCheck(): Promise<{ status: string; timestamp: string; uptime: number; version: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class ScreenCraftError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ScreenCraftError';
  }
}

// Export convenience function
export function createClient(apiKey: string, baseURL?: string): ScreenCraftClient {
  return new ScreenCraftClient(apiKey, baseURL);
}
```

---

## Screenshots

### Basic Screenshot

```typescript
import { ScreenCraftClient } from './screencraft-client';
import fs from 'fs/promises';

async function basicScreenshot() {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  const response = await client.createScreenshot({
    url: 'https://example.com',
    format: 'png',
  });

  console.log('Screenshot created:', response.data.id);

  // Download the screenshot
  const imageBuffer = await client.downloadScreenshot(response.data.id);
  await fs.writeFile('screenshot.png', imageBuffer);
  console.log('Screenshot saved to screenshot.png');
}

basicScreenshot();
```

### Full Page Screenshot

```typescript
async function fullPageScreenshot() {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  const response = await client.createScreenshot({
    url: 'https://example.com',
    fullPage: true,
    format: 'jpeg',
    quality: 90,
  });

  const imageBuffer = await client.downloadScreenshot(response.data.id);
  await fs.writeFile('fullpage.jpg', imageBuffer);
}
```

### Mobile Viewport

```typescript
async function mobileScreenshot() {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  const response = await client.createScreenshot({
    url: 'https://example.com',
    viewport: {
      width: 375,
      height: 812,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
    format: 'png',
  });

  const imageBuffer = await client.downloadScreenshot(response.data.id);
  await fs.writeFile('mobile.png', imageBuffer);
}
```

### Async Screenshot with Polling

```typescript
async function asyncScreenshot() {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  // Create async screenshot
  const response = await client.createScreenshot({
    url: 'https://example.com',
    fullPage: true,
    async: true,
  });

  console.log('Screenshot queued:', response.data.id);

  // Wait for completion
  const screenshot = await client.waitForScreenshot(response.data.id);
  console.log('Screenshot completed:', screenshot.downloadUrl);

  // Download
  const imageBuffer = await client.downloadScreenshot(screenshot.id);
  await fs.writeFile('async-screenshot.png', imageBuffer);
}
```

### Screenshot with Authentication

```typescript
async function authenticatedScreenshot() {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  const response = await client.createScreenshot({
    url: 'https://example.com/dashboard',
    headers: {
      Authorization: 'Bearer your-token',
    },
    cookies: [
      {
        name: 'session_id',
        value: 'abc123',
        domain: 'example.com',
        secure: true,
        httpOnly: true,
      },
    ],
    format: 'png',
  });

  const imageBuffer = await client.downloadScreenshot(response.data.id);
  await fs.writeFile('authenticated.png', imageBuffer);
}
```

### Batch Screenshots

```typescript
async function batchScreenshots() {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  const urls = [
    'https://example.com',
    'https://example.org',
    'https://example.net',
  ];

  // Create all screenshots in parallel (async mode)
  const promises = urls.map((url) =>
    client.createScreenshot({
      url,
      async: true,
      metadata: { url }, // Store URL in metadata
    })
  );

  const responses = await Promise.all(promises);
  console.log('Screenshots queued:', responses.map((r) => r.data.id));

  // Wait for all to complete
  const screenshots = await Promise.all(
    responses.map((r) => client.waitForScreenshot(r.data.id))
  );

  // Download all
  for (const screenshot of screenshots) {
    const imageBuffer = await client.downloadScreenshot(screenshot.id);
    const filename = `screenshot-${screenshot.id}.png`;
    await fs.writeFile(filename, imageBuffer);
    console.log(`Saved: ${filename}`);
  }
}
```

---

## PDFs

### Basic PDF from URL

```typescript
async function basicPdf() {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  const response = await client.createPdf({
    type: 'url',
    url: 'https://example.com',
    format: 'A4',
    printBackground: true,
  });

  const pdfBuffer = await client.downloadPdf(response.data.id);
  await fs.writeFile('document.pdf', pdfBuffer);
  console.log('PDF saved to document.pdf');
}
```

### PDF from HTML Template

```typescript
async function pdfFromHtml() {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #333; }
          .invoice { border: 1px solid #ddd; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="invoice">
          <h1>Invoice #12345</h1>
          <p>Date: ${new Date().toLocaleDateString()}</p>
          <p>Total: $99.99</p>
        </div>
      </body>
    </html>
  `;

  const response = await client.createPdf({
    type: 'html',
    html,
    format: 'A4',
  });

  const pdfBuffer = await client.downloadPdf(response.data.id);
  await fs.writeFile('invoice.pdf', pdfBuffer);
}
```

### PDF with Header and Footer

```typescript
async function pdfWithHeaderFooter() {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  const response = await client.createPdf({
    type: 'url',
    url: 'https://example.com',
    format: 'A4',
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size:10px; text-align:center; width:100%; padding:10px;">
        <strong>Company Name</strong>
      </div>
    `,
    footerTemplate: `
      <div style="font-size:10px; text-align:center; width:100%; padding:10px;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>
    `,
    margin: {
      top: '40mm',
      bottom: '30mm',
      left: '15mm',
      right: '15mm',
    },
  });

  const pdfBuffer = await client.downloadPdf(response.data.id);
  await fs.writeFile('report.pdf', pdfBuffer);
}
```

### Async PDF Generation

```typescript
async function asyncPdf() {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  const response = await client.createPdf({
    type: 'url',
    url: 'https://example.com',
    format: 'A4',
    async: true,
  });

  console.log('PDF queued:', response.data.id);

  // Wait for completion
  const pdf = await client.waitForPdf(response.data.id);
  console.log('PDF completed:', pdf.downloadUrl);

  // Download
  const pdfBuffer = await client.downloadPdf(pdf.id);
  await fs.writeFile('async-document.pdf', pdfBuffer);
}
```

---

## Advanced Patterns

### Webhook Handler (Express)

```typescript
import express from 'express';
import { ScreenshotData, PdfData } from './types';

const app = express();
app.use(express.json());

app.post('/webhooks/screenshot', async (req, res) => {
  const data: ScreenshotData = req.body;

  console.log('Screenshot webhook received:', data.id);

  if (data.status === 'completed') {
    console.log('Download URL:', data.downloadUrl);
    // Process the screenshot
  } else if (data.status === 'failed') {
    console.error('Screenshot failed:', data.error);
  }

  res.status(200).send('OK');
});

app.post('/webhooks/pdf', async (req, res) => {
  const data: PdfData = req.body;

  console.log('PDF webhook received:', data.id);

  if (data.status === 'completed') {
    console.log('Download URL:', data.downloadUrl);
    // Process the PDF
  } else if (data.status === 'failed') {
    console.error('PDF failed:', data.error);
  }

  res.status(200).send('OK');
});

app.listen(3001, () => {
  console.log('Webhook server listening on port 3001');
});
```

### Queue System Integration (BullMQ)

```typescript
import { Queue, Worker } from 'bullmq';
import { ScreenCraftClient } from './screencraft-client';

interface ScreenshotJob {
  url: string;
  userId: string;
}

const screenshotQueue = new Queue<ScreenshotJob>('screenshots', {
  connection: {
    host: 'localhost',
    port: 6379,
  },
});

const worker = new Worker<ScreenshotJob>(
  'screenshots',
  async (job) => {
    const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

    console.log(`Processing screenshot for user ${job.data.userId}`);

    const response = await client.createScreenshot({
      url: job.data.url,
      fullPage: true,
      async: true,
      metadata: {
        userId: job.data.userId,
        jobId: job.id,
      },
    });

    // Wait for completion
    const screenshot = await client.waitForScreenshot(response.data.id);

    // Download and save
    const imageBuffer = await client.downloadScreenshot(screenshot.id);
    const filename = `screenshots/${job.data.userId}-${Date.now()}.png`;
    await fs.writeFile(filename, imageBuffer);

    return { filename, screenshotId: screenshot.id };
  },
  {
    connection: {
      host: 'localhost',
      port: 6379,
    },
  }
);

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

// Add jobs to queue
async function addScreenshotJob(url: string, userId: string) {
  await screenshotQueue.add('capture', { url, userId });
}
```

### Retry Logic

```typescript
async function screenshotWithRetry(url: string, maxRetries: number = 3): Promise<Buffer> {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.createScreenshot({
        url,
        format: 'png',
      });

      return await client.downloadScreenshot(response.data.id);
    } catch (error: any) {
      console.error(`Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries reached');
}
```

---

## Error Handling

### Comprehensive Error Handling

```typescript
import { ScreenCraftClient, ScreenCraftError } from './screencraft-client';

async function handleErrors() {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  try {
    const response = await client.createScreenshot({
      url: 'https://example.com',
      format: 'png',
    });

    console.log('Success:', response.data.id);
  } catch (error) {
    if (error instanceof ScreenCraftError) {
      switch (error.code) {
        case 'VALIDATION_ERROR':
          console.error('Validation failed:', error.details);
          break;
        case 'RATE_LIMIT_EXCEEDED':
          console.error('Rate limited. Reset at:', error.details?.reset);
          break;
        case 'UNAUTHORIZED':
          console.error('Invalid API key');
          break;
        default:
          console.error('API error:', error.message);
      }
    } else {
      console.error('Unexpected error:', error);
    }
  }
}
```

---

## Testing

### Unit Tests (Jest)

```typescript
// screencraft-client.test.ts
import { ScreenCraftClient } from './screencraft-client';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ScreenCraftClient', () => {
  let client: ScreenCraftClient;

  beforeEach(() => {
    client = new ScreenCraftClient('test-api-key');
    mockedAxios.create.mockReturnThis();
  });

  describe('createScreenshot', () => {
    it('should create a screenshot successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            status: 'completed',
            url: 'https://example.com',
            format: 'png',
          },
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await client.createScreenshot({
        url: 'https://example.com',
        format: 'png',
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should handle validation errors', async () => {
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 400,
          data: {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid URL',
            },
          },
        },
      });

      await expect(
        client.createScreenshot({
          url: 'invalid-url',
          format: 'png',
        })
      ).rejects.toThrow();
    });
  });
});
```

### Integration Tests

```typescript
// integration.test.ts
import { ScreenCraftClient } from './screencraft-client';

describe('ScreenCraft Integration Tests', () => {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  it('should create and download a screenshot', async () => {
    const response = await client.createScreenshot({
      url: 'https://example.com',
      format: 'png',
    });

    expect(response.success).toBe(true);
    expect(response.data.id).toBeDefined();

    const imageBuffer = await client.downloadScreenshot(response.data.id);
    expect(imageBuffer).toBeInstanceOf(Buffer);
    expect(imageBuffer.length).toBeGreaterThan(0);

    await client.deleteScreenshot(response.data.id);
  }, 30000);
});
```

---

## Complete Example App

```typescript
// app.ts
import { ScreenCraftClient } from './screencraft-client';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const client = new ScreenCraftClient(process.env.SCREENCRAFT_API_KEY!);

  // Health check
  const health = await client.healthCheck();
  console.log('API Status:', health.status);

  // Create output directory
  await fs.mkdir('output', { recursive: true });

  // Screenshot
  console.log('Creating screenshot...');
  const screenshot = await client.createScreenshot({
    url: 'https://example.com',
    fullPage: true,
    format: 'png',
  });

  const screenshotBuffer = await client.downloadScreenshot(screenshot.data.id);
  await fs.writeFile(path.join('output', 'screenshot.png'), screenshotBuffer);
  console.log('Screenshot saved!');

  // PDF
  console.log('Creating PDF...');
  const pdf = await client.createPdf({
    type: 'url',
    url: 'https://example.com',
    format: 'A4',
    printBackground: true,
  });

  const pdfBuffer = await client.downloadPdf(pdf.data.id);
  await fs.writeFile(path.join('output', 'document.pdf'), pdfBuffer);
  console.log('PDF saved!');

  // List resources
  const screenshots = await client.listScreenshots({ limit: 10 });
  console.log(`Total screenshots: ${screenshots.meta.pagination.total}`);

  const pdfs = await client.listPdfs({ limit: 10 });
  console.log(`Total PDFs: ${pdfs.meta.pagination.total}`);
}

main().catch(console.error);
```

Run with:
```bash
ts-node app.ts
```
