# ScreenCraft API Documentation

Professional Screenshot & PDF Generation API

## Base URL

```
Development: http://localhost:3000
Production: https://api.screencraft.com
```

## Authentication

All API requests require authentication using an API key.

```bash
X-API-Key: your_api_key_here
```

## Rate Limiting

- Default: 100 requests per minute
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Timestamp when limit resets

## Response Format

### Success Response

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

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123",
    "version": "v1"
  }
}
```

---

## Screenshot Endpoints

### Create Screenshot

**POST** `/v1/screenshots`

Generate a screenshot from a URL.

#### Request Body

```json
{
  "url": "https://example.com",
  "viewport": {
    "width": 1920,
    "height": 1080,
    "deviceScaleFactor": 2
  },
  "fullPage": false,
  "format": "png",
  "quality": 90,
  "waitOptions": {
    "waitUntil": "networkidle0",
    "timeout": 30000,
    "delay": 1000
  },
  "async": false,
  "webhookUrl": "https://your-app.com/webhook"
}
```

#### Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `url` | string | Yes | - | Target URL to screenshot |
| `viewport` | object | No | `{width: 1920, height: 1080}` | Browser viewport size |
| `fullPage` | boolean | No | `false` | Capture full page scroll |
| `format` | enum | No | `png` | Image format: `png`, `jpeg`, `webp` |
| `quality` | number | No | 90 | JPEG/WebP quality (1-100) |
| `clip` | object | No | - | Crop region `{x, y, width, height}` |
| `omitBackground` | boolean | No | `false` | Transparent background |
| `waitOptions` | object | No | - | Navigation wait options |
| `headers` | object | No | - | Custom HTTP headers |
| `cookies` | array | No | - | Cookies to set |
| `userAgent` | string | No | - | Custom user agent |
| `blockResources` | array | No | - | Block resource types |
| `async` | boolean | No | `false` | Async processing |
| `webhookUrl` | string | No | - | Webhook for async completion |
| `metadata` | object | No | - | Custom metadata |

#### Response (Sync - 201)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "url": "https://example.com",
    "format": "png",
    "fileSize": 1024000,
    "downloadUrl": "https://api.screencraft.com/v1/screenshots/550e8400.../download",
    "createdAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:30:05Z"
  }
}
```

#### Response (Async - 202)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "url": "https://example.com",
    "format": "png",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Example Request

```bash
curl -X POST https://api.screencraft.com/v1/screenshots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "url": "https://example.com",
    "format": "png",
    "fullPage": true,
    "async": false
  }'
```

---

### Get Screenshot Status

**GET** `/v1/screenshots/:id`

Retrieve screenshot status and metadata.

