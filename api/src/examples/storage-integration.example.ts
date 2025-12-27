/**
 * Storage Integration Examples
 *
 * This file demonstrates how to integrate the StorageService
 * with the Screenshot and PDF controllers
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { getStorageService } from '../services/storage/index.js';
import { getScreenshotService } from '../services/screenshot/screenshot.service.js';
import type { ScreenshotRequest } from '../schemas/screenshot.schema.js';

/**
 * Example: Complete screenshot capture and storage flow
 */
export async function captureAndStoreScreenshot(
  request: ScreenshotRequest,
  userId: string = 'anonymous'
): Promise<{
  id: string;
  url: string;
  storageKey: string;
  fileSize: number;
}> {
  const screenshotService = getScreenshotService();
  const storageService = getStorageService();

  // 1. Capture screenshot
  const result = await screenshotService.captureScreenshot(request);

  // 2. Get content type
  const contentType = screenshotService.getContentType(result.format);

  // 3. Generate filename
  const filename = `screenshot-${Date.now()}.${result.format}`;

  // 4. Upload to storage
  const uploadResult = await storageService.uploadFile(
    result.buffer,
    filename,
    contentType,
    userId,
    {
      metadata: {
        url: request.url,
        width: result.width.toString(),
        height: result.height.toString(),
        format: result.format,
      },
      expiresIn: 3600, // 1 hour
    }
  );

  return {
    id: extractIdFromKey(uploadResult.key),
    url: uploadResult.url,
    storageKey: uploadResult.key,
    fileSize: uploadResult.size,
  };
}

/**
 * Example: Download screenshot from storage
 */
export async function downloadScreenshotFromStorage(
  storageKey: string,
  reply: FastifyReply
): Promise<void> {
  const storageService = getStorageService();

  try {
    // Download file from storage
    const { data, contentType } = await storageService.downloadFile(storageKey);

    // Set response headers
    reply.header('Content-Type', contentType);
    reply.header('Content-Length', data.length.toString());
    reply.header('Content-Disposition', `attachment; filename="${extractFilename(storageKey)}"`);
    reply.header('Cache-Control', 'public, max-age=31536000'); // 1 year

    // Send file
    reply.send(data);
  } catch (error) {
    throw new Error(`Failed to download screenshot: ${(error as Error).message}`);
  }
}

/**
 * Example: Delete screenshot from storage
 */
export async function deleteScreenshotFromStorage(storageKey: string): Promise<void> {
  const storageService = getStorageService();

  try {
    await storageService.deleteFile(storageKey);
  } catch (error) {
    throw new Error(`Failed to delete screenshot: ${(error as Error).message}`);
  }
}

/**
 * Example: Get signed URL for screenshot
 */
export async function getScreenshotDownloadUrl(
  storageKey: string,
  expiresIn: number = 3600
): Promise<string> {
  const storageService = getStorageService();

  try {
    return await storageService.getSignedUrl(storageKey, expiresIn);
  } catch (error) {
    throw new Error(`Failed to generate download URL: ${(error as Error).message}`);
  }
}

/**
 * Example: Get file metadata without downloading
 */
export async function getScreenshotMetadata(storageKey: string): Promise<{
  contentType: string;
  size: number;
  lastModified?: Date;
  metadata?: Record<string, string>;
}> {
  const storageService = getStorageService();

  try {
    return await storageService.getFileMetadata(storageKey);
  } catch (error) {
    throw new Error(`Failed to get file metadata: ${(error as Error).message}`);
  }
}

/**
 * Example: Complete controller handler
 * POST /screenshots with automatic storage
 */
export async function createScreenshotHandler(
  request: FastifyRequest<{ Body: ScreenshotRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const screenshotRequest = request.body;

    // Extract user ID from auth context (if available)
    const userId = (request as any).user?.id || 'anonymous';

    // Validate request
    const screenshotService = getScreenshotService();
    screenshotService.validateRequest(screenshotRequest);

    // Capture and store
    const result = await captureAndStoreScreenshot(screenshotRequest, userId);

    // Return response
    reply.code(201).send({
      success: true,
      data: {
        id: result.id,
        url: result.url,
        storageKey: result.storageKey,
        fileSize: result.fileSize,
        format: screenshotRequest.format,
        status: 'completed',
      },
    });
  } catch (error) {
    reply.code(500).send({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to create screenshot',
      },
    });
  }
}

/**
 * Example: Download controller handler
 * GET /screenshots/:key/download
 */
export async function downloadScreenshotHandler(
  request: FastifyRequest<{ Params: { key: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { key } = request.params;
    await downloadScreenshotFromStorage(key, reply);
  } catch (error) {
    reply.code(404).send({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Screenshot not found',
      },
    });
  }
}

// Helper functions

function extractIdFromKey(key: string): string {
  // Extract ID from key like "screenshots/user123/1234567890-screenshot.png"
  const parts = key.split('/');
  const filename = parts[parts.length - 1];
  return filename.split('-')[0];
}

function extractFilename(key: string): string {
  // Extract filename from key
  const parts = key.split('/');
  return parts[parts.length - 1];
}
