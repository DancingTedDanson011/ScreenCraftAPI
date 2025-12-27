# PDF Service

Production-ready PDF generation service using Playwright with browser pool management.

## Features

- **PDF from URL**: Generate PDFs from any publicly accessible URL
- **PDF from HTML**: Generate PDFs from raw HTML content
- **Browser Pool**: Efficient browser instance reuse via `BrowserPoolService`
- **Configurable Options**: Support for all standard PDF options (format, margins, headers/footers, etc.)
- **Error Handling**: Comprehensive error handling with custom error types
- **Performance**: Optimized for concurrent PDF generation

## Architecture

```
┌─────────────────┐
│  PDF Controller │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│   PDF Service   │─────▶│ Browser Pool     │
└─────────────────┘      └──────────────────┘
         │
         ▼
┌─────────────────┐
│  Playwright     │
│  PDF API        │
└─────────────────┘
```

## Usage

### Basic Example

```typescript
import { getPdfService } from './services/pdf';

const pdfService = getPdfService();

// Generate PDF from URL
const result = await pdfService.generatePdf({
  type: 'url',
  url: 'https://example.com',
  format: 'A4',
  landscape: false,
});

console.log(`PDF generated: ${result.fileSize} bytes, ${result.pages} pages`);
```

### Advanced Example with Options

```typescript
const result = await pdfService.generatePdf({
  type: 'url',
  url: 'https://example.com',
  format: 'A4',
  landscape: true,
  printBackground: true,
  margin: {
    top: '1cm',
    right: '1cm',
    bottom: '1cm',
    left: '1cm',
  },
  displayHeaderFooter: true,
  headerTemplate: '<div style="font-size: 10px;">Header</div>',
  footerTemplate: '<div style="font-size: 10px;">Page <span class="pageNumber"></span></div>',
  scale: 0.8,
  waitOptions: {
    waitUntil: 'networkidle0',
    timeout: 30000,
    delay: 1000,
  },
  headers: {
    'User-Agent': 'Custom User Agent',
  },
});
```

### Generate from HTML

```typescript
const result = await pdfService.generatePdf({
  type: 'html',
  html: '<html><body><h1>Hello World</h1></body></html>',
  format: 'Letter',
  printBackground: true,
});
```

## API Reference

### `PdfService.generatePdf(options)`

Generates a PDF from URL or HTML content.

**Parameters:**

- `options: PdfGenerationOptions`
  - `type: 'url' | 'html'` - Source type
  - `url?: string` - URL to generate PDF from (required if type is 'url')
  - `html?: string` - HTML content (required if type is 'html')
  - `format?: PdfFormat` - Paper format (default: 'A4')
  - `landscape?: boolean` - Landscape orientation (default: false)
  - `printBackground?: boolean` - Print background graphics (default: true)
  - `margin?: PdfMargin` - Page margins
  - `displayHeaderFooter?: boolean` - Display header/footer (default: false)
  - `headerTemplate?: string` - HTML template for header
  - `footerTemplate?: string` - HTML template for footer
  - `pageRanges?: string` - Paper ranges to print (e.g., '1-5, 8, 11-13')
  - `preferCSSPageSize?: boolean` - Use CSS page size (default: false)
  - `width?: string` - Paper width (overrides format)
  - `height?: string` - Paper height (overrides format)
  - `scale?: number` - Scale of webpage rendering (default: 1, range: 0.1-2)
  - `waitOptions?: object` - Wait options for URL loading
    - `waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'`
    - `timeout?: number` - Navigation timeout in ms (default: 30000)
    - `delay?: number` - Additional delay after load in ms
  - `headers?: Record<string, string>` - Custom HTTP headers
  - `cookies?: Array<Cookie>` - Cookies to set
  - `userAgent?: string` - Custom user agent

**Returns:** `Promise<PdfGenerationResult>`

- `buffer: Buffer` - PDF file buffer
- `fileSize: number` - File size in bytes
- `pages: number` - Estimated page count
- `duration: number` - Generation time in ms

**Throws:**

- `PdfServiceError` - Base error for all PDF service errors
- `PdfGenerationError` - General generation failure
- `PdfNavigationError` - Failed to load URL
- `PdfRenderError` - Failed to render PDF

## Supported Formats

- Letter (8.5in x 11in)
- Legal (8.5in x 14in)
- Tabloid (11in x 17in)
- Ledger (17in x 11in)
- A0 (841mm x 1189mm)
- A1 (594mm x 841mm)
- A2 (420mm x 594mm)
- A3 (297mm x 420mm)
- A4 (210mm x 297mm) - Default
- A5 (148mm x 210mm)
- A6 (105mm x 148mm)

## Error Handling

```typescript
import { PdfServiceError, PdfNavigationError } from './services/pdf';

try {
  const result = await pdfService.generatePdf(options);
} catch (error) {
  if (error instanceof PdfNavigationError) {
    console.error('Failed to load URL:', error.message);
  } else if (error instanceof PdfServiceError) {
    console.error('PDF Service Error:', error.code, error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Defense-in-Depth Validation

The service implements multi-layer validation:

1. **Entry Point**: Validates options structure and required fields
2. **Business Logic**: Validates URL format, timeout ranges, scale values
3. **Environment**: Browser pool manages resource allocation
4. **Debug**: Comprehensive error context for troubleshooting

## Performance Considerations

- **Browser Pool**: Reuses browser instances to reduce overhead
- **Context Isolation**: Each PDF generation uses isolated browser context
- **Auto-cleanup**: Contexts are automatically released after timeout
- **Resource Limits**: Pool limits prevent resource exhaustion

## Configuration

The service uses the browser pool configuration from `config/browser.config.ts`:

```typescript
export const BROWSER_POOL_CONFIG = {
  maxBrowsers: 5,
  maxContextsPerBrowser: 10,
  contextTimeout: 60000, // 60 seconds
  recycleAfterUses: 100,
  healthCheckInterval: 30000,
};
```

## Health Check

```typescript
const health = await pdfService.checkHealth();

if (health.healthy) {
  console.log('PDF Service is healthy');
} else {
  console.log('Browser Pool Issues:', health.browserPoolHealth.issues);
}
```

## Integration with Controller

The `pdf.controller.ts` integrates the service for the REST API:

- `POST /v1/pdfs` - Create PDF (synchronous or async)
- `GET /v1/pdfs/:id` - Get PDF status
- `GET /v1/pdfs/:id/download` - Download PDF
- `DELETE /v1/pdfs/:id` - Delete PDF

## Development Notes

- PDFs are currently stored in-memory (use storage service for production)
- Async processing requires queue service integration
- Consider implementing PDF caching for frequently generated documents
- Monitor browser pool health in production environments

## Testing

```typescript
// Test URL to PDF
const urlResult = await pdfService.generatePdf({
  type: 'url',
  url: 'https://example.com',
  format: 'A4',
});

// Test HTML to PDF
const htmlResult = await pdfService.generatePdf({
  type: 'html',
  html: '<h1>Test</h1>',
  format: 'A4',
});

console.log('Tests passed!');
```

## License

MIT
