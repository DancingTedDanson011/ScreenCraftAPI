// Raw Body Middleware for Stripe Webhook Signature Verification

import { FastifyRequest, FastifyReply } from 'fastify';
import { IncomingMessage } from 'http';

/**
 * Add raw body buffer to request for webhook signature verification
 * This is needed for Stripe webhooks which require the raw body to verify signatures
 */
export async function rawBodyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Only apply to webhook endpoints
  if (!request.url.includes('/webhooks/')) {
    return;
  }

  // Collect raw body chunks
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    const req = request.raw as IncomingMessage;

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      const rawBody = Buffer.concat(chunks);
      (request as any).rawBody = rawBody;
      resolve();
    });

    req.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Plugin to add raw body parsing to Fastify
 */
export async function registerRawBodyParser(fastify: any): Promise<void> {
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    async (req: any, body: Buffer) => {
      // Store raw body for webhook verification
      req.rawBody = body;

      try {
        // Parse JSON from buffer
        return JSON.parse(body.toString('utf-8'));
      } catch (error) {
        throw new Error('Invalid JSON');
      }
    }
  );
}
