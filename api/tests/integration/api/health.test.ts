import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, createTestClient } from '../../setup/test-helpers';
import type { FastifyInstance } from 'fastify';

describe('Health API', () => {
  let app: FastifyInstance;
  let client: ReturnType<typeof createTestClient>;

  beforeAll(async () => {
    app = await createTestApp();
    client = createTestClient(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await client.get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
    });

    it('should return correct content type', async () => {
      const response = await client.get('/health');

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should have reasonable uptime value', async () => {
      const response = await client.get('/health').expect(200);

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return valid ISO timestamp', async () => {
      const response = await client.get('/health').expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toString()).not.toBe('Invalid Date');
    });
  });

  describe('GET /nonexistent', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await client.get('/nonexistent').expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    });
  });
});
