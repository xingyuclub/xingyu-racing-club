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
      // server/data、server/storage、server/config 由 API 进程在运行时原子写入
      // （如 site-config.json.bak.next），Windows 上监听这些临时文件会抛
      // EBUSY 并直接终止 dev server，导致后台请求全部变成 Failed to fetch。
      ignored: [
        '**/output/**',
        '**/server/data/**',
        '**/server/storage/**',
        '**/server/config/**',
      ],
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
    exclude: ['**/node_modules/**', '**/.worktrees/**', '**/output/**'],
  },
});
