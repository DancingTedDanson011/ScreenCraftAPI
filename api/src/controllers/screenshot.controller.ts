import { FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import {
  screenshotRequestSchema,
  type ScreenshotRequest,
  type ScreenshotResponse,
  type GetScreenshotParams,
  type ListScreenshotsQuery,
} from '../schemas/screenshot.schema';
import {
  ErrorCode,
  type CreateScreenshotRequest,
  type GetScreenshotRequest,
  type ListScreenshotsRequest,
  type DownloadScreenshotRequest,
  type ApiResponse,
  type HttpStatus,
} from '../types/api.types';
import { getScreenshotService, ScreenshotError } from '../services/screenshot/index.js';
import { StorageService } from '../services/storage/storage.service.js';
import { getQueueService } from '../services/queue/queue.service.js';
import { JobPriority } from '../services/queue/queue.config.js';
import { screenshotRepository } from '../services/database/screenshot.repository';
import type { Screenshot } from '@prisma/client';

// Initialize services
const screenshotService = getScreenshotService();
const storageService = new StorageService();
const queueService = getQueueService();

// Helper to convert Prisma model to API response
function toScreenshotResponse(screenshot: Screenshot): ScreenshotResponse {
  return {
    id: screenshot.id,
    status: screenshot.status.toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed',
    url: screenshot.url,
    format: screenshot.format.toLowerCase() as 'png' | 'jpeg' | 'webp',
    fileSize: screenshot.fileSize ?? undefined,
    downloadUrl: screenshot.downloadUrl ?? undefined,
    error: screenshot.error ?? undefined,
    metadata: screenshot.metadata ? JSON.parse(JSON.stringify(screenshot.metadata)) : undefined,
    createdAt: screenshot.createdAt,
    completedAt: screenshot.completedAt ?? undefined,
  };
}

/**
 * Create Screenshot
 * POST /v1/screenshots
 */
export async function createScreenshot(
  request: CreateScreenshotRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Validate request body
    const validatedData = screenshotRequestSchema.parse(request.body);

    // Get account ID from auth context (set by auth middleware)
    const accountId = request.auth?.accountId;
    if (!accountId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message: 'Authentication required',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };
      reply.code(401).send(response);
      return;
    }

    // Check if async processing is requested
    const isAsync = validatedData.async;

    if (isAsync) {
      // Create database record
      const screenshot = await screenshotRepository.create({
        accountId,
        url: validatedData.url,
        format: validatedData.format.toUpperCase() as 'PNG' | 'JPEG' | 'WEBP',
        fullPage: validatedData.fullPage,
        quality: validatedData.quality,
        viewport: validatedData.viewport as any,
        clip: validatedData.clip as any,
        waitOptions: validatedData.waitOptions as any,
        headers: validatedData.headers as any,
        cookies: validatedData.cookies as any,
        userAgent: validatedData.userAgent,
        blockResources: validatedData.blockResources as any,
        omitBackground: validatedData.omitBackground,
        encoding: validatedData.encoding,
        metadata: validatedData.metadata as any,
        webhookUrl: validatedData.webhookUrl,
      });

      // Queue job for async processing via BullMQ
      try {
        await queueService.addScreenshotJob(
          {
            url: validatedData.url,
            options: validatedData,
            jobId: screenshot.id,
            userId: accountId,
          },
          JobPriority.NORMAL
        );
      } catch (error) {
        console.error(`Failed to queue screenshot job for ${screenshot.id}:`, error);
        await screenshotRepository.markAsFailed(
          screenshot.id,
          error instanceof Error ? error.message : 'Failed to queue job'
        );
      }

      const response: ApiResponse<ScreenshotResponse> = {
        success: true,
        data: toScreenshotResponse(screenshot),
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };

      reply.code(202).send(response);
    } else {
      // Create database record
      let screenshot = await screenshotRepository.create({
        accountId,
        url: validatedData.url,
        format: validatedData.format.toUpperCase() as 'PNG' | 'JPEG' | 'WEBP',
        fullPage: validatedData.fullPage,
        quality: validatedData.quality,
        viewport: validatedData.viewport as any,
        clip: validatedData.clip as any,
        waitOptions: validatedData.waitOptions as any,
        headers: validatedData.headers as any,
        cookies: validatedData.cookies as any,
        userAgent: validatedData.userAgent,
        blockResources: validatedData.blockResources as any,
        omitBackground: validatedData.omitBackground,
        encoding: validatedData.encoding,
        metadata: validatedData.metadata as any,
        webhookUrl: validatedData.webhookUrl,
      });

      try {
        // Mark as processing
        screenshot = await screenshotRepository.markAsProcessing(screenshot.id);

        // Validate request before processing
        screenshotService.validateRequest(validatedData);

        // Capture screenshot synchronously
        const result = await screenshotService.captureScreenshot(validatedData);

        // Upload to storage
        const storageKey = storageService.generateScreenshotKey(accountId, `${screenshot.id}.${result.format}`);
        const contentType = screenshotService.getContentType(result.format);
        await storageService.upload(storageKey, result.buffer, contentType, {
          screenshotId: screenshot.id,
          url: validatedData.url,
          width: result.width.toString(),
          height: result.height.toString(),
        });

        // Generate download URL
        const downloadUrl = `${request.protocol}://${request.hostname}/v1/screenshots/${screenshot.id}/download`;

        // Mark as completed
        screenshot = await screenshotRepository.markAsCompleted(
          screenshot.id,
          downloadUrl,
          storageKey,
          result.fileSize
        );

        const response: ApiResponse<ScreenshotResponse> = {
          success: true,
          data: toScreenshotResponse(screenshot),
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
            version: 'v1',
          },
        };

        reply.code(201).send(response);
      } catch (error) {
        // Mark as failed
        await screenshotRepository.markAsFailed(
          screenshot.id,
          error instanceof Error ? error.message : 'Unknown error'
        );

        throw error;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid request data',
          details: error,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };

      reply.code(400).send(response);
      return;
    }

    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.PROCESSING_FAILED,
        message: error instanceof Error ? error.message : 'Failed to create screenshot',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
        version: 'v1',
      },
    };

    reply.code(500).send(response);
  }
}

