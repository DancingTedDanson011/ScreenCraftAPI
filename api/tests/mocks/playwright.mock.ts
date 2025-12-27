import { vi } from 'vitest';

/**
 * Mock Playwright Page object
 */
export const createMockPage = () => ({
  goto: vi.fn().mockResolvedValue(undefined),
  screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
  pdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-data')),
  setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
  waitForSelector: vi.fn().mockResolvedValue(undefined),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  waitForLoadState: vi.fn().mockResolvedValue(undefined),
  waitForNavigation: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
  setViewportSize: vi.fn().mockResolvedValue(undefined),
  context: vi.fn().mockReturnValue({
    addCookies: vi.fn().mockResolvedValue(undefined),
    clearCookies: vi.fn().mockResolvedValue(undefined),
    cookies: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
  }),
  route: vi.fn().mockResolvedValue(undefined),
  unroute: vi.fn().mockResolvedValue(undefined),
  evaluate: vi.fn().mockResolvedValue(undefined),
  evaluateHandle: vi.fn().mockResolvedValue(undefined),
  content: vi.fn().mockResolvedValue('<html><body></body></html>'),
  title: vi.fn().mockResolvedValue('Test Page'),
  url: vi.fn().mockReturnValue('https://example.com'),
  isClosed: vi.fn().mockReturnValue(false),
  emulateMedia: vi.fn().mockResolvedValue(undefined),
  addScriptTag: vi.fn().mockResolvedValue(undefined),
  addStyleTag: vi.fn().mockResolvedValue(undefined),
  $: vi.fn().mockResolvedValue(null),
  $$: vi.fn().mockResolvedValue([]),
  $eval: vi.fn().mockResolvedValue(undefined),
  $$eval: vi.fn().mockResolvedValue([]),
});

/**
 * Mock Playwright Browser Context
 */
export const createMockContext = () => ({
  newPage: vi.fn().mockImplementation(() => Promise.resolve(createMockPage())),
  close: vi.fn().mockResolvedValue(undefined),
  pages: vi.fn().mockReturnValue([]),
  addCookies: vi.fn().mockResolvedValue(undefined),
  clearCookies: vi.fn().mockResolvedValue(undefined),
  cookies: vi.fn().mockResolvedValue([]),
  setDefaultNavigationTimeout: vi.fn(),
  setDefaultTimeout: vi.fn(),
  setGeolocation: vi.fn().mockResolvedValue(undefined),
  clearPermissions: vi.fn().mockResolvedValue(undefined),
  grantPermissions: vi.fn().mockResolvedValue(undefined),
  route: vi.fn().mockResolvedValue(undefined),
  unroute: vi.fn().mockResolvedValue(undefined),
  storageState: vi.fn().mockResolvedValue({ cookies: [], origins: [] }),
  browser: vi.fn().mockReturnValue(null),
});

/**
 * Mock Playwright Browser
 */
export const createMockBrowser = () => ({
  newContext: vi.fn().mockImplementation(() => Promise.resolve(createMockContext())),
  newPage: vi.fn().mockImplementation(() => Promise.resolve(createMockPage())),
  close: vi.fn().mockResolvedValue(undefined),
  isConnected: vi.fn().mockReturnValue(true),
  contexts: vi.fn().mockReturnValue([]),
  version: vi.fn().mockReturnValue('1.49.1'),
  browserType: vi.fn().mockReturnValue({ name: vi.fn().mockReturnValue('chromium') }),
});

/**
 * Mock Browser Pool Service
 */
export const createMockBrowserPool = () => {
  const mockPage = createMockPage();
  const mockContext = createMockContext();

  return {
    acquirePage: vi.fn().mockResolvedValue({
      page: mockPage,
      contextId: 'test-context-id',
    }),
    acquireContext: vi.fn().mockResolvedValue({
      context: mockContext,
      contextId: 'test-context-id',
    }),
    releaseContext: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({
      totalBrowsers: 1,
      activeContexts: 0,
      availableContexts: 1,
      queueLength: 0,
      poolUtilization: 0,
    }),
    checkHealth: vi.fn().mockResolvedValue({
      healthy: true,
      issues: [],
      stats: {
        totalBrowsers: 1,
        activeContexts: 0,
        availableContexts: 1,
        queueLength: 0,
        poolUtilization: 0,
      },
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    _mockPage: mockPage,
    _mockContext: mockContext,
  };
};

/**
 * Mock Playwright chromium launcher
 */
export const mockPlaywright = {
  chromium: {
    launch: vi.fn().mockImplementation(() => Promise.resolve(createMockBrowser())),
    connect: vi.fn().mockImplementation(() => Promise.resolve(createMockBrowser())),
    connectOverCDP: vi.fn().mockImplementation(() => Promise.resolve(createMockBrowser())),
    executablePath: vi.fn().mockReturnValue('/usr/bin/chromium'),
    name: vi.fn().mockReturnValue('chromium'),
  },
  firefox: {
    launch: vi.fn().mockImplementation(() => Promise.resolve(createMockBrowser())),
    name: vi.fn().mockReturnValue('firefox'),
  },
  webkit: {
    launch: vi.fn().mockImplementation(() => Promise.resolve(createMockBrowser())),
    name: vi.fn().mockReturnValue('webkit'),
  },
  devices: {},
};

/**
 * Setup Playwright mock - call this in beforeEach
 */
export function setupPlaywrightMock() {
  vi.mock('playwright', () => mockPlaywright);
  vi.mock('playwright-core', () => mockPlaywright);

  return mockPlaywright;
}

/**
 * Reset all Playwright mocks
 */
export function resetPlaywrightMocks() {
  vi.clearAllMocks();
}
