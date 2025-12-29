import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  createPdf,
  getPdf,
  listPdfs,
  downloadPdf,
  deletePdf,
} from '../controllers/pdf.controller';

/**
 * PDF Routes Plugin
 * Registers all PDF-related endpoints
 */
export async function pdfRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
): Promise<void> {
  // Create PDF
  fastify.post('/pdfs', createPdf);

  // Get PDF Status
  fastify.get('/pdfs/:id', getPdf);

  // List PDFs
  fastify.get('/pdfs', listPdfs);

  // Download PDF
  fastify.get('/pdfs/:id/download', downloadPdf);

  // Delete PDF
  fastify.delete('/pdfs/:id', deletePdf);
}

// Export default for auto-loading
export default pdfRoutes;
