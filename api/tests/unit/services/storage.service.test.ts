import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create a mock S3Client class
const mockSend = vi.fn();

class MockS3Client {
  send = mockSend;
  config = {
    endpoint: vi.fn().mockReturnValue('http://localhost:9000'),
  };
  destroy = vi.fn();
}

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: MockS3Client,
  PutObjectCommand: class PutObjectCommand {
    constructor(public input: any) {}
  },
  GetObjectCommand: class GetObjectCommand {
    constructor(public input: any) {}
  },
  DeleteObjectCommand: class DeleteObjectCommand {
    constructor(public input: any) {}
  },
  HeadBucketCommand: class HeadBucketCommand {
    constructor(public input: any) {}
  },
  CreateBucketCommand: class CreateBucketCommand {
    constructor(public input: any) {}
  },
  HeadObjectCommand: class HeadObjectCommand {
    constructor(public input: any) {}
  },
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com/file'),
}));

// Import after mocking
const { StorageService, createStorageService } = await import(
  '../../../src/services/storage/storage.service.js'
);

describe('StorageService', () => {
  let service: InstanceType<typeof StorageService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StorageService({
      endpoint: 'localhost',
      port: 9000,
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      bucket: 'test-bucket',
      region: 'us-east-1',
      useSSL: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should not create bucket if it exists', async () => {
      mockSend.mockResolvedValueOnce({});

      await service.initialize();

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should create bucket if it does not exist', async () => {
      const notFoundError = new Error('Bucket not found');
      (notFoundError as any).name = 'NotFound';
      mockSend.mockRejectedValueOnce(notFoundError);
      mockSend.mockResolvedValueOnce({ Location: '/test-bucket' });

      await service.initialize();

      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should throw on other errors', async () => {
      const error = new Error('Access denied');
      mockSend.mockRejectedValueOnce(error);

      await expect(service.initialize()).rejects.toThrow('Access denied');
    });
  });

  describe('upload', () => {
    it('should upload a file successfully', async () => {
      mockSend.mockResolvedValueOnce({ ETag: '"mock-etag"' });

      const key = await service.upload(
        'test-key.png',
        Buffer.from('test-data'),
        'image/png'
      );

      expect(key).toBe('test-key.png');
      expect(mockSend).toHaveBeenCalled();
    });

    it('should upload with metadata', async () => {
      mockSend.mockResolvedValueOnce({ ETag: '"mock-etag"' });

      const key = await service.upload(
        'test-key.png',
        Buffer.from('test-data'),
        'image/png',
        { userId: '123', source: 'test' }
      );

      expect(key).toBe('test-key.png');
    });

    it('should throw on upload failure', async () => {
      mockSend.mockRejectedValueOnce(new Error('Upload failed'));

      await expect(
        service.upload('test-key.png', Buffer.from('test-data'), 'image/png')
      ).rejects.toThrow('Failed to upload file');
    });
  });

  describe('getSignedUrl', () => {
    it('should return a signed URL', async () => {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      const url = await service.getSignedUrl('test-key.png');

      expect(url).toBe('https://signed-url.example.com/file');
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it('should use custom expiration time', async () => {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      await service.getSignedUrl('test-key.png', 7200);

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 7200 }
      );
    });
  });

  describe('delete', () => {
    it('should delete a file successfully', async () => {
      mockSend.mockResolvedValueOnce({});

      await expect(service.delete('test-key.png')).resolves.not.toThrow();
      expect(mockSend).toHaveBeenCalled();
    });

    it('should throw on delete failure', async () => {
      mockSend.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(service.delete('test-key.png')).rejects.toThrow(
        'Failed to delete file'
      );
    });
  });

  describe('download', () => {
    it('should download a file successfully', async () => {
      mockSend.mockResolvedValueOnce({
        Body: {
          async *[Symbol.asyncIterator]() {
            yield Buffer.from('test-content');
          },
        },
      });

      const result = await service.download('test-key.png');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('test-content');
    });

    it('should throw when no data received', async () => {
      mockSend.mockResolvedValueOnce({ Body: null });

      await expect(service.download('test-key.png')).rejects.toThrow(
        'No data received'
      );
    });
  });

  describe('exists', () => {
    it('should return true if file exists', async () => {
      mockSend.mockResolvedValueOnce({
        Body: { async *[Symbol.asyncIterator]() { yield Buffer.from(''); } },
      });

      const exists = await service.exists('test-key.png');

      expect(exists).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const error = new Error('Not found');
      (error as any).name = 'NoSuchKey';
      mockSend.mockRejectedValueOnce(error);

      const exists = await service.exists('nonexistent.png');

      expect(exists).toBe(false);
    });

    it('should throw on other errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Access denied'));

      await expect(service.exists('test-key.png')).rejects.toThrow('Access denied');
    });
  });

  describe('generateScreenshotKey', () => {
    it('should generate valid screenshot key', () => {
      const key = service.generateScreenshotKey('user-123', 'test.png');

      expect(key).toMatch(/^screenshots\/user-123\/\d+-test\.png$/);
    });

    it('should sanitize filename', () => {
      const key = service.generateScreenshotKey('user-123', 'test file (1).png');

      expect(key).not.toContain(' ');
      expect(key).not.toContain('(');
      expect(key).not.toContain(')');
    });
  });

  describe('generatePdfKey', () => {
    it('should generate valid PDF key', () => {
      const key = service.generatePdfKey('user-123', 'document.pdf');

      expect(key).toMatch(/^pdfs\/user-123\/\d+-document\.pdf$/);
    });

    it('should sanitize filename', () => {
      const key = service.generatePdfKey('user-123', 'my document.pdf');

      expect(key).not.toContain(' ');
    });
  });

  describe('uploadFile', () => {
    it('should upload file with automatic key generation for images', async () => {
      mockSend.mockResolvedValueOnce({ ETag: '"mock-etag"' });

      const result = await service.uploadFile(
        Buffer.from('image-data'),
        'test.png',
        'image/png',
        'user-123'
      );

      expect(result.key).toMatch(/^screenshots\/user-123\//);
      expect(result.bucket).toBe('test-bucket');
      expect(result.size).toBe(10);
    });

    it('should upload file with automatic key generation for PDFs', async () => {
      mockSend.mockResolvedValueOnce({ ETag: '"mock-etag"' });

      const result = await service.uploadFile(
        Buffer.from('pdf-data'),
        'document.pdf',
        'application/pdf',
        'user-123'
      );

      expect(result.key).toMatch(/^pdfs\/user-123\//);
    });

    it('should reject unsupported content types', async () => {
      await expect(
        service.uploadFile(
          Buffer.from('file-data'),
          'file.txt',
          'text/plain',
          'user-123'
        )
      ).rejects.toThrow('Invalid content type');
    });
  });

  describe('getBucket', () => {
    it('should return the bucket name', () => {
      expect(service.getBucket()).toBe('test-bucket');
    });
  });
});

describe('createStorageService', () => {
  it('should create a storage service with default config', () => {
    const service = createStorageService();

    expect(service).toBeInstanceOf(StorageService);
  });

  it('should create a storage service with custom config', () => {
    const service = createStorageService({
      bucket: 'custom-bucket',
      endpoint: 'custom-endpoint',
    });

    expect(service).toBeInstanceOf(StorageService);
    expect(service.getBucket()).toBe('custom-bucket');
  });
});
