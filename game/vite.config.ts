import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Sử dụng relative path để hoạt động tốt trên GitHub Pages đường dẫn phụ
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});
