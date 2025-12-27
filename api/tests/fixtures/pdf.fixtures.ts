import { faker } from '@faker-js/faker';

/**
 * PDF request fixtures for testing
 */
export const pdfFixtures = {
  /**
   * Valid minimal PDF request
   */
  validMinimal: () => ({
    url: 'https://example.com',
  }),

  /**
   * Valid PDF request with all options
   */
  validFull: () => ({
    url: 'https://example.com/article',
    format: 'A4' as const,
    landscape: false,
    printBackground: true,
    scale: 1,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm',
    },
    headerTemplate: '<div style="font-size:10px;">Header</div>',
    footerTemplate:
      '<div style="font-size:10px;text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    displayHeaderFooter: true,
    preferCSSPageSize: false,
    viewport: {
      width: 1200,
      height: 800,
    },
    waitOptions: {
      waitUntil: 'networkidle0' as const,
      timeout: 30000,
    },
  }),

  /**
   * PDF request for letter format (US)
   */
  letterFormat: () => ({
    url: 'https://example.com/document',
    format: 'Letter' as const,
    printBackground: true,
    margin: {
      top: '1in',
      right: '1in',
      bottom: '1in',
      left: '1in',
    },
  }),

  /**
   * PDF request for landscape orientation
   */
  landscape: () => ({
    url: 'https://example.com/chart',
    format: 'A4' as const,
    landscape: true,
    printBackground: true,
  }),

  /**
   * PDF request with custom page size
   */
  customSize: () => ({
    url: 'https://example.com',
    width: '210mm',
    height: '297mm', // A4 size in mm
    printBackground: true,
  }),

  /**
   * PDF request with headers and footers
   */
  withHeaderFooter: () => ({
    url: 'https://example.com/report',
    format: 'A4' as const,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size:10px; width:100%; text-align:center;">
        <span>Company Report - <span class="date"></span></span>
      </div>
    `,
    footerTemplate: `
      <div style="font-size:10px; width:100%; text-align:center;">
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `,
    margin: {
      top: '40mm',
      bottom: '30mm',
      left: '15mm',
      right: '15mm',
    },
    printBackground: true,
  }),

  /**
   * PDF request for invoice
   */
  invoice: () => ({
    url: 'https://example.com/invoice/12345',
    format: 'A4' as const,
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: '10mm',
      right: '10mm',
      bottom: '10mm',
      left: '10mm',
    },
  }),

  /**
   * PDF request with page range
   */
  pageRange: () => ({
    url: 'https://example.com/book',
    format: 'A4' as const,
    pageRanges: '1-5, 8, 11-13',
    printBackground: true,
  }),

  /**
   * Invalid PDF request - missing URL
   */
  invalidMissingUrl: () => ({
    format: 'A4',
    printBackground: true,
  }),

  /**
   * Invalid PDF request - invalid URL format
   */
  invalidUrlFormat: () => ({
    url: 'not-a-valid-url',
    format: 'A4' as const,
  }),

  /**
   * Invalid PDF request - invalid format
   */
  invalidFormat: () => ({
    url: 'https://example.com',
    format: 'A7' as const, // Invalid format
  }),

  /**
   * Invalid PDF request - negative scale
   */
  invalidScale: () => ({
    url: 'https://example.com',
    format: 'A4' as const,
    scale: -1, // Invalid scale
  }),

  /**
   * Generate random valid PDF request
   */
  random: () => ({
    url: faker.internet.url(),
    format: faker.helpers.arrayElement([
      'A4',
      'A3',
      'A5',
      'Letter',
      'Legal',
      'Tabloid',
    ]) as 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid',
    landscape: faker.datatype.boolean(),
    printBackground: faker.datatype.boolean(),
    scale: faker.number.float({ min: 0.1, max: 2, fractionDigits: 1 }),
    margin: {
      top: `${faker.number.int({ min: 5, max: 50 })}mm`,
      right: `${faker.number.int({ min: 5, max: 30 })}mm`,
      bottom: `${faker.number.int({ min: 5, max: 50 })}mm`,
      left: `${faker.number.int({ min: 5, max: 30 })}mm`,
    },
  }),

  /**
   * Batch of random PDF requests
   */
  batch: (count = 5) => {
    return Array.from({ length: count }, () => pdfFixtures.random());
  },
};

/**
 * PDF result fixtures
 */
export const pdfResultFixtures = {
  /**
   * Successful PDF result
   */
  success: () => ({
    buffer: Buffer.from('%PDF-1.4 fake pdf content'),
    format: 'A4' as const,
    pages: 3,
    fileSize: 54321,
  }),

  /**
   * Large PDF result (multi-page)
   */
  large: () => ({
    buffer: Buffer.from('%PDF-1.4 large fake pdf content'),
    format: 'A4' as const,
    pages: 25,
    fileSize: 987654,
  }),

  /**
   * Single page PDF result
   */
  singlePage: () => ({
    buffer: Buffer.from('%PDF-1.4 single page'),
    format: 'A4' as const,
    pages: 1,
    fileSize: 12345,
  }),
};

/**
 * PDF API response fixtures
 */
export const pdfApiFixtures = {
  /**
   * Successful API response
   */
  successResponse: () => ({
    success: true,
    data: {
      url: 'https://storage.example.com/pdfs/test.pdf',
      format: 'A4',
      pages: 3,
      fileSize: 54321,
      storageKey: 'pdfs/user-123/1234567890-test.pdf',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'req_123456',
      version: 'v1',
    },
  }),

  /**
   * Error API response - validation error
   */
  validationError: () => ({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request parameters',
      details: {
        url: ['URL is required'],
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'req_123456',
      version: 'v1',
    },
  }),

  /**
   * Error API response - generation error
   */
  generationError: () => ({
    success: false,
    error: {
      code: 'PDF_GENERATION_FAILED',
      message: 'Failed to generate PDF from the provided URL',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'req_123456',
      version: 'v1',
    },
  }),
};

/**
 * HTML content fixtures for PDF generation
 */
export const htmlContentFixtures = {
  /**
   * Simple HTML document
   */
  simple: () => `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test Document</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
        </style>
      </head>
      <body>
        <h1>Test Document</h1>
        <p>This is a test paragraph.</p>
      </body>
    </html>
  `,

  /**
   * Multi-page HTML document
   */
  multiPage: () => `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Multi-page Document</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>
        <h1>Page 1</h1>
        <p>Content on page 1.</p>
        <div class="page-break"></div>
        <h1>Page 2</h1>
        <p>Content on page 2.</p>
        <div class="page-break"></div>
        <h1>Page 3</h1>
        <p>Content on page 3.</p>
      </body>
    </html>
  `,

  /**
   * Invoice HTML template
   */
  invoice: () => `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice #12345</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; }
          .total { text-align: right; font-size: 1.5em; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div><h1>Invoice</h1><p>#12345</p></div>
          <div><p>Date: ${new Date().toLocaleDateString()}</p></div>
        </div>
        <table>
          <thead>
            <tr><th>Item</th><th>Quantity</th><th>Price</th><th>Total</th></tr>
          </thead>
          <tbody>
            <tr><td>Service A</td><td>1</td><td>$100</td><td>$100</td></tr>
            <tr><td>Service B</td><td>2</td><td>$50</td><td>$100</td></tr>
          </tbody>
        </table>
        <div class="total"><strong>Total: $200</strong></div>
      </body>
    </html>
  `,
};
