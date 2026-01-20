import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // Increase timeout for Windows CI
    exclude: [
      'node_modules/**',
      'guide/**/*.spec.*'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '*.config.ts',
        'bin/',
        'examples/'
      ]
    }
  }
});
