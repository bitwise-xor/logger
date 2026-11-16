import { defineConfig } from 'vitest/config';

// The unit tests need no SvelteKit: the door client and the cookie rules are plain TypeScript.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // The toolchain container has 1.5 GB.
    maxWorkers: 2,
  },
});
