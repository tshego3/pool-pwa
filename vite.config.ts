import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      outDir: 'dist',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        rollupFormat: 'iife',
        // Precache the entire app shell for a full offline guarantee: JS/CSS/HTML
        // plus icons, the web manifest, and any fonts/sounds added later. Nothing
        // is fetched at runtime.
        globPatterns: ['**/*.{js,css,html,svg,webmanifest,woff,woff2,ttf,mp3,wav,ogg,png,ico}'],
      },
    }),
  ],
  base: '/pool-pwa/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/@mantine/core/') ||
            id.includes('node_modules/@mantine/hooks/')
          ) {
            return 'framework';
          }
        },
      },
    },
  },
});
