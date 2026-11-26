import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/icon.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/apple-touch-icon.png',
        'fonts/UthmanicHafs1Ver18.woff2',
        'fonts/UthmanicHafs1Ver16.ttf',
        'fonts/Kitab-Regular.ttf',
        'fonts/Kitab-Bold.ttf',
        'data/athkar.json',
      ],
      manifest: {
        name: 'NoorPath — คลังอัลกุรอาน ท่องจำ และฮะดีษ',
        short_name: 'NoorPath',
        description:
          'เว็บแอปส่วนตัวสำหรับอ่าน ศึกษา ท่องจำอัลกุรอาน เสียงอ่าน และฮะดีษแบบ Offline บน iPad',
        theme_color: '#0F6B53',
        background_color: '#FBF7EE',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        lang: 'th',
        icons: [
          {
            src: './icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: './icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: './icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ttf,woff2,webmanifest}'],
        globIgnores: ['**/fonts/qcf-v2/**'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*\.json$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'noorpath-data-v3',
              expiration: {
                maxEntries: 450,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\/fonts\/qcf-v2\/.*\.woff2$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'noorpath-qcf-v2-fonts-v1',
              expiration: {
                maxEntries: 650,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.mp3$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'noorpath-audio-v1',
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
