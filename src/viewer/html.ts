import { readFile } from 'node:fs/promises';
import type { CameraAngles } from '../core/camera.js';
import type { Skeleton } from '../core/types.js';
import type { MuscleId } from '../anatomy/muscles.js';

export interface ViewerOptions {
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly camera: CameraAngles;
  readonly engaged?: readonly MuscleId[];
  readonly stretched?: readonly MuscleId[];
}

/**
 * Both the compiled module (dist/viewer/html.js) and the tsx-run source
 * (src/viewer/html.ts) sit two levels below the package root, so one relative
 * path finds the bundle from either world.
 */
const BUNDLE_URL = new URL('../../dist/viewer/viewer.bundle.js', import.meta.url);

const loadBundle = async (): Promise<string> => {
  try {
    return await readFile(BUNDLE_URL, 'utf8');
  } catch {
    throw new Error('Viewer bundle missing. Run "npm run build" to produce dist/viewer/viewer.bundle.js.');
  }
};

/** `</script>` inside inlined JSON or JS would end the tag; escape every `</`. */
const inline = (text: string): string => text.replaceAll('</', '<\\/');

const escapeHtml = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * A single self-contained offline HTML file: the solved skeleton as JSON plus
 * the prebuilt three.js viewer bundle. No CDN, no network, works from file://.
 */
export const buildViewerHtml = async (skeleton: Skeleton, options: ViewerOptions): Promise<string> => {
  const bundle = await loadBundle();
  const payload = JSON.stringify({
    skeleton,
    camera: options.camera,
    engaged: options.engaged ?? [],
    stretched: options.stretched ?? [],
  });

  const subtitle = options.subtitle === undefined ? '' : `<em>${escapeHtml(options.subtitle)}</em>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)} - asanakit</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #ffffff; }
  canvas { display: block; }
  #hud {
    position: fixed; top: 14px; left: 18px; z-index: 1;
    font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1a1a1a;
    user-select: none; pointer-events: none;
  }
  #hud strong { font-size: 17px; }
  #hud em { display: block; font-size: 13px; color: #777; margin-top: 2px; }
  #hud span { display: block; font-size: 11px; color: #aaa; margin-top: 6px; }
</style>
</head>
<body>
<div id="hud"><strong>${escapeHtml(options.title)}</strong>${subtitle}<span>drag to orbit &middot; scroll to zoom &middot; right-drag to pan</span></div>
<script>window.ASANAKIT_VIEWER = ${inline(payload)};</script>
<script>${inline(bundle)}</script>
</body>
</html>
`;
};
