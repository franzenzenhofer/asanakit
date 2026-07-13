import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { posesPlugin } from './vite-plugin-poses.js';

const here = dirname(fileURLToPath(import.meta.url));
const engineSrc = resolve(here, '../src');

/** The engine uses ESM `.js` specifiers on TS sources; map them for Vite. */
const engineTsResolver = (): Plugin => ({
  name: 'asanakit-engine-ts',
  resolveId(source, importer): string | null {
    if (importer === undefined || !source.endsWith('.js')) return null;
    if (!source.startsWith('.') && !source.startsWith(engineSrc)) return null;
    const absolute = source.startsWith('.') ? resolve(dirname(importer), source) : source;
    if (!absolute.startsWith(engineSrc)) return null;
    const ts = absolute.replace(/\.js$/, '.ts');
    return existsSync(ts) ? ts : null;
  },
});

export default defineConfig({
  root: here,
  plugins: [
    preact(),
    engineTsResolver(),
    posesPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        maximumFileSizeToCacheInBytes: 4_000_000,
        // Without this, a stale worker can go on serving an index.html whose
        // hashed assets we have already deleted from the server - and the app
        // boots to a white screen. Take the old caches with the old worker.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Never answer a request for a hashed chunk with the app shell. Pages
        // serves index.html for anything it does not have, and a worker that
        // caches THAT as if it were the JS will hand it back forever.
        navigateFallbackDenylist: [/^\/assets\//],
      },
      manifest: {
        name: 'asanakit Studio',
        short_name: 'asanakit',
        description: 'Create perfect asanas, compose printable practice sheets, explore every pose in 3D.',
        theme_color: '#fbfaf7',
        background_color: '#fbfaf7',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@asanakit': engineSrc },
  },
  build: {
    outDir: resolve(here, '../dist/editor'),
    emptyOutDir: true,
    target: 'es2022',
  },
  server: { port: 5183 },
});
