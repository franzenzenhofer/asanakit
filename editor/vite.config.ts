import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';
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
  plugins: [preact(), engineTsResolver(), posesPlugin()],
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
