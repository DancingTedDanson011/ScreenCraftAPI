import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  createPdf,
  getPdf,
  listPdfs,
  downloadPdf,
  deletePdf,
} from '../controllers/pdf.controller';
import {
  pdfRequestSchema,
  getPdfParamsSchema,
  listPdfsQuerySchema,
} from '../schemas/pdf.schema';

/**
 * PDF Routes Plugin
 * Registers all PDF-related endpoints
 */
export async function pdfRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
): Promise<void> {
  // Create PDF
  fastify.post(
    '/pdfs',
    {
      schema: {
        description: 'Generate a PDF from URL or HTML',
        tags: ['pdfs'],
        body: pdfRequestSchema,
        response: {
          201: {
            description: 'PDF created successfully (sync)',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' },
            },
          },
          202: {
            description: 'PDF queued for processing (async)',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' },
            },
          },
          400: {
            description: 'Bad request - validation error',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'object' },
            },
          },
          429: {
            description: 'Rate limit exceeded',
            type: 'object',
          },
          500: {
            description: 'Internal server error',
            type: 'object',
          },
        },
      },
    },
    createPdf
  );

  // Get PDF Status
  fastify.get(
    '/pdfs/:id',
    {
      schema: {
        description: 'Get PDF status and metadata',
        tags: ['pdfs'],
        params: getPdfParamsSchema,
        response: {
          200: {
            description: 'PDF found',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' },
            },
          },
          404: {
            description: 'PDF not found',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'object' },
            },
          },
        },
      },
    },
    getPdf
  );

  // List PDFs
  fastify.get(
    '/pdfs',
    {
      schema: {
        description: 'List all PDFs with pagination and filtering',
        tags: ['pdfs'],
        querystring: listPdfsQuerySchema,
        response: {
          200: {
            description: 'List of PDFs',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    listPdfs
  );

  // Download PDF
  fastify.get(
    '/pdfs/:id/download',
    {
      schema: {
        description: 'Download PDF file',
        tags: ['pdfs'],
        params: getPdfParamsSchema,
        response: {
          200: {
            description: 'PDF file',
            type: 'string',
            format: 'binary',
          },
          404: {
            description: 'PDF not found',
            type: 'object',
          },
          400: {
            description: 'PDF not ready',
            type: 'object',
          },
        },
      },
    },
    downloadPdf
  );

  // Delete PDF
  fastify.delete(
    '/pdfs/:id',
    {
      schema: {
        description: 'Delete a PDF',
        tags: ['pdfs'],
        params: getPdfParamsSchema,
        response: {
          204: {
            description: 'PDF deleted successfully',
            type: 'null',
          },
          404: {
            description: 'PDF not found',
            type: 'object',
          },
        },
      },
    },
    deletePdf
  );
}

// Export default for auto-loading
export default pdfRoutes;
