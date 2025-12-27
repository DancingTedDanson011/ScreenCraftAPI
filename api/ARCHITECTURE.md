# ScreenCraft API - Architecture Overview

## Request Flow

```
Client Request
    ↓
┌─────────────────────────────────────────┐
│  Fastify Server (app.ts)                │
│  - CORS                                 │
│  - Helmet (Security Headers)            │
│  - Rate Limiting                        │
│  - Request ID Tracking                  │
│  - Logger (Pino)                        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Routes (routes/*.routes.ts)            │
│  - /v1/screenshots                      │
│  - /v1/pdfs                             │
│  - Schema Definitions                   │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Middleware                             │
│  - Validation (Zod)                     │
│  - Authentication (API Key)             │
│  - Rate Limit Check                     │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Controllers (controllers/*.ts)         │
│  - Business Logic                       │
│  - Request Validation                   │
│  - Error Handling                       │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Services (TODO: Integration)           │
│  - Screenshot Service (Playwright)      │
│  - PDF Service (Playwright)             │
│  - Queue Service (BullMQ)               │
│  - Storage Service (S3)                 │
│  - Database (Prisma)                    │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Response (utils/response.helper.ts)    │
│  - Success Response                     │
│  - Error Response                       │
│  - Status Codes                         │
└─────────────────────────────────────────┘
    ↓
Client Response
```

## Component Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     ScreenCraft API                           │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │   Schemas      │  │     Types      │  │  Controllers   │ │
│  │  (Zod)         │→ │  (TypeScript)  │→ │  (Logic)       │ │
│  │                │  │                │  │                │ │
│  │ - screenshot   │  │ - ApiResponse  │  │ - create       │ │
│  │ - pdf          │  │ - ErrorCode    │  │ - get          │ │
│  │                │  │ - HttpStatus   │  │ - list         │ │
│  └────────────────┘  └────────────────┘  │ - download     │ │
│                                           │ - delete       │ │
│  ┌────────────────┐  ┌────────────────┐  └────────────────┘ │
│  │   Routes       │  │   Middleware   │                      │
│  │  (Fastify)     │  │  (Validation)  │                      │
│  │                │  │                │                      │
│  │ - POST /       │  │ - validateReq  │                      │
│  │ - GET /:id     │  │ - auth         │                      │
│  │ - GET /        │  │ - rateLimit    │                      │
│  │ - DELETE       │  └────────────────┘                      │
│  └────────────────┘                                          │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    Utilities                           │  │
│  │  - response.helper.ts (sendSuccess, sendError, ...)   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│              Integration Layer (TODO)                         │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │ Playwright │  │   BullMQ   │  │  Prisma    │             │
│  │ (Browser)  │  │  (Queue)   │  │  (DB)      │             │
│  └────────────┘  └────────────┘  └────────────┘             │
│                                                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │    S3      │  │   Redis    │  │  Webhook   │             │
│  │ (Storage)  │  │  (Cache)   │  │  (Notify)  │             │
│  └────────────┘  └────────────┘  └────────────┘             │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## File Structure

```
api/
├── src/
│   ├── controllers/          # Request Handlers
│   │   ├── screenshot.controller.ts
│   │   └── pdf.controller.ts
│   │
│   ├── routes/               # Fastify Routes
│   │   ├── screenshot.routes.ts
│   │   └── pdf.routes.ts
│   │
│   ├── schemas/              # Zod Validation
│   │   ├── screenshot.schema.ts
│   │   └── pdf.schema.ts
│   │
│   ├── types/                # TypeScript Types
│   │   └── api.types.ts
│   │
│   ├── middleware/           # Request Middleware
│   │   ├── validation.middleware.ts
│   │   └── auth.middleware.ts
│   │
│   ├── utils/                # Helpers
│   │   └── response.helper.ts
│   │
│   ├── services/             # Business Logic (TODO)
│   │   ├── screenshot.service.ts
│   │   ├── pdf.service.ts
│   │   ├── queue.service.ts
│   │   ├── storage.service.ts
│   │   └── db/
│   │       └── client.ts
│   │
│   ├── app.ts                # Fastify App Builder
│   └── server.ts             # Entry Point
│
├── docs/
│   ├── API.md                # API Documentation
│   ├── QUICKSTART.md         # Quick Start Guide
│   ├── ARCHITECTURE.md       # This File
│   └── IMPLEMENTATION_SUMMARY.md
│
├── package.json
├── tsconfig.json
└── .env.example
```

## Data Flow

### Screenshot Creation (Sync)

```
1. POST /v1/screenshots
   {
     "url": "https://example.com",
     "format": "png"
   }
   ↓
2. Route Handler (screenshot.routes.ts)
   - Schema Validation
   ↓
3. Controller (screenshot.controller.ts)
   - createScreenshot()
   - Validate with Zod
   - Generate UUID
   ↓
4. Processing (TODO: Browser Service)
   - Launch Browser
   - Navigate to URL
   - Capture Screenshot
   - Save to Storage
   ↓
5. Database Update (TODO: Prisma)
   - Save metadata
   - Update status
   ↓
6. Response
   {
     "success": true,
     "data": {
       "id": "uuid",
       "status": "completed",
       "downloadUrl": "..."
     }
   }
```

### Screenshot Creation (Async)

```
1. POST /v1/screenshots
   {
     "url": "https://example.com",
     "async": true,
     "webhookUrl": "https://webhook.url"
   }
   ↓
2. Controller
   - Validate
   - Generate UUID
   - Create DB entry (status: pending)
   ↓
3. Queue Job (TODO: BullMQ)
   - Add to queue
   ↓
4. Response (202 Accepted)
   {
     "success": true,
     "data": {
       "id": "uuid",
       "status": "pending"
     }
   }
   ↓
5. Background Worker
   - Process screenshot
   - Update DB
   - Send webhook
```

