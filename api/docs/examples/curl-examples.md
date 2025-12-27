# cURL Examples - ScreenCraft API

This document contains copy-paste-ready cURL examples for all ScreenCraft API endpoints.

## Prerequisites

Replace `YOUR_API_KEY` with your actual API key in all examples below.

```bash
export SCREENCRAFT_API_KEY="your-api-key-here"
export SCREENCRAFT_API_URL="https://api.screencraft.com"
```

For local development:
```bash
export SCREENCRAFT_API_URL="http://localhost:3000"
```

---

## Health Check

### Check API Status

```bash
curl -X GET "${SCREENCRAFT_API_URL}/health"
```

---

## Screenshots

### 1. Basic Screenshot

Capture a simple screenshot of a webpage:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "format": "png"
  }'
```

### 2. Full Page Screenshot

Capture the entire scrollable page:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "fullPage": true,
    "format": "jpeg",
    "quality": 90
  }'
```

### 3. Custom Viewport

Capture with specific viewport dimensions:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "viewport": {
      "width": 1280,
      "height": 720,
      "deviceScaleFactor": 2
    },
    "format": "png"
  }'
```

### 4. Mobile Viewport

Emulate a mobile device:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "viewport": {
      "width": 375,
      "height": 812,
      "deviceScaleFactor": 3,
      "isMobile": true,
      "hasTouch": true
    },
    "format": "png"
  }'
```

### 5. Screenshot with Wait Options

Wait for network idle before capturing:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "waitOptions": {
      "waitUntil": "networkidle0",
      "timeout": 30000,
      "delay": 1000
    },
    "format": "png"
  }'
```

### 6. Screenshot with Specific Selector

Wait for a specific element before capturing:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "waitOptions": {
      "selector": "#main-content",
      "timeout": 30000
    },
    "format": "png"
  }'
```

### 7. Clipped/Cropped Screenshot

Capture a specific area:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "clip": {
      "x": 100,
      "y": 100,
      "width": 800,
      "height": 600
    },
    "format": "png"
  }'
```

### 8. Screenshot with Custom Headers

Add authentication or custom headers:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "headers": {
      "Authorization": "Bearer your-token",
      "X-Custom-Header": "value"
    },
    "format": "png"
  }'
```

### 9. Screenshot with Cookies

Set cookies before capturing:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "cookies": [
      {
        "name": "session_id",
        "value": "abc123",
        "domain": "example.com",
        "path": "/",
        "secure": true,
        "httpOnly": true
      }
    ],
    "format": "png"
  }'
```

### 10. Block Resources for Faster Loading

Block images, stylesheets, or scripts:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "blockResources": ["image", "font", "media"],
    "format": "png"
  }'
```

### 11. WebP Format with Quality

Use modern WebP format:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "format": "webp",
    "quality": 85
  }'
```

### 12. Transparent Background (PNG)

Omit background for transparent PNG:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "format": "png",
    "omitBackground": true
  }'
```

### 13. Async Screenshot with Webhook

Process in background with webhook notification:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "fullPage": true,
    "async": true,
    "webhookUrl": "https://your-app.com/webhooks/screenshot",
    "metadata": {
      "userId": "user123",
      "projectId": "proj456"
    }
  }'
```

### 14. Get Screenshot Status

Check the status of an async screenshot:

```bash
curl -X GET "${SCREENCRAFT_API_URL}/v1/screenshots/123e4567-e89b-12d3-a456-426614174000" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}"
```

### 15. List Screenshots

Get paginated list with filtering:

```bash
curl -X GET "${SCREENCRAFT_API_URL}/v1/screenshots?page=1&limit=20&status=completed&sortBy=createdAt&sortOrder=desc" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}"
```

### 16. Download Screenshot

Download the screenshot file directly:

```bash
curl -X GET "${SCREENCRAFT_API_URL}/v1/screenshots/123e4567-e89b-12d3-a456-426614174000/download" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -o screenshot.png
```

### 17. Delete Screenshot

Delete a screenshot and its file:

```bash
curl -X DELETE "${SCREENCRAFT_API_URL}/v1/screenshots/123e4567-e89b-12d3-a456-426614174000" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}"
```

---

## PDFs

### 1. Basic PDF from URL

Generate a simple PDF:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/pdfs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "type": "url",
    "url": "https://example.com",
    "format": "A4",
    "printBackground": true
  }'
```

### 2. PDF from HTML

Generate PDF from HTML content:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/pdfs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "type": "html",
    "html": "<html><head><style>body { font-family: Arial; }</style></head><body><h1>Invoice</h1><p>Total: $99.99</p></body></html>",
    "format": "A4"
  }'
```

### 3. Landscape PDF

Generate in landscape orientation:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/pdfs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "type": "url",
    "url": "https://example.com",
    "format": "A4",
    "landscape": true
  }'
```

### 4. PDF with Custom Margins

Set specific margins:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/pdfs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "type": "url",
    "url": "https://example.com",
    "format": "A4",
    "margin": {
      "top": "20mm",
      "right": "15mm",
      "bottom": "20mm",
      "left": "15mm"
    }
  }'
```

### 5. PDF with Header and Footer

Add custom header and footer:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/pdfs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "type": "url",
    "url": "https://example.com",
    "format": "A4",
    "displayHeaderFooter": true,
    "headerTemplate": "<div style=\"font-size:10px; text-align:center; width:100%;\">Company Name</div>",
    "footerTemplate": "<div style=\"font-size:10px; text-align:center; width:100%;\">Page <span class=\"pageNumber\"></span> of <span class=\"totalPages\"></span></div>",
    "margin": {
      "top": "40mm",
      "bottom": "30mm"
    }
  }'
```

