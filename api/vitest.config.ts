import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'tests',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/types/**',
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
      },
    },
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Vitest 4.x compatible options
    isolate: true,
    fileParallelism: false,
  },
});
