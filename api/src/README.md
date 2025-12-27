# ScreenCraft API - Implementation Guide

## Projektstruktur

```
api/src/
├── controllers/          # Request Handler Logic
│   ├── screenshot.controller.ts
│   └── pdf.controller.ts
├── routes/              # Fastify Route Definitions
│   ├── screenshot.routes.ts
│   └── pdf.routes.ts
├── schemas/             # Zod Validation Schemas
│   ├── screenshot.schema.ts
│   └── pdf.schema.ts
├── types/               # TypeScript Type Definitions
│   └── api.types.ts
├── middleware/          # Request Middleware
│   ├── validation.middleware.ts
│   └── auth.middleware.ts
├── utils/               # Helper Functions
│   └── response.helper.ts
├── app.ts               # Fastify App Setup
└── server.ts            # Server Entry Point
```

## Features Implementiert

### 1. Zod Schema Validation

Alle Request-Daten werden mit Zod validiert:

```typescript
import { screenshotRequestSchema } from './schemas/screenshot.schema';

// Validation
const validated = screenshotRequestSchema.parse(request.body);
```

### 2. Type-Safe API

TypeScript Types werden automatisch aus Zod Schemas abgeleitet:

```typescript
export type ScreenshotRequest = z.infer<typeof screenshotRequestSchema>;
```

### 3. Fastify Routes

Alle Endpoints sind als Fastify Plugins registriert:

```typescript
// POST /v1/screenshots
// GET /v1/screenshots/:id
// GET /v1/screenshots/:id/download
// DELETE /v1/screenshots/:id
```

### 4. Error Handling

Konsistente Error Responses mit Error Codes:

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": { ... }
  }
}
```

### 5. Response Helpers

Utility Functions für Standard Responses:

```typescript
import { sendSuccess, sendError, sendNotFound } from './utils/response.helper';

sendSuccess(reply, data, HttpStatus.CREATED);
sendNotFound(reply, 'Screenshot', id);
```

## Nächste Schritte

### TODO: Integration Points

Die Controller haben Platzhalter für diese Services:

#### 1. Screenshot Service

```typescript
// TODO in screenshot.controller.ts
import { screenshotService } from '../services/screenshot.service';

const result = await screenshotService.capture(validatedData);
```

#### 2. Queue Service (BullMQ)

```typescript
// TODO in controllers
import { queueService } from '../services/queue.service';

await queueService.addJob('screenshot', { id, ...validatedData });
```

#### 3. Storage Service (S3)

```typescript
// TODO in controllers
import { storageService } from '../services/storage.service';

const fileStream = await storageService.getFile(id);
await storageService.deleteFile(id);
```

#### 4. Database (Prisma)

```typescript
// TODO: Replace Map with Prisma
const screenshotsDb = new Map<string, ScreenshotResponse>();

// Replace with:
import { prisma } from '../db/client';

const screenshot = await prisma.screenshot.create({
  data: { ... }
});
```

## API Endpoints

### Screenshots

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/screenshots` | Create screenshot |
| GET | `/v1/screenshots/:id` | Get screenshot status |
| GET | `/v1/screenshots` | List screenshots |
| GET | `/v1/screenshots/:id/download` | Download file |
| DELETE | `/v1/screenshots/:id` | Delete screenshot |

### PDFs

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/pdfs` | Create PDF |
| GET | `/v1/pdfs/:id` | Get PDF status |
| GET | `/v1/pdfs` | List PDFs |
| GET | `/v1/pdfs/:id/download` | Download file |
| DELETE | `/v1/pdfs/:id` | Delete PDF |

## Request Validation

### Screenshot Request Schema

```typescript
{
  url: z.string().url(),
  viewport: z.object({
    width: z.number().int().min(320).max(3840).default(1920),
    height: z.number().int().min(240).max(2160).default(1080),
  }).optional(),
  fullPage: z.boolean().default(false),
  format: z.enum(['png', 'jpeg', 'webp']).default('png'),
  quality: z.number().int().min(1).max(100).optional(),
  async: z.boolean().default(false),
  webhookUrl: z.string().url().optional(),
}
```

### PDF Request Schema

```typescript
{
  type: z.enum(['url', 'html']),
  url: z.string().url().optional(),
  html: z.string().optional(),
  format: z.enum(['A4', 'Letter', ...]).default('A4'),
  landscape: z.boolean().default(false),
  printBackground: z.boolean().default(true),
  async: z.boolean().default(false),
}
```

## Development

### Start Server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Test Endpoint

```bash
curl -X POST http://localhost:3000/v1/screenshots \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "format": "png"
  }'
```

### API Documentation

```
http://localhost:3000/docs
```

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| UNAUTHORIZED | 401 | Missing API key |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMIT_EXCEEDED | 429 | Rate limit exceeded |
| PROCESSING_FAILED | 500 | Processing error |

## Middleware

### Validation Middleware

```typescript
import { validateRequest } from './middleware/validation.middleware';

fastify.post('/screenshots', {
  preHandler: validateRequest(screenshotRequestSchema),
}, handler);
```

### Auth Middleware

```typescript
import { authenticateApiKey } from './middleware/auth.middleware';

fastify.post('/screenshots', {
  preHandler: authenticateApiKey,
}, handler);
```

## Response Format

### Success

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123",
    "version": "v1"
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123",
    "version": "v1"
  }
}
```

## Pagination

List endpoints support pagination:

```bash
GET /v1/screenshots?page=1&limit=20&status=completed&sortBy=createdAt&sortOrder=desc
```

Response includes pagination metadata:

```json
{
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## Production Considerations

1. **Replace Mock Database**: Implementiere Prisma für echte Datenpersistenz
2. **Add Queue Service**: Integriere BullMQ für async Job Processing
3. **Add Storage**: S3 Integration für File Storage
4. **Add Browser Service**: Playwright/Puppeteer Pool Management
5. **Add Redis**: Für Rate Limiting und Caching
6. **Add Monitoring**: Logging, Metrics, Alerts
7. **Add Tests**: Unit Tests und Integration Tests
8. **Add CI/CD**: Deployment Pipeline
