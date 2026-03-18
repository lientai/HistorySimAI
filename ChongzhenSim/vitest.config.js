import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['js/**/*.test.js', 'server/*.test.js'],
    exclude: ['**/node_modules/**'],
  },
});
