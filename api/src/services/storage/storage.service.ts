import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  type StorageConfig,
  getStorageConfig,
  STORAGE_CONSTANTS,
  validateFileSize,
  validateMimeType,
} from '../../config/storage.config';

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
}

export interface DownloadResult {
  data: Buffer;
  contentType: string;
  size: number;
}

export class StorageService {
  private s3: S3Client;
  private bucket: string;

  constructor(config?: Partial<StorageConfig>) {
    const endpoint = config?.endpoint || process.env.MINIO_ENDPOINT || 'localhost';
    const port = config?.port || parseInt(process.env.MINIO_PORT || '9000', 10);
    const useSSL = config?.useSSL ?? (process.env.MINIO_USE_SSL === 'true');
    const protocol = useSSL ? 'https' : 'http';

    this.bucket = config?.bucket || process.env.MINIO_BUCKET || 'screenshots';

    this.s3 = new S3Client({
      endpoint: `${protocol}://${endpoint}:${port}`,
      region: config?.region || process.env.AWS_REGION || 'eu-central-1',
      credentials: {
        accessKeyId: config?.accessKeyId || process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretAccessKey: config?.secretAccessKey || process.env.MINIO_SECRET_KEY || 'minioadmin',
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  /**
   * Initialize storage by ensuring bucket exists
   */
  async initialize(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      if ((error as any).name === 'NotFound') {
        // Bucket doesn't exist, create it
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        console.log(`Created bucket: ${this.bucket}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Upload a file to S3/MinIO storage
   * @param key - The file key/path in the bucket
   * @param data - The file data as Buffer
   * @param contentType - MIME type of the file
   * @param metadata - Optional metadata to attach to the file
   * @returns The object key
   */
  async upload(
    key: string,
    data: Buffer,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      Metadata: metadata,
    };

    try {
      await this.s3.send(new PutObjectCommand(params));
      return key;
    } catch (error) {
      throw new Error(`Failed to upload file: ${(error as Error).message}`);
    }
  }

  /**
   * Get a signed URL for accessing a file
   * @param key - The file key/path in the bucket
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns Signed URL for accessing the file
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.s3, command, { expiresIn });
      return url;
    } catch (error) {
      throw new Error(`Failed to generate signed URL: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a file from storage
   * @param key - The file key/path in the bucket
   */
  async delete(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
    } catch (error) {
      throw new Error(`Failed to delete file: ${(error as Error).message}`);
    }
  }

  /**
   * Download a file from storage
   * @param key - The file key/path in the bucket
   * @returns The file data as Buffer
   */
  async download(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3.send(command);

      if (!response.Body) {
        throw new Error('No data received from storage');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      throw new Error(`Failed to download file: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a file exists in storage
   * @param key - The file key/path in the bucket
   * @returns true if file exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return true;
    } catch (error) {
      if ((error as any).name === 'NoSuchKey') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generate a unique storage key for screenshots
   * @param userId - User ID
   * @param filename - Original filename or identifier
   * @returns Unique storage key
   */
  generateScreenshotKey(userId: string, filename: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `screenshots/${userId}/${timestamp}-${sanitizedFilename}`;
  }

  /**
   * Generate a unique storage key for PDFs
   * @param userId - User ID
   * @param filename - Original filename or identifier
   * @returns Unique storage key
   */
  generatePdfKey(userId: string, filename: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `pdfs/${userId}/${timestamp}-${sanitizedFilename}`;
  }

  /**
   * High-level upload file method with validation
   * @param buffer - File data as Buffer
   * @param filename - Original filename
   * @param contentType - MIME type
   * @param userId - User ID for path organization
   * @param options - Additional upload options
   * @returns Upload result with URL and metadata
   */
  async uploadFile(
    buffer: Buffer,
    filename: string,
    contentType: string,
    userId: string = 'system',
    options?: {
      metadata?: Record<string, string>;
      validateSize?: boolean;
      validateType?: boolean;
      expiresIn?: number;
    }
  ): Promise<UploadResult> {
    try {
      // Validation
      if (options?.validateSize !== false) {
        validateFileSize(buffer.length);
      }

      if (options?.validateType !== false) {
        const allowedTypes = [
          ...STORAGE_CONSTANTS.ALLOWED_MIME_TYPES.images,
          ...STORAGE_CONSTANTS.ALLOWED_MIME_TYPES.pdf,
        ];
        validateMimeType(contentType, allowedTypes);
      }

      // Determine storage path based on content type
      let key: string;
      if (contentType.startsWith('image/')) {
        key = this.generateScreenshotKey(userId, filename);
      } else if (contentType === 'application/pdf') {
        key = this.generatePdfKey(userId, filename);
      } else {
        // Generic path
        const timestamp = Date.now();
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        key = `files/${userId}/${timestamp}-${sanitizedFilename}`;
      }

      // Upload to storage
      await this.upload(key, buffer, contentType, options?.metadata);

      // Generate signed URL
      const url = await this.getSignedUrl(key, options?.expiresIn);

      return {
        key,
        url,
        bucket: this.bucket,
        size: buffer.length,
      };
    } catch (error) {
      throw new Error(`Failed to upload file: ${(error as Error).message}`);
    }
  }

  /**
   * High-level download file method
   * @param key - The file key/path in the bucket
   * @returns Download result with data and metadata
   */
  async downloadFile(key: string): Promise<DownloadResult> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3.send(command);

      if (!response.Body) {
        throw new Error('No data received from storage');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      const data = Buffer.concat(chunks);

      return {
        data,
        contentType: response.ContentType || 'application/octet-stream',
        size: response.ContentLength || data.length,
      };
    } catch (error) {
      throw new Error(`Failed to download file: ${(error as Error).message}`);
    }
  }

  /**
   * High-level delete file method
   * @param key - The file key/path in the bucket
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.delete(key);
    } catch (error) {
      throw new Error(`Failed to delete file: ${(error as Error).message}`);
    }
  }

  /**
   * Get file metadata without downloading
   * @param key - The file key/path in the bucket
   * @returns File metadata
   */
  async getFileMetadata(key: string): Promise<{
    contentType: string;
    size: number;
    lastModified?: Date;
    metadata?: Record<string, string>;
  }> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3.send(command);

      return {
        contentType: response.ContentType || 'application/octet-stream',
        size: response.ContentLength || 0,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error) {
      throw new Error(`Failed to get file metadata: ${(error as Error).message}`);
    }
  }

  /**
   * Get bucket name
   */
  getBucket(): string {
    return this.bucket;
  }
}

/**
 * Create a default storage service instance
 */
export function createStorageService(config?: Partial<StorageConfig>): StorageService {
  const defaultConfig = getStorageConfig();
  return new StorageService({ ...defaultConfig, ...config });
}
