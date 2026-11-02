import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'EVO Environment Operations',
        short_name: 'EVO',
        start_url: '/',
        display: 'standalone',
        background_color: '#E4E8E1',
        theme_color: '#3F6B45',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Reads the input screens need, so they open without signal. Network first: online always shows fresh data.
        runtimeCaching: [{
          urlPattern: ({ url }: { url: URL }) => /^\/api\/(day|ponds|events|auth\/me)/.test(url.pathname),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'evo-api',
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 60, maxAgeSeconds: 14 * 24 * 3600 },
            cacheableResponse: { statuses: [200] },
          },
        }],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:8787' } },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'], include: ['src/**/*.test.{ts,tsx}'] },
});
