import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screenshotFixtures, screenshotResultFixtures } from '../../fixtures/screenshot.fixtures';
import { createMockBrowserPool, createMockPage } from '../../mocks/playwright.mock';

// Mock the browser pool before importing the service
const mockBrowserPool = createMockBrowserPool();
vi.mock('../../../src/services/browser-pool/index.js', () => ({
  getBrowserPool: vi.fn(() => mockBrowserPool),
}));

// Import the service after mocking
const { ScreenshotService, ScreenshotError, NavigationError, CaptureError } = await import(
  '../../../src/services/screenshot/screenshot.service.js'
);

describe('ScreenshotService', () => {
  let service: InstanceType<typeof ScreenshotService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ScreenshotService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('captureScreenshot', () => {
    it('should capture screenshot with minimal options', async () => {
      const request = screenshotFixtures.validMinimal();
      const mockPage = mockBrowserPool._mockPage;

      mockPage.screenshot.mockResolvedValue(Buffer.from('test-image'));
      mockPage.viewportSize.mockReturnValue({ width: 1920, height: 1080 });

      const result = await service.captureScreenshot({
        ...request,
        format: 'png',
      });

      expect(result).toBeDefined();
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.format).toBe('png');
      expect(mockPage.goto).toHaveBeenCalledWith(
        request.url,
        expect.objectContaining({
          waitUntil: 'load',
        })
      );
    });

    it('should capture screenshot with full options', async () => {
      const request = screenshotFixtures.validFull();
      const mockPage = mockBrowserPool._mockPage;

      mockPage.screenshot.mockResolvedValue(Buffer.from('test-image'));
      mockPage.viewportSize.mockReturnValue({ width: 1920, height: 1080 });

      const result = await service.captureScreenshot(request);

      expect(result).toBeDefined();
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith(request.headers);
      expect(mockBrowserPool.releaseContext).toHaveBeenCalled();
    });

    it('should capture full page screenshot', async () => {
      const request = screenshotFixtures.fullPage();
      const mockPage = mockBrowserPool._mockPage;

      mockPage.screenshot.mockResolvedValue(Buffer.from('full-page-image'));
      mockPage.viewportSize.mockReturnValue({ width: 1440, height: 900 });

      const result = await service.captureScreenshot(request);

      expect(result).toBeDefined();
      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          fullPage: true,
        })
      );
    });

    it('should capture mobile viewport screenshot', async () => {
      const request = screenshotFixtures.mobile();
      const mockPage = mockBrowserPool._mockPage;

      mockPage.screenshot.mockResolvedValue(Buffer.from('mobile-image'));
      mockPage.viewportSize.mockReturnValue({ width: 375, height: 812 });

      const result = await service.captureScreenshot(request);

      expect(result).toBeDefined();
      expect(mockBrowserPool.acquirePage).toHaveBeenCalledWith(
        expect.objectContaining({
          viewport: expect.objectContaining({
            width: 375,
            height: 812,
          }),
        })
      );
    });

    it('should capture JPEG with quality setting', async () => {
      const request = screenshotFixtures.jpeg();
      const mockPage = mockBrowserPool._mockPage;

      mockPage.screenshot.mockResolvedValue(Buffer.from('jpeg-image'));
      mockPage.viewportSize.mockReturnValue({ width: 1280, height: 720 });

      const result = await service.captureScreenshot(request);

      expect(result).toBeDefined();
      expect(result.format).toBe('jpeg');
      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'jpeg',
          quality: 75,
        })
      );
    });

    it('should capture screenshot with transparent background', async () => {
      const request = screenshotFixtures.transparent();
      const mockPage = mockBrowserPool._mockPage;

      mockPage.screenshot.mockResolvedValue(Buffer.from('transparent-image'));
      mockPage.viewportSize.mockReturnValue({ width: 800, height: 600 });

      const result = await service.captureScreenshot(request);

      expect(result).toBeDefined();
      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          omitBackground: true,
        })
      );
    });

    it('should wait for selector before capturing', async () => {
      const request = screenshotFixtures.waitForSelector();
      const mockPage = mockBrowserPool._mockPage;

      mockPage.screenshot.mockResolvedValue(Buffer.from('selector-image'));
      mockPage.viewportSize.mockReturnValue({ width: 1920, height: 1080 });

      await service.captureScreenshot(request);

      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        '#main-content',
        expect.objectContaining({ timeout: 30000 })
      );
    });

    it('should release context even on error', async () => {
      const request = screenshotFixtures.validMinimal();
      const mockPage = mockBrowserPool._mockPage;

      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      await expect(
        service.captureScreenshot({ ...request, format: 'png' })
      ).rejects.toThrow();

      expect(mockBrowserPool.releaseContext).toHaveBeenCalled();
    });

    it('should throw NavigationError on navigation failure', async () => {
      const request = screenshotFixtures.validMinimal();
      const mockPage = mockBrowserPool._mockPage;

      mockPage.goto.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));

      await expect(
        service.captureScreenshot({ ...request, format: 'png' })
      ).rejects.toThrow(NavigationError);
    });

    it('should throw CaptureError on screenshot failure', async () => {
      const request = screenshotFixtures.validMinimal();
      const mockPage = mockBrowserPool._mockPage;

      // Reset goto to succeed, but screenshot to fail
      mockPage.goto.mockResolvedValue(undefined);
      mockPage.screenshot.mockRejectedValue(new Error('Screenshot failed'));

      await expect(
        service.captureScreenshot({ ...request, format: 'png' })
      ).rejects.toThrow(CaptureError);
    });
  });

  describe('validateRequest', () => {
    it('should pass validation for valid minimal request', () => {
      const request = {
        ...screenshotFixtures.validMinimal(),
        format: 'png' as const,
      };

      expect(() => service.validateRequest(request)).not.toThrow();
    });

    it('should throw error for invalid URL', () => {
      const request = {
        url: 'not-a-valid-url',
        format: 'png' as const,
      };

      expect(() => service.validateRequest(request)).toThrow(ScreenshotError);
      expect(() => service.validateRequest(request)).toThrow('Invalid URL');
    });

    it('should throw error for quality with PNG format', () => {
      const request = {
        url: 'https://example.com',
        format: 'png' as const,
        quality: 80,
      };

      expect(() => service.validateRequest(request)).toThrow(ScreenshotError);
      expect(() => service.validateRequest(request)).toThrow('Quality option');
    });

    it('should throw error for invalid clip dimensions', () => {
      const request = {
        url: 'https://example.com',
        format: 'png' as const,
        clip: { x: 0, y: 0, width: 0, height: 100 },
      };

      expect(() => service.validateRequest(request)).toThrow(ScreenshotError);
      expect(() => service.validateRequest(request)).toThrow('Clip dimensions');
    });

    it('should throw error for viewport too small', () => {
      const request = {
        url: 'https://example.com',
        format: 'png' as const,
        viewport: { width: 100, height: 100 },
      };

      expect(() => service.validateRequest(request)).toThrow(ScreenshotError);
      expect(() => service.validateRequest(request)).toThrow('Viewport dimensions');
    });
  });

  describe('getContentType', () => {
    it('should return correct content type for PNG', () => {
      expect(service.getContentType('png')).toBe('image/png');
    });

    it('should return correct content type for JPEG', () => {
      expect(service.getContentType('jpeg')).toBe('image/jpeg');
    });

    it('should return correct content type for WebP', () => {
      expect(service.getContentType('webp')).toBe('image/webp');
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status when browser pool is healthy', async () => {
      mockBrowserPool.checkHealth.mockResolvedValue({
        healthy: true,
        issues: [],
        stats: { totalBrowsers: 1, activeContexts: 0 },
      });

      const result = await service.checkHealth();

      expect(result.healthy).toBe(true);
      expect(result.message).toBe('Screenshot service operational');
    });

    it('should return unhealthy status when browser pool has issues', async () => {
      mockBrowserPool.checkHealth.mockResolvedValue({
        healthy: false,
        issues: ['Browser crashed', 'Memory limit exceeded'],
        stats: { totalBrowsers: 0, activeContexts: 0 },
      });

      const result = await service.checkHealth();

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Browser crashed');
    });

    it('should handle health check errors', async () => {
      mockBrowserPool.checkHealth.mockRejectedValue(new Error('Health check failed'));

      const result = await service.checkHealth();

      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Health check failed');
    });
  });
});
