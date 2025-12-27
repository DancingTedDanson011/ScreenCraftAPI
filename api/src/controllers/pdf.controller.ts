import { FastifyReply } from 'fastify';
import {
  pdfRequestSchema,
  type PdfResponse,
} from '../schemas/pdf.schema.js';
import type {
  CreatePdfRequest,
  GetPdfRequest,
  ListPdfsRequest,
  DownloadPdfRequest,
  ApiResponse,
} from '../types/api.types.js';
import { ErrorCode } from '../types/api.types.js';
import { getPdfService } from '../services/pdf/index.js';
import { getQueueService } from '../services/queue/queue.service.js';
import { JobPriority } from '../services/queue/queue.config.js';
import { pdfRepository } from '../services/database/pdf.repository';
import { StorageService } from '../services/storage/storage.service.js';
import type { Pdf } from '@prisma/client';

// Get service instances
const pdfService = getPdfService();
const queueService = getQueueService();
const storageService = new StorageService();

// Helper to convert Prisma model to API response
function toPdfResponse(pdf: Pdf): PdfResponse {
  return {
    id: pdf.id,
    status: pdf.status.toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed',
    type: pdf.type.toLowerCase() as 'url' | 'html',
    format: pdf.format,
    fileSize: pdf.fileSize ?? undefined,
    pages: pdf.pages ?? undefined,
    downloadUrl: pdf.downloadUrl ?? undefined,
    error: pdf.error ?? undefined,
    metadata: pdf.metadata ? JSON.parse(JSON.stringify(pdf.metadata)) : undefined,
    createdAt: pdf.createdAt,
    completedAt: pdf.completedAt ?? undefined,
  };
}

/**
 * Create PDF
 * POST /v1/pdfs
 */
