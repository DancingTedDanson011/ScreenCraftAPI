# Storage Service

S3-kompatibler Storage-Service für MinIO und AWS S3.

## Features

- S3-kompatible API (MinIO, AWS S3, DigitalOcean Spaces, etc.)
- Automatische Bucket-Erstellung
- Signed URLs für sicheren Download
- File-Upload mit Validierung
- Metadata-Support
- Type-safe TypeScript API
- Production-ready Fehlerbehandlung

## Installation

```bash
# Dependencies sind bereits in package.json enthalten
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## Konfiguration

### Environment Variables

```env
# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=screenshots
MINIO_USE_SSL=false
```

### TypeScript Configuration

Die Konfiguration erfolgt automatisch über `src/config/storage.config.ts`:

```typescript
import { getStorageConfig } from './config/storage.config';

const config = getStorageConfig();
// {
//   endpoint: 'localhost',
//   port: 9000,
//   accessKeyId: 'minioadmin',
//   secretAccessKey: 'minioadmin',
//   bucket: 'screenshots',
//   useSSL: false,
//   region: 'eu-central-1'
// }
```

## Verwendung

### Singleton Service (empfohlen)

```typescript
import { getStorageService, initializeStorage } from './services/storage';

// 1. Bei App-Start initialisieren
await initializeStorage();

// 2. Service überall verwenden
const storage = getStorageService();
```

### Manuelle Instanz

```typescript
import { createStorageService } from './services/storage';

const storage = createStorageService({
  endpoint: 'minio.example.com',
  port: 9000,
  accessKeyId: 'custom-key',
  secretAccessKey: 'custom-secret',
  bucket: 'my-bucket',
  useSSL: true,
});

await storage.initialize();
```

## API Reference

### High-Level API (empfohlen)

#### uploadFile()

Upload mit automatischer Validierung und URL-Generierung:

```typescript
const result = await storage.uploadFile(
  buffer,           // Buffer
  'screenshot.png', // Filename
  'image/png',      // Content-Type
  'user123',        // User ID
  {
    metadata: { url: 'https://example.com' },
    expiresIn: 3600, // Signed URL Expiration (Sekunden)
    validateSize: true,
    validateType: true,
  }
);

// Result:
// {
//   key: 'screenshots/user123/1234567890-screenshot.png',
//   url: 'https://minio:9000/screenshots/...',
//   bucket: 'screenshots',
//   size: 102400
// }
```

#### downloadFile()

Download mit Metadata:

```typescript
const { data, contentType, size } = await storage.downloadFile(
  'screenshots/user123/1234567890-screenshot.png'
);

// data: Buffer
// contentType: 'image/png'
// size: 102400
```

#### deleteFile()

```typescript
await storage.deleteFile('screenshots/user123/1234567890-screenshot.png');
```

#### getSignedUrl()

Temporäre Download-URL generieren:

```typescript
const url = await storage.getSignedUrl(
  'screenshots/user123/1234567890-screenshot.png',
  3600 // Expires in 1 Stunde
);

// url: 'https://minio:9000/screenshots/...?X-Amz-Signature=...'
```

#### getFileMetadata()

Metadata ohne Download:

```typescript
const metadata = await storage.getFileMetadata(
  'screenshots/user123/1234567890-screenshot.png'
);

// {
//   contentType: 'image/png',
//   size: 102400,
//   lastModified: Date,
//   metadata: { url: 'https://example.com' }
// }
```

### Low-Level API

#### upload()

Direkter Upload ohne Validierung:

```typescript
const key = await storage.upload(
  'custom/path/file.png',
  buffer,
  'image/png',
  { customMeta: 'value' }
);
```

#### download()

Direkter Download (nur Buffer):

```typescript
const buffer = await storage.download('custom/path/file.png');
```

#### delete()

```typescript
await storage.delete('custom/path/file.png');
```

#### exists()

```typescript
const exists = await storage.exists('custom/path/file.png');
// true | false
```

### Helper Methods

#### generateScreenshotKey()

```typescript
const key = storage.generateScreenshotKey('user123', 'screenshot.png');
// 'screenshots/user123/1234567890-screenshot.png'
```

#### generatePdfKey()

```typescript
const key = storage.generatePdfKey('user123', 'document.pdf');
// 'pdfs/user123/1234567890-document.pdf'
```

## Integration Beispiele

### Screenshot Controller

```typescript
import { getStorageService } from '../services/storage';
import { getScreenshotService } from '../services/screenshot';

export async function createScreenshot(request, reply) {
  const screenshotService = getScreenshotService();
  const storageService = getStorageService();

  // 1. Capture
  const result = await screenshotService.captureScreenshot(request.body);

  // 2. Upload
  const upload = await storageService.uploadFile(
    result.buffer,
    `screenshot-${Date.now()}.${result.format}`,
    screenshotService.getContentType(result.format),
    request.user?.id || 'anonymous',
    {
      metadata: {
        url: request.body.url,
        width: result.width.toString(),
        height: result.height.toString(),
      },
    }
  );

  // 3. Response
  reply.code(201).send({
    success: true,
    data: {
      url: upload.url,
      key: upload.key,
      size: upload.size,
    },
  });
}
```

### Download Handler

```typescript
export async function downloadScreenshot(request, reply) {
  const storageService = getStorageService();

  const { data, contentType } = await storageService.downloadFile(
    request.params.key
  );

  reply
    .header('Content-Type', contentType)
    .header('Content-Length', data.length)
    .header('Content-Disposition', 'attachment')
    .send(data);
}
```

### Delete Handler

```typescript
export async function deleteScreenshot(request, reply) {
  const storageService = getStorageService();

  await storageService.deleteFile(request.params.key);

  reply.code(204).send();
}
```

## Validierung

### File Size

```typescript
import { validateFileSize, STORAGE_CONSTANTS } from '../config/storage.config';