/**
 * Get Screenshot Status
 * GET /v1/screenshots/:id
 */
export async function getScreenshot(
  request: GetScreenshotRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params;
    const accountId = request.auth?.accountId;

    if (!accountId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message: 'Authentication required',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };
      reply.code(401).send(response);
      return;
    }

    // BOLA protection: verify ownership before returning data
    const screenshot = await screenshotRepository.findByIdAndAccountId(id, accountId);

    if (!screenshot) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.SCREENSHOT_NOT_FOUND,
          message: `Screenshot with ID ${id} not found`,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };

      reply.code(404).send(response);
      return;
    }

    const response: ApiResponse<ScreenshotResponse> = {
      success: true,
      data: toScreenshotResponse(screenshot),
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
        version: 'v1',
      },
    };

    reply.code(200).send(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
        version: 'v1',
      },
    };

    reply.code(500).send(response);
  }
}

/**
 * List Screenshots
 * GET /v1/screenshots
 */
export async function listScreenshots(
  request: ListScreenshotsRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { page, limit, status, sortBy, sortOrder } = request.query;
    const accountId = request.auth?.accountId;

    if (!accountId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message: 'Authentication required',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };
      reply.code(401).send(response);
      return;
    }

    // Convert status to uppercase for Prisma enum
    const prismaStatus = status ? (status.toUpperCase() as any) : undefined;

    // Fetch from database
    const { data: screenshots, total } = await screenshotRepository.findByAccountId(accountId, {
      page,
      limit,
      status: prismaStatus,
      sortBy,
      sortOrder,
    });

    // Convert to API response format
    const paginatedScreenshots = screenshots.map(toScreenshotResponse);

    const totalPages = Math.ceil(total / limit);

    const response: ApiResponse<ScreenshotResponse[]> = {
      success: true,
      data: paginatedScreenshots,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
        version: 'v1',
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    };

    reply.code(200).send(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
        version: 'v1',
      },
    };

    reply.code(500).send(response);
  }
}

/**
 * Download Screenshot
 * GET /v1/screenshots/:id/download
 */
export async function downloadScreenshot(
  request: DownloadScreenshotRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params;
    const accountId = request.auth?.accountId;

    if (!accountId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message: 'Authentication required',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };
      reply.code(401).send(response);
      return;
    }

    // BOLA protection: verify ownership before allowing download
    const screenshot = await screenshotRepository.findByIdAndAccountId(id, accountId);

    if (!screenshot) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.SCREENSHOT_NOT_FOUND,
          message: `Screenshot with ID ${id} not found`,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };

      reply.code(404).send(response);
      return;
    }

    if (screenshot.status !== 'COMPLETED') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.PROCESSING_FAILED,
          message: `Screenshot is not ready yet. Current status: ${screenshot.status.toLowerCase()}`,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };

      reply.code(400).send(response);
      return;
    }

    // Download file from storage using the storageKey
    if (!screenshot.storageKey) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Screenshot file not found in storage',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };

      reply.code(500).send(response);
      return;
    }

    const fileBuffer = await storageService.download(screenshot.storageKey);

    // Set headers
    const mimeTypes = {
      PNG: 'image/png',
      JPEG: 'image/jpeg',
      WEBP: 'image/webp',
    };

    reply.header('Content-Type', mimeTypes[screenshot.format]);
    reply.header('Content-Disposition', `attachment; filename="screenshot-${id}.${screenshot.format.toLowerCase()}"`);
    reply.header('Content-Length', fileBuffer.length.toString());

    // Send file
    reply.code(200).send(fileBuffer);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
        version: 'v1',
      },
    };

    reply.code(500).send(response);
  }
}

/**
 * Delete Screenshot
 * DELETE /v1/screenshots/:id
 */
export async function deleteScreenshot(
  request: GetScreenshotRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params;
    const accountId = request.auth?.accountId;

    if (!accountId) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message: 'Authentication required',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };
      reply.code(401).send(response);
      return;
    }

    // BOLA protection: verify ownership before deletion
    const screenshot = await screenshotRepository.findByIdAndAccountId(id, accountId);

    if (!screenshot) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.SCREENSHOT_NOT_FOUND,
          message: `Screenshot with ID ${id} not found`,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };

      reply.code(404).send(response);
      return;
    }

    // Delete from storage if completed and has storageKey
    if (screenshot.status === 'COMPLETED' && screenshot.storageKey) {
      try {
        await storageService.delete(screenshot.storageKey);
      } catch (error) {
        console.error(`Failed to delete screenshot file from storage: ${error}`);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete from database with ownership verification
    await screenshotRepository.deleteByIdAndAccountId(id, accountId);

    reply.code(204).send();
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
        version: 'v1',
      },
    };

    reply.code(500).send(response);
  }
}