export async function createPdf(
  request: CreatePdfRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Validate request body
    const validatedData = pdfRequestSchema.parse(request.body);

    // Get account ID from auth context (set by auth middleware)
    const accountId = request.auth?.accountId || 'default'; // TODO: Remove fallback when auth is required

    // Check if async processing is requested
    const isAsync = validatedData.async;

    if (isAsync) {
      // Create database record
      const pdf = await pdfRepository.create({
        accountId,
        type: validatedData.type.toUpperCase() as 'URL' | 'HTML',
        url: validatedData.type === 'url' ? validatedData.url : undefined,
        html: validatedData.type === 'html' ? validatedData.html : undefined,
        format: validatedData.format.toUpperCase() as any,
        landscape: validatedData.landscape,
        printBackground: validatedData.printBackground,
        margin: validatedData.margin as any,
        displayHeaderFooter: validatedData.displayHeaderFooter,
        headerTemplate: validatedData.headerTemplate,
        footerTemplate: validatedData.footerTemplate,
        pageRanges: validatedData.pageRanges,
        preferCSSPageSize: validatedData.preferCSSPageSize,
        width: validatedData.width,
        height: validatedData.height,
        scale: validatedData.scale,
        waitOptions: validatedData.type === 'url' ? (validatedData.waitOptions as any) : undefined,
        headers: validatedData.type === 'url' ? (validatedData.headers as any) : undefined,
        cookies: validatedData.type === 'url' ? (validatedData.cookies as any) : undefined,
        userAgent: validatedData.type === 'url' ? validatedData.userAgent : undefined,
        metadata: validatedData.metadata as any,
        webhookUrl: validatedData.webhookUrl,
      });

      // Queue job for async processing via BullMQ
      try {
        const url = validatedData.type === 'url' ? validatedData.url : undefined;

        await queueService.addPdfJob(
          {
            url: url || '',
            options: validatedData,
            jobId: pdf.id,
            userId: accountId,
          },
          JobPriority.NORMAL
        );
      } catch (error) {
        console.error(`Failed to queue PDF job for ${pdf.id}:`, error);
        await pdfRepository.markAsFailed(
          pdf.id,
          error instanceof Error ? error.message : 'Failed to queue job'
        );
      }

      const response: ApiResponse<PdfResponse> = {
        success: true,
        data: toPdfResponse(pdf),
        meta: {
          timestamp: new Date().toISOString(),
          requestId: request.id,
          version: 'v1',
        },
      };

      reply.code(202).send(response);
    } else {
      // Create database record
      let pdf = await pdfRepository.create({
        accountId,
        type: validatedData.type.toUpperCase() as 'URL' | 'HTML',
        url: validatedData.type === 'url' ? validatedData.url : undefined,
        html: validatedData.type === 'html' ? validatedData.html : undefined,
        format: validatedData.format.toUpperCase() as any,
        landscape: validatedData.landscape,
        printBackground: validatedData.printBackground,
        margin: validatedData.margin as any,
        displayHeaderFooter: validatedData.displayHeaderFooter,
        headerTemplate: validatedData.headerTemplate,
        footerTemplate: validatedData.footerTemplate,
        pageRanges: validatedData.pageRanges,
        preferCSSPageSize: validatedData.preferCSSPageSize,
        width: validatedData.width,
        height: validatedData.height,
        scale: validatedData.scale,
        waitOptions: validatedData.type === 'url' ? (validatedData.waitOptions as any) : undefined,
        headers: validatedData.type === 'url' ? (validatedData.headers as any) : undefined,
        cookies: validatedData.type === 'url' ? (validatedData.cookies as any) : undefined,
        userAgent: validatedData.type === 'url' ? validatedData.userAgent : undefined,
        metadata: validatedData.metadata as any,
        webhookUrl: validatedData.webhookUrl,
      });

      try {
        // Mark as processing
        pdf = await pdfRepository.markAsProcessing(pdf.id);

        // Generate PDF synchronously
        const result = await pdfService.generatePdf(validatedData);

        // Upload to storage
        const storageKey = storageService.generatePdfKey(accountId, `${pdf.id}.pdf`);
        await storageService.upload(storageKey, result.buffer, 'application/pdf', {
          pdfId: pdf.id,
          type: validatedData.type,
          pages: result.pages.toString(),
        });

        // Generate download URL
        const downloadUrl = `${request.protocol}://${request.hostname}/v1/pdfs/${pdf.id}/download`;

        // Mark as completed
        pdf = await pdfRepository.markAsCompleted(
          pdf.id,
          downloadUrl,
          storageKey,
          result.fileSize,
          result.pages
        );

        const response: ApiResponse<PdfResponse> = {
          success: true,
          data: toPdfResponse(pdf),
          meta: {
            timestamp: new Date().toISOString(),
            requestId: request.id,
            version: 'v1',
          },
        };

        reply.code(201).send(response);
      } catch (error) {
        // Mark as failed
        await pdfRepository.markAsFailed(
          pdf.id,
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
        message: error instanceof Error ? error.message : 'Failed to create PDF',
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
 * Get PDF Status
 * GET /v1/pdfs/:id
 */
export async function getPdf(
  request: GetPdfRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params;

    const pdf = await pdfRepository.findById(id);

    if (!pdf) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.PDF_NOT_FOUND,
          message: `PDF with ID ${id} not found`,
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

    const response: ApiResponse<PdfResponse> = {
      success: true,
      data: toPdfResponse(pdf),
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
 * List PDFs
 * GET /v1/pdfs
 */
export async function listPdfs(
  request: ListPdfsRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { page, limit, status, type, sortBy, sortOrder } = request.query;
    const accountId = request.auth?.accountId || 'default';

    // Convert status and type to uppercase for Prisma enums
    const prismaStatus = status ? (status.toUpperCase() as any) : undefined;
    const prismaType = type ? (type.toUpperCase() as any) : undefined;

    // Fetch from database
    const { data: pdfs, total } = await pdfRepository.findByAccountId(accountId, {
      page,
      limit,
      status: prismaStatus,
      type: prismaType,
      sortBy,
      sortOrder,
    });

    // Convert to API response format
    const paginatedPdfs = pdfs.map(toPdfResponse);

    const totalPages = Math.ceil(total / limit);

    const response: ApiResponse<PdfResponse[]> = {
      success: true,
      data: paginatedPdfs,
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
 * Download PDF
 * GET /v1/pdfs/:id/download
 */
export async function downloadPdf(
  request: DownloadPdfRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params;

    const pdf = await pdfRepository.findById(id);

    if (!pdf) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.PDF_NOT_FOUND,
          message: `PDF with ID ${id} not found`,
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

    if (pdf.status !== 'COMPLETED') {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.PROCESSING_FAILED,
          message: `PDF is not ready yet. Current status: ${pdf.status.toLowerCase()}`,
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
    if (!pdf.storageKey) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'PDF file not found in storage',
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

    const fileBuffer = await storageService.download(pdf.storageKey);

    // Set headers
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="document-${id}.pdf"`);
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
 * Delete PDF
 * DELETE /v1/pdfs/:id
 */
export async function deletePdf(
  request: GetPdfRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params;

    const pdf = await pdfRepository.findById(id);

    if (!pdf) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: ErrorCode.PDF_NOT_FOUND,
          message: `PDF with ID ${id} not found`,
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
    if (pdf.status === 'COMPLETED' && pdf.storageKey) {
      try {
        await storageService.delete(pdf.storageKey);
      } catch (error) {
        console.error(`Failed to delete PDF file from storage: ${error}`);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete from database
    await pdfRepository.delete(id);

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