try {
  validateFileSize(buffer.length);
  // Default: 50MB max
} catch (error) {
  // Error: File size exceeds maximum allowed size
}

// Custom limit
validateFileSize(buffer.length, 10 * 1024 * 1024); // 10MB
```

### MIME Type

```typescript
import { validateMimeType, STORAGE_CONSTANTS } from '../config/storage.config';

try {
  validateMimeType(
    'image/png',
    STORAGE_CONSTANTS.ALLOWED_MIME_TYPES.images
  );
  // OK
} catch (error) {
  // Error: Invalid content type
}
```

## Error Handling

Alle Methoden werfen aussagekräftige Fehler:

```typescript
try {
  await storage.uploadFile(buffer, 'test.png', 'image/png', 'user123');
} catch (error) {
  console.error(error.message);
  // Possible errors:
  // - "File size exceeds maximum allowed size of X bytes"
  // - "Invalid content type: application/json. Allowed types: image/png, image/jpeg, image/webp, application/pdf"
  // - "Failed to upload file: <S3 error>"
  // - "Failed to generate signed URL: <S3 error>"
}
```

## Testing

```typescript
import { resetStorageService, createStorageService } from '../services/storage';

describe('Storage Service', () => {
  let storage: StorageService;

  beforeEach(async () => {
    resetStorageService(); // Reset singleton
    storage = createStorageService({
      endpoint: 'localhost',
      port: 9000,
      accessKeyId: 'test',
      secretAccessKey: 'test',
      bucket: 'test-bucket',
    });
    await storage.initialize();
  });

  it('should upload file', async () => {
    const buffer = Buffer.from('test');
    const result = await storage.uploadFile(
      buffer,
      'test.txt',
      'text/plain',
      'test-user'
    );

    expect(result.key).toMatch(/files\/test-user\/\d+-test\.txt/);
    expect(result.size).toBe(4);
    expect(result.url).toBeTruthy();
  });
});
```

## Production Deployment

### AWS S3

```env
MINIO_ENDPOINT=s3.eu-central-1.amazonaws.com
MINIO_PORT=443
MINIO_ACCESS_KEY=<AWS_ACCESS_KEY_ID>
MINIO_SECRET_KEY=<AWS_SECRET_ACCESS_KEY>
MINIO_BUCKET=my-production-bucket
MINIO_USE_SSL=true
AWS_REGION=eu-central-1
```

### DigitalOcean Spaces

```env
MINIO_ENDPOINT=fra1.digitaloceanspaces.com
MINIO_PORT=443
MINIO_ACCESS_KEY=<DO_SPACES_KEY>
MINIO_SECRET_KEY=<DO_SPACES_SECRET>
MINIO_BUCKET=my-space
MINIO_USE_SSL=true
AWS_REGION=fra1
```

### MinIO (Self-hosted)

```env
MINIO_ENDPOINT=minio.example.com
MINIO_PORT=9000
MINIO_ACCESS_KEY=<CUSTOM_KEY>
MINIO_SECRET_KEY=<CUSTOM_SECRET>
MINIO_BUCKET=screenshots
MINIO_USE_SSL=true
```

## Best Practices

1. **Initialisierung beim App-Start:**
   ```typescript
   import { initializeStorage } from './services/storage';
   await initializeStorage(); // Creates bucket if needed
   ```

2. **Singleton-Pattern verwenden:**
   ```typescript
   const storage = getStorageService(); // Immer dieselbe Instanz
   ```

3. **Fehler behandeln:**
   ```typescript
   try {
     await storage.uploadFile(...);
   } catch (error) {
     logger.error('Storage error:', error);
     // Fallback oder Retry-Logik
   }
   ```

4. **Validierung aktivieren:**
   ```typescript
   await storage.uploadFile(buffer, filename, contentType, userId, {
     validateSize: true,  // Immer validieren
     validateType: true,  // Nur erlaubte MIME-Types
   });
   ```

5. **Signed URLs mit Expiration:**
   ```typescript
   const url = await storage.getSignedUrl(key, 3600); // 1 Stunde
   ```

6. **Metadata für Tracking:**
   ```typescript
   await storage.uploadFile(buffer, filename, contentType, userId, {
     metadata: {
       source: 'screenshot-api',
       url: originalUrl,
       timestamp: new Date().toISOString(),
     },
   });
   ```

## Troubleshooting

### Bucket wird nicht erstellt

```typescript
// Manuell initialisieren
await storage.initialize();
```

### Connection Errors

- MinIO läuft: `docker ps | grep minio`
- Network erreichbar: `curl http://localhost:9000/minio/health/live`
- Credentials korrekt: Prüfe Environment Variables

### Signed URLs funktionieren nicht

- `MINIO_USE_SSL` muss mit tatsächlichem Protokoll übereinstimmen
- Bei lokalem MinIO: `MINIO_USE_SSL=false`
- Bei Production: `MINIO_USE_SSL=true`

## License

MIT
