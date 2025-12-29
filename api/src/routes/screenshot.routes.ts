import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  createScreenshot,
  getScreenshot,
  listScreenshots,
  downloadScreenshot,
  deleteScreenshot,
} from '../controllers/screenshot.controller';

/**
 * Screenshot Routes Plugin
 * Registers all screenshot-related endpoints
 */
export async function screenshotRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
): Promise<void> {
  // Create Screenshot
  fastify.post('/screenshots', createScreenshot);

  // Get Screenshot Status
  fastify.get('/screenshots/:id', getScreenshot);

  // List Screenshots
  fastify.get('/screenshots', listScreenshots);

  // Download Screenshot
  fastify.get('/screenshots/:id/download', downloadScreenshot);

  // Delete Screenshot
  fastify.delete('/screenshots/:id', deleteScreenshot);
}

// Export default for auto-loading
export default screenshotRoutes;
