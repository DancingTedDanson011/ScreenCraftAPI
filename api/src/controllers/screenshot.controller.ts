import { FastifyReply } from 'fastify';
import {
  screenshotRequestSchema,
  type ScreenshotResponse,
} from '../schemas/screenshot.schema';
import {
  ErrorCode,
  type CreateScreenshotRequest,
  type GetScreenshotRequest,
  type ListScreenshotsRequest,
  type DownloadScreenshotRequest,
  type ApiResponse,
} from '../types/api.types';
import { getScreenshotService } from '../services/screenshot/index.js';
import { StorageService } from '../services/storage/storage.service.js';
import { getQueueService } from '../services/queue/queue.service.js';
import { JobPriority } from '../services/queue/queue.config.js';
import {
  screenshotRepository,
  hashUrl,
  extractDomain,
  calculateExpiresAt,
} from '../services/database/screenshot.repository';
import { UsageService } from '../services/billing/usage.service.js';
import { EventType, type Screenshot } from '@prisma/client';

// Initialize services
const screenshotService = getScreenshotService();
const storageService = new StorageService();
const queueService = getQueueService();
const usageService = new UsageService();

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
      // PRIVACY: noStore is not compatible with async processing
      // since async requires a database record for status tracking
      if (validatedData.noStore) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'noStore option cannot be used with async processing. Use synchronous mode (async: false) with noStore.',
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

      // Create database record
      // PRIVACY: headers and cookies are NOT stored in the database.
      // They are passed to the queue job which uses them during capture only.
      const screenshot = await screenshotRepository.create({
        accountId,
        url: validatedData.url,
        format: validatedData.format.toUpperCase() as 'PNG' | 'JPEG' | 'WEBP',
        fullPage: validatedData.fullPage,
        quality: validatedData.quality,
        viewport: validatedData.viewport as any,
        clip: validatedData.clip as any,
        waitOptions: validatedData.waitOptions as any,
        // PRIVACY: headers and cookies intentionally NOT passed to repository
        userAgent: validatedData.userAgent,
        blockResources: validatedData.blockResources as any,
        omitBackground: validatedData.omitBackground,
        encoding: validatedData.encoding,
        metadata: validatedData.metadata as any,
        webhookUrl: validatedData.webhookUrl,
        // Privacy-safe analytics
        urlHash: hashUrl(validatedData.url),
        urlDomain: extractDomain(validatedData.url),
        expiresAt: calculateExpiresAt(),
      });

      // Queue job for async processing via BullMQ
      // Note: validatedData (including headers/cookies) is passed to the queue
      // The worker will use these for capture but they are NOT persisted
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
      // Check if noStore mode is requested
      const noStore = validatedData.noStore;

      if (noStore) {
        // PRIVACY: noStore mode - capture and return directly without any persistence
        // No database record, no storage upload - just capture and stream back
        try {
          // Validate request before processing
          screenshotService.validateRequest(validatedData);

          // Capture screenshot synchronously
          // Note: headers and cookies from validatedData are used here for the capture
          // but are never persisted anywhere
          const result = await screenshotService.captureScreenshot(validatedData);

          // Track usage - still need to deduct credits even for noStore
          const creditCost = validatedData.fullPage ? 2 : 1;
          await usageService.recordUsage({
            accountId,
            eventType: validatedData.fullPage ? EventType.SCREENSHOT_FULLPAGE : EventType.SCREENSHOT,
            credits: creditCost,
            metadata: {
              // PRIVACY: Only store domain, not full URL, for noStore analytics
              urlDomain: extractDomain(validatedData.url),
              format: validatedData.format,
              noStore: true,
            },
          });

          // Return screenshot directly as binary response
          const contentType = screenshotService.getContentType(result.format);
          reply
            .code(200)
            .header('Content-Type', contentType)
            .header('Content-Length', result.fileSize.toString())
            .header('X-Screenshot-Width', result.width.toString())
            .header('X-Screenshot-Height', result.height.toString())
            .header('X-Screenshot-Format', result.format)
            .header('Cache-Control', 'no-store, no-cache, must-revalidate')
            .send(result.buffer);
          return;
        } catch (error) {
          const response: ApiResponse = {
            success: false,
            error: {
              code: ErrorCode.PROCESSING_FAILED,
              message: error instanceof Error ? error.message : 'Failed to capture screenshot',
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
      }

      // Standard synchronous mode with persistence
      // Create database record
      // PRIVACY: headers and cookies are NOT stored in the database
      let screenshot = await screenshotRepository.create({
        accountId,
        url: validatedData.url,
        format: validatedData.format.toUpperCase() as 'PNG' | 'JPEG' | 'WEBP',
        fullPage: validatedData.fullPage,
        quality: validatedData.quality,
        viewport: validatedData.viewport as any,
        clip: validatedData.clip as any,
        waitOptions: validatedData.waitOptions as any,
        // PRIVACY: headers and cookies intentionally NOT passed to repository
        userAgent: validatedData.userAgent,
        blockResources: validatedData.blockResources as any,
        omitBackground: validatedData.omitBackground,
        encoding: validatedData.encoding,
        metadata: validatedData.metadata as any,
        webhookUrl: validatedData.webhookUrl,
        // Privacy-safe analytics
        urlHash: hashUrl(validatedData.url),
        urlDomain: extractDomain(validatedData.url),
        expiresAt: calculateExpiresAt(),
      });

      try {
        // Mark as processing
        screenshot = await screenshotRepository.markAsProcessing(screenshot.id);

        // Validate request before processing
        screenshotService.validateRequest(validatedData);

        // Capture screenshot synchronously
        // Note: headers and cookies from validatedData are used for capture only
        const result = await screenshotService.captureScreenshot(validatedData);

        // Upload to storage
        const storageKey = storageService.generateScreenshotKey(accountId, `${screenshot.id}.${result.format}`);
        const contentType = screenshotService.getContentType(result.format);
        await storageService.upload(storageKey, result.buffer, contentType, {
          screenshotId: screenshot.id,
          // PRIVACY: Only store domain in storage metadata, not full URL
          urlDomain: extractDomain(validatedData.url),
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

        // Track usage - deduct credits
        const creditCost = validatedData.fullPage ? 2 : 1; // SCREENSHOT_FULLPAGE: 2, SCREENSHOT: 1
        await usageService.recordUsage({
          accountId,
          eventType: validatedData.fullPage ? EventType.SCREENSHOT_FULLPAGE : EventType.SCREENSHOT,
          credits: creditCost,
          metadata: {
            screenshotId: screenshot.id,
            // PRIVACY: Only store domain for analytics
            urlDomain: extractDomain(validatedData.url),
            format: validatedData.format,
          },
        });

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
    const { page: pageParam, limit: limitParam, status, sortBy, sortOrder } = request.query;
    // Coerce query params to numbers with defaults
    const page = pageParam ? parseInt(String(pageParam), 10) : 1;
    const limit = limitParam ? parseInt(String(limitParam), 10) : 20;
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
