import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Conditionally load PWA plugin (only if installed)
  const plugins: any[] = [react(), tailwindcss()];

  try {
    const { VitePWA } = await import('vite-plugin-pwa');
    plugins.push(
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfont-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          name: 'LifeOS Health Suite',
          short_name: 'LifeOS',
          description: 'Professional Health & Longevity Suite',
          theme_color: '#10b981',
          background_color: '#0a0a0a',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' as any },
          ],
        },
        devOptions: {
          enabled: false,
        },
      })
    );
  } catch {
    console.log('vite-plugin-pwa not installed — skipping PWA. Run: npm install vite-plugin-pwa --save-dev');
  }

  return {
    plugins,
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
    build: {
      // Enable source maps for debugging in production (optional)
      sourcemap: false,

      // Chunk size warning threshold
      chunkSizeWarningLimit: 1000,

      // Optimize CSS
      cssMinify: true,

      // Rollup options for better code splitting
      rollupOptions: {
        output: {
          // Manual chunks for better caching
          manualChunks: {
            // Vendor chunks - separate large dependencies
            'firebase-core': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
            'firebase-messaging': ['firebase/messaging'],
            'ui-framework': ['react', 'react-dom', 'react-router-dom'],
            'charts': ['recharts'],
            'animations': ['motion'],
            'utils': ['date-fns', 'axios', 'dexie', 'zustand'],
          },
          // Better file naming
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'assets/css/[name]-[hash][extname]';
            }
            return 'assets/[ext]/[name]-[hash][extname]';
          },
        },
      },
    },
    optimizeDeps: {
      // Pre-bundle dependencies for faster dev startup
      include: ['firebase/app', 'firebase/firestore', 'firebase/auth', 'firebase/messaging'],
    },
  };
});
