import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const publicConfigScriptUrl = String(process.env.VITE_PUBLIC_CONFIG_SCRIPT_URL || '').trim();

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    publicConfigScriptUrl && {
      name: 'public-runtime-config',
      transformIndexHtml() {
        return [{
          tag: 'script',
          attrs: { src: publicConfigScriptUrl },
          injectTo: 'head-prepend',
        }];
      },
    },
  ].filter(Boolean),
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