## Validation Flow

```
Request Body
    ↓
┌─────────────────────────────────────┐
│  Zod Schema (schemas/*.schema.ts)   │
│  - Type Definition                  │
│  - Validation Rules                 │
│  - Default Values                   │
│  - Transformations                  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Schema.parse(data)                 │
│  - Validate Types                   │
│  - Apply Defaults                   │
│  - Transform Data                   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Success → Validated Data           │
│  Error → ZodError with details      │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Controller receives typed data     │
│  OR                                 │
│  Error Handler sends 400 response   │
└─────────────────────────────────────┘
```

## Error Handling

```
┌─────────────────────────────────────┐
│  Error Occurs                       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Error Type Detection               │
│  - ZodError → VALIDATION_ERROR      │
│  - NotFoundError → NOT_FOUND        │
│  - RateLimitError → RATE_LIMIT      │
│  - Other → INTERNAL_SERVER_ERROR    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Error Response Builder             │
│  {                                  │
│    success: false,                  │
│    error: {                         │
│      code: "ERROR_CODE",            │
│      message: "...",                │
│      details: {...}                 │
│    }                                │
│  }                                  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  HTTP Status Code                   │
│  - 400: Bad Request                 │
│  - 404: Not Found                   │
│  - 429: Too Many Requests           │
│  - 500: Server Error                │
└─────────────────────────────────────┘
```

## Type Safety

```
┌────────────────────────────────────────┐
│  Zod Schema Definition                 │
│  const schema = z.object({...})        │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│  Type Inference                        │
│  type T = z.infer<typeof schema>       │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│  Fastify Request Type                  │
│  interface Request {                   │
│    body: T                             │
│  }                                     │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│  Controller Function                   │
│  async function handler(               │
│    request: Request,                   │
│    reply: FastifyReply                 │
│  ) { ... }                             │
└────────────────────────────────────────┘
    ↓
    TypeScript ensures type safety
    throughout entire request flow
```

## API Versioning

```
/v1/screenshots  ← Current Version
/v1/pdfs

Future:
/v2/screenshots  ← New Version
/v2/pdfs

Versioning Strategy:
- URL Path Versioning
- No Breaking Changes in v1
- New Features → v2
- Deprecation Notices
```

## Security Layers

```
┌─────────────────────────────────────┐
│  1. CORS                            │
│     - Origin Whitelist              │
│     - Credentials Policy            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  2. Helmet                          │
│     - CSP Headers                   │
│     - XSS Protection                │
│     - HSTS                          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  3. Rate Limiting                   │
│     - Per API Key                   │
│     - Per IP                        │
│     - Time Windows                  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  4. API Key Auth (TODO)             │
│     - X-API-Key Header              │
│     - Database Validation           │
│     - Permission Check              │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  5. Input Validation                │
│     - Zod Schema Validation         │
│     - Type Safety                   │
│     - Sanitization                  │
└─────────────────────────────────────┘
```

## Scalability Considerations

### Horizontal Scaling

```
          Load Balancer
                ↓
    ┌───────────┴───────────┐
    ↓                       ↓
API Server 1          API Server 2
    ↓                       ↓
    └───────────┬───────────┘
                ↓
        Shared Services:
        - Redis (Rate Limit, Cache)
        - PostgreSQL (Database)
        - S3 (Storage)
        - Queue (BullMQ)
```

### Async Processing

```
API Server → Queue → Worker Pool
                          ↓
                    Browser Pool
                          ↓
                    Storage (S3)
                          ↓
                    Webhook Delivery
```

## Performance Optimizations

1. **Connection Pooling**
   - Database connections
   - Redis connections
   - Browser instances

2. **Caching**
   - Redis for metadata
   - CDN for files
   - Response caching

3. **Async Processing**
   - Queue for long tasks
   - Webhook notifications
   - Background cleanup

4. **Resource Limits**
   - Max concurrent browsers
   - Queue size limits
   - File size limits

## Monitoring Points

```
┌─────────────────────────────────────┐
│  Request Metrics                    │
│  - Total requests                   │
│  - Response times                   │
│  - Error rates                      │
│  - Status code distribution         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Queue Metrics                      │
│  - Jobs queued                      │
│  - Jobs completed                   │
│  - Jobs failed                      │
│  - Queue depth                      │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Resource Metrics                   │
│  - CPU usage                        │
│  - Memory usage                     │
│  - Disk usage                       │
│  - Browser pool size                │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Business Metrics                   │
│  - Screenshots created              │
│  - PDFs generated                   │
│  - API key usage                    │
│  - Storage consumed                 │
└─────────────────────────────────────┘
```

## Next Steps: Service Integration

1. **Browser Service** (Playwright)
   ```typescript
   class BrowserService {
     async screenshot(options): Promise<Buffer>
     async pdf(options): Promise<Buffer>
     browserPool: BrowserPool
   }
   ```

2. **Queue Service** (BullMQ)
   ```typescript
   class QueueService {
     async addJob(type, data): Promise<Job>
     async getJob(id): Promise<Job>
     workers: Worker[]
   }
   ```

3. **Storage Service** (S3)
   ```typescript
   class StorageService {
     async upload(file, metadata): Promise<string>
     async download(id): Promise<Stream>
     async delete(id): Promise<void>
   }
   ```

4. **Database** (Prisma)
   ```typescript
   prisma.screenshot.create()
   prisma.screenshot.findUnique()
   prisma.screenshot.update()
   ```
