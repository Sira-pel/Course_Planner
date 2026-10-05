import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'icon-maskable.svg'],
        manifest: {
          id: '/',
          name: 'Uniplan - University Schedule Planner',
          short_name: 'Uniplan',
          description: 'University course schedule builder, scenario planner with multi-plan ghost comparison, collision detector, and calendar exporter.',
          theme_color: '#020617',
          background_color: '#020617',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui', 'window-controls-overlay'],
          orientation: 'any',
          start_url: '/',
          scope: '/',
          categories: ['education', 'productivity'],
          shortcuts: [
            {
              name: 'Add Course',
              short_name: 'Add',
              description: 'Quickly create or schedule a new course',
              url: '/#add',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Course Pool',
              short_name: 'Pool',
              description: 'Open the course catalog pool',
              url: '/#pool',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Export Schedule',
              short_name: 'Export',
              description: 'Export or share your schedule',
              url: '/#export',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
          ],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          // Dialogs and SheetJS load on demand. Leave them out of the
          // install precache so the first visit does not download them.
          globIgnores: [
            '**/node_modules/**/*',
            '**/xlsx-*.js',
            '**/firebase-*.js',
            '**/GoogleCalendarSync-*.js',
            '**/CourseModal-*.js',
            '**/ExportModal-*.js',
            '**/ImportModal-*.js',
            '**/HelpModal-*.js',
            '**/ShareImportModal-*.js',
            '**/textParser-*.js',
            '**/icsImport-*.js',
            '**/calendar-*.js',
            '**/database-*.js',
            '**/file-spreadsheet-*.js',
            '**/circle-alert-*.js',
          ],
          runtimeCaching: [
            {
              // Hashed deferred scripts, cached after the screen that needs them opens.
              urlPattern: /\/assets\/(?:xlsx|firebase|GoogleCalendarSync|CourseModal|ExportModal|ImportModal|HelpModal|ShareImportModal|textParser|icsImport|calendar|database|file-spreadsheet|circle-alert)-[^/]+\.js$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'deferred-js',
                expiration: {
                  maxEntries: 32,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            firebase: ['firebase/app', 'firebase/auth'],
            xlsx: ['xlsx'],
            motion: ['motion'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
