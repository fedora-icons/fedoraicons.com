/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
  // Large data (the catalog) ships as JSON.parse('…'), which browsers parse faster than object literals.
  json: { stringify: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Page tests render the full grid (1,000+ cells) in jsdom; CI runners are slower than 5s for some.
    testTimeout: 20_000,
  },
});
