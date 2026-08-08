import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    allowedHosts: true,
    watch: {
      ignored: ['**/output/**'],
    },
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/uploads': 'http://127.0.0.1:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    exclude: ['**/node_modules/**', '**/.worktrees/**'],
  },
});
