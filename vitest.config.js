import { defineConfig } from 'vitest/config';

// Separate from vite.config.js on purpose: the math core tests need neither
// the React plugin nor a DOM environment.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
