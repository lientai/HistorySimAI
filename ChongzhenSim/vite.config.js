import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'data',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  },
  server: {
    port: 8080,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': '/js',
      '@data': '/data',
      '@api': '/js/api',
      '@systems': '/js/systems',
      '@ui': '/js/ui'
    }
  }
});
