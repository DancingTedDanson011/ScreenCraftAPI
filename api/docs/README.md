# ScreenCraft API Documentation

Professional Screenshot & PDF Generation API powered by Playwright.

## Quick Links

- **OpenAPI Specification**: [openapi.yaml](./openapi.yaml)
- **Swagger UI**: Available at `/docs` when running the API
- **Code Examples**:
  - [cURL Examples](./examples/curl-examples.md)
  - [Node.js/TypeScript Examples](./examples/nodejs-examples.md)
  - [Python Examples](./examples/python-examples.md)

## Getting Started

### 1. Get Your API Key

Contact support to obtain your API key.

### 2. Make Your First Request

```bash
curl -X POST "https://api.screencraft.com/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "url": "https://example.com",
    "format": "png"
  }'
```

### 3. Download Your Screenshot

```bash
curl -X GET "https://api.screencraft.com/v1/screenshots/{id}/download" \
  -H "X-API-Key: YOUR_API_KEY" \
  -o screenshot.png
```

## Features

### Screenshots

- **High Quality**: Pixel-perfect screenshots using Playwright
- **Multiple Formats**: PNG, JPEG, WebP
- **Full Page**: Capture entire scrollable pages
- **Custom Viewports**: Desktop, mobile, tablet, or custom dimensions
- **Resource Blocking**: Block images, fonts, etc. for faster loading
- **Authentication**: Support for cookies, headers, and custom user agents

### PDFs

- **From URL or HTML**: Generate PDFs from any webpage or HTML content
- **Multiple Formats**: A4, Letter, Legal, and more
- **Headers & Footers**: Custom templates with page numbers
- **Custom Margins**: Control spacing and layout
- **Landscape/Portrait**: Full orientation control

### Async Processing

- **Background Jobs**: Queue long-running tasks
- **Webhook Notifications**: Get notified when processing completes
- **Status Polling**: Check job status anytime

## API Endpoints

### Health Check

```
GET /health
```

Check API service health and status.

### Screenshots

```
POST   /v1/screenshots          Create screenshot
GET    /v1/screenshots          List screenshots
GET    /v1/screenshots/{id}     Get screenshot status
GET    /v1/screenshots/{id}/download    Download screenshot
DELETE /v1/screenshots/{id}     Delete screenshot
```

### PDFs

```
POST   /v1/pdfs                 Generate PDF
GET    /v1/pdfs                 List PDFs
GET    /v1/pdfs/{id}            Get PDF status
GET    /v1/pdfs/{id}/download   Download PDF
DELETE /v1/pdfs/{id}            Delete PDF
```

## Authentication

All API requests require an API key passed in the `X-API-Key` header:

```
X-API-Key: your-api-key-here
```

## Rate Limiting

- **Default**: 100 requests per minute per API key
- Rate limit information is included in response headers:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp (ISO 8601)

## Response Format

All responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "completed",
    "downloadUrl": "https://..."
  },
  "meta": {
    "timestamp": "2025-12-26T12:00:00.000Z",
    "requestId": "req_123456",
    "version": "v1"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field": "url",
      "issue": "Invalid URL format"
    }
  },
  "meta": {
    "timestamp": "2025-12-26T12:00:00.000Z",
    "requestId": "req_123456",
    "version": "v1"
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `UNAUTHORIZED` | Invalid or missing API key |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `SCREENSHOT_NOT_READY` | Screenshot still processing |
| `PDF_NOT_READY` | PDF still processing |
| `INTERNAL_SERVER_ERROR` | Unexpected server error |

## Common Use Cases

### 1. Simple Screenshot

```bash
curl -X POST "https://api.screencraft.com/v1/screenshots" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "format": "png"}'
```

### 2. Mobile Screenshot

```bash
curl -X POST "https://api.screencraft.com/v1/screenshots" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "viewport": {
      "width": 375,
      "height": 812,
      "deviceScaleFactor": 3,
      "isMobile": true
    }
  }'
```

### 3. Full Page Screenshot

```bash
curl -X POST "https://api.screencraft.com/v1/screenshots" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "fullPage": true}'
```

### 4. PDF from URL

```bash
curl -X POST "https://api.screencraft.com/v1/pdfs" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url",
    "url": "https://example.com",
    "format": "A4"
  }'
```

### 5. PDF from HTML

```bash
curl -X POST "https://api.screencraft.com/v1/pdfs" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "html",
    "html": "<h1>Hello World</h1>",
    "format": "Letter"
  }'
```

### 6. Async Processing

```bash
curl -X POST "https://api.screencraft.com/v1/screenshots" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "fullPage": true,
    "async": true,
    "webhookUrl": "https://your-app.com/webhooks/screenshot"
  }'
```

## SDKs & Libraries

### Official Libraries

- **Node.js/TypeScript**: See [Node.js Examples](./examples/nodejs-examples.md)
- **Python**: See [Python Examples](./examples/python-examples.md)

### Community Libraries

Contributions welcome! Submit a PR to add your library.

## Best Practices

### 1. Use Async Mode for Large Screenshots

For full-page screenshots or slow-loading pages, use async mode to avoid timeouts:

```json
{
  "url": "https://example.com",
  "fullPage": true,
  "async": true
}
```

### 2. Block Unnecessary Resources

Speed up capture by blocking resources you don't need:

```json
{
  "url": "https://example.com",
  "blockResources": ["image", "font", "media"]
}
```

### 3. Set Appropriate Timeouts

Adjust timeouts based on your use case:

```json
{
  "url": "https://example.com",
  "waitOptions": {
    "waitUntil": "networkidle0",
    "timeout": 30000
  }
}
```

### 4. Handle Rate Limits

Monitor rate limit headers and implement exponential backoff:

```javascript
if (response.headers['x-ratelimit-remaining'] < 10) {
  // Slow down requests
}
```

### 5. Use Webhooks for Long-Running Jobs

Instead of polling, use webhooks for async jobs:

```json
{
  "url": "https://example.com",
  "async": true,
  "webhookUrl": "https://your-app.com/webhooks/screenshot"
}
```

### 6. Add Metadata

Track requests with custom metadata:

```json
{
  "url": "https://example.com",
  "metadata": {
    "userId": "user123",
    "projectId": "proj456"
  }
}
```

## Support

- **Documentation**: https://docs.screencraft.com
- **API Status**: https://status.screencraft.com
- **Email**: support@screencraft.com
- **GitHub**: https://github.com/screencraft/api

## Changelog

### v1.0.0 (2025-12-26)

- Initial release
- Screenshot generation (PNG, JPEG, WebP)
- PDF generation (URL and HTML)
- Async processing with webhooks
- Rate limiting
- Comprehensive error handling

## License

MIT License - See LICENSE file for details
