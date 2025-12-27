# API Requirements für Live Demo Widget

## Demo Screenshot Endpoint

### GET /v1/demo/screenshot

Public endpoint für Landing Page Demo (kein Auth required).

**Query Parameters:**
```
url      (required) - Target URL to screenshot (must be valid HTTP/HTTPS)
format   (required) - Image format: "png" | "jpeg" | "webp"
width    (required) - Viewport width in pixels (320-3840)
height   (required) - Viewport height in pixels (240-2160)
```

**Rate Limiting:**
- 10 Requests pro Minute pro IP
- 429 Too Many Requests bei Überschreitung

**Response:**

Option A - JSON mit Base64:
```json
{
  "imageBase64": "iVBORw0KGgoAAAANSUh...",
  "width": 1920,
  "height": 1080,
  "format": "png",
  "size": 847320,
  "duration": 1.34
}
```

Option B - Direct Image Response:
```
Content-Type: image/png (oder image/jpeg, image/webp)
Body: Binary image data
```

**Error Responses:**

```json
{
  "error": "Rate limit exceeded",
  "message": "Maximum 10 requests per minute",
  "retryAfter": 42
}
```

```json
{
  "error": "Invalid URL",
  "message": "URL must be a valid HTTP or HTTPS address"
}
```

```json
{
  "error": "Screenshot failed",
  "message": "Target website did not respond within timeout"
}
```

## CORS Configuration

```
Access-Control-Allow-Origin: http://localhost:4321, https://screencraft.io
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

## Security

- URL Validierung: Nur http/https URLs
- Timeout: 30 Sekunden max
- Blacklist: localhost, 127.0.0.1, private IPs
- Max file size: 5MB

## Monitoring

Log folgende Metriken:
- Request count per IP
- Success/failure rate
- Average response time
- Popular target URLs

## Implementation Notes

Für NestJS Backend:
```typescript
@Controller('v1/demo')
export class DemoController {
  @Get('screenshot')
  @Throttle(10, 60) // 10 requests per 60 seconds
  async generateDemoScreenshot(
    @Query() query: DemoScreenshotDto,
    @Ip() ip: string,
  ) {
    // Implementation
  }
}
```
