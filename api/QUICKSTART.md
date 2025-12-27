# ScreenCraft API - Quick Start

## Installation

```bash
cd api
npm install
```

## Starten

```bash
npm run dev
```

Server läuft auf: **http://localhost:3000**

## Testen

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.456,
  "version": "1.0.0"
}
```

### 2. API Documentation

Öffne im Browser: **http://localhost:3000/docs**

Swagger UI zeigt alle Endpoints mit interaktiven Tests.

### 3. Screenshot erstellen

```bash
curl -X POST http://localhost:3000/v1/screenshots \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "format": "png",
    "fullPage": true
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "url": "https://example.com",
    "format": "png",
    "downloadUrl": "http://localhost:3000/v1/screenshots/550e8400.../download",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. Screenshot Status abfragen

```bash
curl http://localhost:3000/v1/screenshots/{id}
```

### 5. PDF erstellen (von URL)

```bash
curl -X POST http://localhost:3000/v1/pdfs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url",
    "url": "https://example.com",
    "format": "A4",
    "landscape": false
  }'
```

### 6. PDF erstellen (von HTML)

```bash
curl -X POST http://localhost:3000/v1/pdfs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "html",
    "html": "<!DOCTYPE html><html><body><h1>Test</h1></body></html>",
    "format": "A4"
  }'
```

### 7. Liste alle Screenshots

```bash
curl "http://localhost:3000/v1/screenshots?page=1&limit=10&status=completed"
```

## Validierung testen

### Ungültige URL

```bash
curl -X POST http://localhost:3000/v1/screenshots \
  -H "Content-Type: application/json" \
  -d '{
    "url": "not-a-url",
    "format": "png"
  }'
```

Response (400):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "errors": [
        {
          "path": "url",
          "message": "Invalid URL format"
        }
      ]
    }
  }
}
```

### Ungültiger Format

```bash
curl -X POST http://localhost:3000/v1/screenshots \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "format": "gif"
  }'
```

Response (400):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "errors": [
        {
          "path": "format",
          "message": "Invalid enum value. Expected 'png' | 'jpeg' | 'webp'"
        }
      ]
    }
  }
}
```

## Erweiterte Optionen

### Screenshot mit Custom Viewport

```bash
curl -X POST http://localhost:3000/v1/screenshots \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "viewport": {
      "width": 1920,
      "height": 1080,
      "deviceScaleFactor": 2
    },
    "format": "png",
    "fullPage": false
  }'
```

### Screenshot mit Clip (Crop)

```bash
curl -X POST http://localhost:3000/v1/screenshots \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "clip": {
      "x": 100,
      "y": 100,
      "width": 800,
      "height": 600
    },
    "format": "jpeg",
    "quality": 90
  }'
```

### Screenshot mit Wait Options

```bash
curl -X POST http://localhost:3000/v1/screenshots \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "waitOptions": {
      "waitUntil": "networkidle0",
      "timeout": 30000,
      "delay": 2000
    }
  }'
```

### PDF mit Margins

```bash
curl -X POST http://localhost:3000/v1/pdfs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url",
    "url": "https://example.com",
    "format": "A4",
    "margin": {
      "top": "2cm",
      "right": "1.5cm",
      "bottom": "2cm",
      "left": "1.5cm"
    },
    "printBackground": true
  }'
```

### Async Processing mit Webhook

```bash
curl -X POST http://localhost:3000/v1/screenshots \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "async": true,
    "webhookUrl": "https://your-app.com/webhook/screenshots"
  }'
```

Response (202 Accepted):
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "url": "https://example.com"
  }
}
```

## Status Codes

| Code | Bedeutung |
|------|-----------|
| 200 | OK - Request erfolgreich |
| 201 | Created - Resource erstellt (sync) |
| 202 | Accepted - In Queue (async) |
| 204 | No Content - Delete erfolgreich |
| 400 | Bad Request - Validation Error |
| 404 | Not Found - Resource existiert nicht |
| 429 | Too Many Requests - Rate Limit |
| 500 | Internal Server Error |

## Pagination

```bash
curl "http://localhost:3000/v1/screenshots?page=2&limit=20&sortBy=createdAt&sortOrder=desc"
```

Response:
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 2,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": true
    }
  }
}
```

## Filtering

```bash
# Nur completed Screenshots
curl "http://localhost:3000/v1/screenshots?status=completed"

# Nur failed
curl "http://localhost:3000/v1/screenshots?status=failed"

# PDFs von HTML
curl "http://localhost:3000/v1/pdfs?type=html"
```

## Mit JavaScript/TypeScript

### Node.js mit Fetch

```javascript
async function createScreenshot() {
  const response = await fetch('http://localhost:3000/v1/screenshots', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: 'https://example.com',
      format: 'png',
      fullPage: true,
    }),
  });

  const result = await response.json();
  console.log('Screenshot ID:', result.data.id);
  console.log('Download URL:', result.data.downloadUrl);
}
```

### Mit TypeScript (Type-Safe)

```typescript
import type { ScreenshotRequest, ScreenshotResponse, ApiResponse } from './src/schemas/screenshot.schema';

async function createScreenshot(request: ScreenshotRequest): Promise<ScreenshotResponse> {
  const response = await fetch('http://localhost:3000/v1/screenshots', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const result: ApiResponse<ScreenshotResponse> = await response.json();

  if (!result.success) {
    throw new Error(result.error.message);
  }

  return result.data;
}

// Verwendung
const screenshot = await createScreenshot({
  url: 'https://example.com',
  format: 'png',
  fullPage: true,
});
```

## Troubleshooting

### Port bereits belegt

```bash
# Ändere Port in .env
PORT=3001
```

### Rate Limit testen

```bash
# 100 Requests in kurzer Zeit
for i in {1..101}; do
  curl http://localhost:3000/health
done
```

Nach Request 100 kommt:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later."
  }
}
```

## Nächste Schritte

1. Siehe **API.md** für vollständige API Dokumentation
2. Siehe **src/README.md** für Implementation Details
3. Siehe **IMPLEMENTATION_SUMMARY.md** für Feature Overview
4. Öffne **http://localhost:3000/docs** für interaktive API Docs

## Weitere Beispiele

Alle Request/Response Beispiele findest du in:
- **API.md** - Vollständige API Dokumentation
- **http://localhost:3000/docs** - Swagger UI mit Try-it-out
