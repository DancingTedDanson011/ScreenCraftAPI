import { vi } from 'vitest';

/**
 * Mock upload result
 */
export interface MockUploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
}

/**
 * Mock download result
 */
export interface MockDownloadResult {
  data: Buffer;
  contentType: string;
  size: number;
}

/**
 * In-memory storage for testing
 */
class InMemoryStorage {
  private storage: Map<string, { data: Buffer; contentType: string; metadata?: Record<string, string> }> = new Map();

  upload(key: string, data: Buffer, contentType: string, metadata?: Record<string, string>): void {
    this.storage.set(key, { data, contentType, metadata });
  }

  download(key: string): { data: Buffer; contentType: string } | null {
    const item = this.storage.get(key);
    if (!item) return null;
    return { data: item.data, contentType: item.contentType };
  }

  delete(key: string): boolean {
    return this.storage.delete(key);
  }

  exists(key: string): boolean {
    return this.storage.has(key);
  }

  clear(): void {
    this.storage.clear();
  }

  getAll(): string[] {
    return Array.from(this.storage.keys());
  }

  size(): number {
    return this.storage.size;
  }
}

/**
 * Create a mock Storage Service
 */
export function createMockStorageService() {
  const inMemoryStorage = new InMemoryStorage();
  let urlCounter = 0;

  const mockService = {
    _storage: inMemoryStorage,

    initialize: vi.fn().mockResolvedValue(undefined),

    upload: vi.fn().mockImplementation(
      async (
        key: string,
        data: Buffer,
        contentType: string,
        metadata?: Record<string, string>
      ): Promise<string> => {
        inMemoryStorage.upload(key, data, contentType, metadata);
        return key;
      }
    ),

    getSignedUrl: vi.fn().mockImplementation(
      async (key: string, _expiresIn?: number): Promise<string> => {
        urlCounter++;
        return `https://test-storage.example.com/${key}?token=mock-token-${urlCounter}`;
      }
    ),

    delete: vi.fn().mockImplementation(async (key: string): Promise<void> => {
      inMemoryStorage.delete(key);
    }),

    download: vi.fn().mockImplementation(async (key: string): Promise<Buffer> => {
      const result = inMemoryStorage.download(key);
      if (!result) {
        throw new Error(`File not found: ${key}`);
      }
      return result.data;
    }),

    exists: vi.fn().mockImplementation(async (key: string): Promise<boolean> => {
      return inMemoryStorage.exists(key);
    }),

    generateScreenshotKey: vi.fn().mockImplementation(
      (userId: string, filename: string): string => {
        const timestamp = Date.now();
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        return `screenshots/${userId}/${timestamp}-${sanitizedFilename}`;
      }
    ),

    generatePdfKey: vi.fn().mockImplementation(
      (userId: string, filename: string): string => {
        const timestamp = Date.now();
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        return `pdfs/${userId}/${timestamp}-${sanitizedFilename}`;
      }
    ),

    uploadFile: vi.fn().mockImplementation(
      async (
        buffer: Buffer,
        filename: string,
        contentType: string,
        userId = 'system',
        _options?: any
      ): Promise<MockUploadResult> => {
        let key: string;
        if (contentType.startsWith('image/')) {
          key = mockService.generateScreenshotKey(userId, filename);
        } else if (contentType === 'application/pdf') {
          key = mockService.generatePdfKey(userId, filename);
        } else {
          key = `files/${userId}/${Date.now()}-${filename}`;
        }

        inMemoryStorage.upload(key, buffer, contentType);
        const url = await mockService.getSignedUrl(key);

        return {
          key,
          url,
          bucket: 'test-bucket',
          size: buffer.length,
        };
      }
    ),

    downloadFile: vi.fn().mockImplementation(
      async (key: string): Promise<MockDownloadResult> => {
        const result = inMemoryStorage.download(key);
        if (!result) {
          throw new Error(`File not found: ${key}`);
        }
        return {
          data: result.data,
          contentType: result.contentType,
          size: result.data.length,
        };
      }
    ),

    deleteFile: vi.fn().mockImplementation(async (key: string): Promise<void> => {
      inMemoryStorage.delete(key);
    }),

    getFileMetadata: vi.fn().mockImplementation(
      async (key: string): Promise<{
        contentType: string;
        size: number;
        lastModified?: Date;
        metadata?: Record<string, string>;
      }> => {
        const result = inMemoryStorage.download(key);
        if (!result) {
          throw new Error(`File not found: ${key}`);
        }
        return {
          contentType: result.contentType,
          size: result.data.length,
          lastModified: new Date(),
          metadata: {},
        };
      }
    ),

    getBucket: vi.fn().mockReturnValue('test-bucket'),

    // Test utilities
    _clear: () => inMemoryStorage.clear(),
    _getAll: () => inMemoryStorage.getAll(),
    _size: () => inMemoryStorage.size(),
  };

  return mockService;
}

/**
 * Mock S3 Client for AWS SDK
 */
export function createMockS3Client() {
  return {
    send: vi.fn().mockImplementation(async (command: any) => {
      const commandName = command.constructor.name;

      switch (commandName) {
        case 'PutObjectCommand':
          return { ETag: '"mock-etag"' };

        case 'GetObjectCommand':
          return {
            Body: {
              async *[Symbol.asyncIterator]() {
                yield Buffer.from('mock-file-content');
              },
            },
            ContentType: 'image/png',
            ContentLength: 18,
            LastModified: new Date(),
            Metadata: {},
          };

        case 'DeleteObjectCommand':
          return {};

        case 'HeadBucketCommand':
          return {};

        case 'CreateBucketCommand':
          return { Location: '/test-bucket' };

        case 'HeadObjectCommand':
          return {
            ContentType: 'image/png',
            ContentLength: 18,
            LastModified: new Date(),
            Metadata: {},
          };

        default:
          throw new Error(`Unknown command: ${commandName}`);
      }
    }),
    config: {
      endpoint: vi.fn().mockReturnValue('http://localhost:9000'),
    },
    destroy: vi.fn(),
  };
}

/**
 * Setup storage mock module
 * Note: Due to hoisting, vi.mock cannot reference external variables.
 * Use this function to create and apply mocks manually in tests.
 */
export function setupStorageMock() {
  const mockService = createMockStorageService();
  return mockService;
}