#### Response (200)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "url": "https://example.com",
    "format": "png",
    "fileSize": 1024000,
    "downloadUrl": "https://api.screencraft.com/v1/screenshots/550e8400.../download",
    "createdAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:30:05Z"
  }
}
```

#### Status Values

- `pending`: Queued for processing
- `processing`: Currently being generated
- `completed`: Ready for download
- `failed`: Error occurred

---

### Download Screenshot

**GET** `/v1/screenshots/:id/download`

Download the generated screenshot file.

#### Response (200)

Binary image file with headers:

```
Content-Type: image/png
Content-Disposition: attachment; filename="screenshot-{id}.png"
Content-Length: 1024000
```

---

### List Screenshots

**GET** `/v1/screenshots`

List all screenshots with pagination.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `status` | enum | - | Filter by status |
| `sortBy` | enum | `createdAt` | Sort field |
| `sortOrder` | enum | `desc` | Sort direction |

#### Response (200)

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "completed",
      "url": "https://example.com",
      "format": "png",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
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

---

### Delete Screenshot

**DELETE** `/v1/screenshots/:id`

Delete a screenshot and its file.

#### Response (204)

No content.

---

## PDF Endpoints

### Create PDF

**POST** `/v1/pdfs`

Generate a PDF from URL or HTML.

#### Request Body (from URL)

```json
{
  "type": "url",
  "url": "https://example.com",
  "format": "A4",
  "landscape": false,
  "printBackground": true,
  "margin": {
    "top": "1cm",
    "right": "1cm",
    "bottom": "1cm",
    "left": "1cm"
  },
  "scale": 1.0,
  "async": false
}
```

#### Request Body (from HTML)

```json
{
  "type": "html",
  "html": "<!DOCTYPE html><html>...</html>",
  "format": "A4",
  "landscape": false,
  "async": false
}
```

#### Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | enum | Yes | - | Source type: `url` or `html` |
| `url` | string | If type=url | - | Target URL |
| `html` | string | If type=html | - | HTML content |
| `format` | enum | No | `A4` | Page format (A4, Letter, etc.) |
| `landscape` | boolean | No | `false` | Landscape orientation |
| `printBackground` | boolean | No | `true` | Print backgrounds |
| `margin` | object | No | - | Page margins |
| `displayHeaderFooter` | boolean | No | `false` | Show header/footer |
| `headerTemplate` | string | No | - | HTML header template |
| `footerTemplate` | string | No | - | HTML footer template |
| `pageRanges` | string | No | - | Page ranges (e.g., "1-3, 5") |
| `scale` | number | No | 1.0 | Page scale (0.1-2.0) |
| `async` | boolean | No | `false` | Async processing |
| `webhookUrl` | string | No | - | Webhook URL |

#### Response (201)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "type": "url",
    "format": "A4",
    "fileSize": 2048000,
    "pages": 5,
    "downloadUrl": "https://api.screencraft.com/v1/pdfs/550e8400.../download",
    "createdAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:30:10Z"
  }
}
```

---

### Get PDF Status

**GET** `/v1/pdfs/:id`

Retrieve PDF status and metadata.

---

### Download PDF

**GET** `/v1/pdfs/:id/download`

Download the generated PDF file.

#### Response (200)

Binary PDF file with headers:

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="document-{id}.pdf"
Content-Length: 2048000
```

---

### List PDFs

**GET** `/v1/pdfs`

List all PDFs with pagination.

---

### Delete PDF

**DELETE** `/v1/pdfs/:id`

Delete a PDF and its file.

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INVALID_URL` | 400 | Invalid URL format |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `SCREENSHOT_NOT_FOUND` | 404 | Screenshot not found |
| `PDF_NOT_FOUND` | 404 | PDF not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |
| `PROCESSING_FAILED` | 500 | Processing error |
| `TIMEOUT` | 504 | Request timeout |

---

## Webhooks

When using async processing, you can provide a `webhookUrl` to receive notifications.

### Webhook Payload

```json
{
  "event": "screenshot.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "downloadUrl": "https://api.screencraft.com/v1/screenshots/550e8400.../download"
  }
}
```

### Webhook Events

- `screenshot.completed`
- `screenshot.failed`
- `pdf.completed`
- `pdf.failed`

---

## Code Examples

### Node.js

```javascript
const axios = require('axios');

async function createScreenshot() {
  const response = await axios.post(
    'https://api.screencraft.com/v1/screenshots',
    {
      url: 'https://example.com',
      format: 'png',
      fullPage: true,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'your_api_key',
      },
    }
  );

  console.log('Screenshot ID:', response.data.data.id);
  console.log('Download URL:', response.data.data.downloadUrl);
}
```

### Python

```python
import requests

def create_screenshot():
    response = requests.post(
        'https://api.screencraft.com/v1/screenshots',
        json={
            'url': 'https://example.com',
            'format': 'png',
            'fullPage': True,
        },
        headers={
            'Content-Type': 'application/json',
            'X-API-Key': 'your_api_key',
        }
    )

    data = response.json()
    print('Screenshot ID:', data['data']['id'])
    print('Download URL:', data['data']['downloadUrl'])
```

---

## Interactive Documentation

Visit the interactive API documentation at:

```
http://localhost:3000/docs
```

Swagger UI allows you to test all endpoints directly in your browser.