### 6. US Letter Format

Use US Letter format:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/pdfs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "type": "url",
    "url": "https://example.com",
    "format": "Letter"
  }'
```

### 7. Custom Page Size

Set custom width and height:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/pdfs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "type": "url",
    "url": "https://example.com",
    "width": "8.5in",
    "height": "11in"
  }'
```

### 8. Specific Page Ranges

Print only specific pages:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/pdfs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "type": "url",
    "url": "https://example.com",
    "format": "A4",
    "pageRanges": "1-5, 8, 11-13"
  }'
```

### 9. Scaled Content

Scale the page content:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/pdfs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "type": "url",
    "url": "https://example.com",
    "format": "A4",
    "scale": 0.8
  }'
```

### 10. PDF with Wait Options

Wait for content to load:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/pdfs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "type": "url",
    "url": "https://example.com",
    "format": "A4",
    "waitOptions": {
      "waitUntil": "networkidle0",
      "timeout": 30000,
      "delay": 2000
    }
  }'
```

### 11. PDF with Cookies and Headers

Add authentication:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/pdfs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "type": "url",
    "url": "https://example.com/private",
    "format": "A4",
    "headers": {
      "Authorization": "Bearer your-token"
    },
    "cookies": [
      {
        "name": "session",
        "value": "abc123",
        "domain": "example.com"
      }
    ]
  }'
```

### 12. Async PDF with Webhook

Process in background:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/pdfs" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "type": "url",
    "url": "https://example.com",
    "format": "A4",
    "async": true,
    "webhookUrl": "https://your-app.com/webhooks/pdf",
    "metadata": {
      "orderId": "order789",
      "customerId": "cust456"
    }
  }'
```

### 13. Get PDF Status

Check PDF processing status:

```bash
curl -X GET "${SCREENCRAFT_API_URL}/v1/pdfs/123e4567-e89b-12d3-a456-426614174000" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}"
```

### 14. List PDFs

Get filtered list:

```bash
curl -X GET "${SCREENCRAFT_API_URL}/v1/pdfs?page=1&limit=20&status=completed&type=url&sortBy=createdAt&sortOrder=desc" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}"
```

### 15. Download PDF

Download the PDF file:

```bash
curl -X GET "${SCREENCRAFT_API_URL}/v1/pdfs/123e4567-e89b-12d3-a456-426614174000/download" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -o document.pdf
```

### 16. Delete PDF

Delete a PDF:

```bash
curl -X DELETE "${SCREENCRAFT_API_URL}/v1/pdfs/123e4567-e89b-12d3-a456-426614174000" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}"
```

---

## Advanced Use Cases

### Poll Async Job Until Complete

Bash script to poll until completion:

```bash
#!/bin/bash

# Create async screenshot
RESPONSE=$(curl -s -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "fullPage": true,
    "async": true
  }')

# Extract ID
SCREENSHOT_ID=$(echo $RESPONSE | jq -r '.data.id')
echo "Screenshot ID: $SCREENSHOT_ID"

# Poll until complete
while true; do
  STATUS=$(curl -s -X GET "${SCREENCRAFT_API_URL}/v1/screenshots/${SCREENSHOT_ID}" \
    -H "X-API-Key: ${SCREENCRAFT_API_KEY}" | jq -r '.data.status')

  echo "Status: $STATUS"

  if [ "$STATUS" = "completed" ]; then
    echo "Screenshot complete!"
    curl -X GET "${SCREENCRAFT_API_URL}/v1/screenshots/${SCREENSHOT_ID}/download" \
      -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
      -o screenshot.png
    echo "Downloaded to screenshot.png"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Screenshot failed!"
    break
  fi

  sleep 2
done
```

### Batch Screenshots

Generate multiple screenshots:

```bash
#!/bin/bash

URLS=(
  "https://example.com"
  "https://example.org"
  "https://example.net"
)

for url in "${URLS[@]}"; do
  echo "Capturing: $url"
  curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
    -d "{
      \"url\": \"$url\",
      \"async\": true
    }"
  sleep 1
done
```

### Save Response to File

Save metadata for later use:

```bash
curl -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com",
    "format": "png"
  }' | jq '.' > response.json

# Extract download URL
DOWNLOAD_URL=$(jq -r '.data.downloadUrl' response.json)
echo "Download URL: $DOWNLOAD_URL"
```

---

## Error Handling

### Handle Rate Limits

```bash
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "429" ]; then
  RESET=$(echo "$BODY" | jq -r '.error.details.reset')
  echo "Rate limited. Try again at: $RESET"
else
  echo "$BODY" | jq '.'
fi
```

### Validate Response

```bash
RESPONSE=$(curl -s -X POST "${SCREENCRAFT_API_URL}/v1/screenshots" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${SCREENCRAFT_API_KEY}" \
  -d '{
    "url": "https://example.com"
  }')

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo "Success!"
  echo "$RESPONSE" | jq '.data'
else
  echo "Error:"
  echo "$RESPONSE" | jq '.error'
fi
```

---

## Tips

1. **Use jq for JSON parsing**: Install with `apt-get install jq` or `brew install jq`
2. **Set environment variables**: Store API key and URL as environment variables
3. **Add `-v` flag**: For verbose output to debug issues
4. **Use `-o filename`**: To save binary files (screenshots/PDFs)
5. **Check rate limits**: Monitor `X-RateLimit-*` headers in responses
6. **Use async mode**: For large screenshots or PDFs to avoid timeouts
7. **Handle errors**: Always check the `success` field in responses
