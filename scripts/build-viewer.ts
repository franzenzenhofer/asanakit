/**
 * Bundle the browser viewer (three.js included) into one minified IIFE. Runs
 * as part of `npm run build`, so the published package ships the bundle and
 * the installed CLI never needs a bundler.
 */
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

export const VIEWER_BUNDLE_PATH = new URL('../dist/viewer/viewer.bundle.js', import.meta.url).pathname;

export const buildViewerBundle = async (): Promise<void> => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };

  await build({
    entryPoints: [new URL('../viewer-src/main.ts', import.meta.url).pathname],
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    outfile: VIEWER_BUNDLE_PATH,
    banner: { js: `/* asanakit viewer ${pkg.version} */` },
    logLevel: 'silent',
  });
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await buildViewerBundle();
  console.log(`built ${VIEWER_BUNDLE_PATH}`);
}
