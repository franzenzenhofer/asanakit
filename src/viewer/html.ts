import { readFile } from 'node:fs/promises';
import type { MuscleId } from '../anatomy/muscles.js';
import { resolveCamera, type CameraAngles, type CameraPresetId } from '../core/camera.js';
import type { Skeleton } from '../core/types.js';
import type { PoseSpec, Prop } from '../model/schema.js';
import { renderSvg } from '../render/scene.js';

export interface ViewerOptions {
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly camera: CameraAngles;
  readonly engaged?: readonly MuscleId[];
  readonly stretched?: readonly MuscleId[];
  readonly props?: readonly Prop[];
}

/** A pose together with its solved (possibly physics-settled) skeleton. */
export interface ShowcaseEntry {
  readonly pose: PoseSpec;
  readonly skeleton: Skeleton;
}

export interface ShowcaseOptions {
  readonly title?: string;
  /** Starting viewpoint for the interactive viewer. */
  readonly camera?: CameraAngles;
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
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const payloadFor = (entries: readonly ShowcaseEntry[], camera: CameraAngles): string =>
  JSON.stringify({
    poses: entries.map(({ pose, skeleton }) => ({
      id: pose.id,
      name: pose.name,
      ...(pose.sanskrit === undefined ? {} : { sanskrit: pose.sanskrit }),
      skeleton,
      engaged: pose.muscles.engaged,
      stretched: pose.muscles.stretched,
      props: pose.props,
    })),
    camera,
  });

const PAGE_STYLE = `
  :root { color-scheme: light; }
  html, body { margin: 0; background: #ffffff; color: #1a1a1a;
    font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
  header { padding: 26px 32px 10px; }
  header h1 { margin: 0; font-size: 24px; }
  header p { margin: 4px 0 0; color: #777; font-size: 14px; }
  .stage { display: flex; gap: 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; }
  nav { width: 230px; max-height: 560px; overflow-y: auto; border-right: 1px solid #eee; padding: 10px 0; }
  nav button { display: block; width: 100%; text-align: left; border: 0; background: none;
    padding: 7px 18px; font-size: 13px; color: #444; cursor: pointer; }
  nav button:hover { background: #f5f5f5; }
  nav button.active { background: #eef4fb; color: #1a5b9e; font-weight: 600; }
  #asanakit-3d { flex: 1; height: 560px; position: relative; }
  #asanakit-3d canvas { display: block; }
  .hint { position: absolute; right: 16px; bottom: 10px; font-size: 11px; color: #aaa; pointer-events: none; }
  .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 18px; padding: 26px 32px 44px; }
  figure { margin: 0; border: 1px solid #eee; border-radius: 10px; padding: 10px; cursor: pointer; }
  figure:hover { border-color: #bcd2e8; }
  figure svg { width: 100%; height: auto; display: block; }
  figcaption { text-align: center; font-size: 13px; margin-top: 6px; color: #444; }
  figcaption em { display: block; color: #999; font-size: 11px; font-style: italic; }
`;

const card = (entry: ShowcaseEntry, svg: string, label?: string): string => {
  const { pose } = entry;
  const caption =
    label ?? `${escapeHtml(pose.name)}${pose.sanskrit === undefined ? '' : `<em>${escapeHtml(pose.sanskrit)}</em>`}`;
  // No inline handlers: the bundle binds clicks to [data-pose-card] itself.
  return `<figure data-pose-card="${escapeHtml(pose.id)}">${svg}<figcaption>${caption}</figcaption></figure>`;
};

/** For a single pose the gallery is the orbit: the same body through five cameras. */
const STRIP_CAMERAS: readonly CameraPresetId[] = ['front', 'three-quarter', 'side', 'back', 'top'];

const galleryFor = (entries: readonly ShowcaseEntry[]): string => {
  if (entries.length === 1) {
    const entry = entries[0] as ShowcaseEntry;
    return STRIP_CAMERAS.map((preset) =>
      card(entry, renderSvg(entry.pose, { skeleton: entry.skeleton, camera: preset, width: 300, height: 360 }), preset),
    ).join('\n');
  }
  return entries
    .map((entry) => card(entry, renderSvg(entry.pose, { skeleton: entry.skeleton, width: 300, height: 360 })))
    .join('\n');
};

const navFor = (entries: readonly ShowcaseEntry[]): string =>
  entries.length < 2
    ? ''
    : `<nav>${entries
        .map(
          ({ pose }) =>
            `<button data-asanakit-pose="${escapeHtml(pose.id)}">${escapeHtml(pose.name)}</button>`,
        )
        .join('')}</nav>`;

/**
 * ONE self-contained offline HTML file with everything asanakit can say about
 * the given poses: an interactive 3D viewer (orbit, zoom, pan; pose picker
 * when there is more than one) above a gallery of deterministic inline SVG
 * renders - the orbit strip for a single pose, one card per pose otherwise.
 * No CDN, no network, works from file://.
 */
export const buildShowcaseHtml = async (
  entries: readonly ShowcaseEntry[],
  options: ShowcaseOptions = {},
): Promise<string> => {
  if (entries.length === 0) throw new Error('Nothing to show: no poses given');
  const bundle = await loadBundle();
  const first = entries[0] as ShowcaseEntry;
  const camera = options.camera ?? resolveCamera(entries.length === 1 ? first.pose.camera : 'three-quarter');
  const title = options.title ?? (entries.length === 1 ? first.pose.name : 'asanakit');
  const subtitle =
    entries.length === 1
      ? (first.pose.sanskrit ?? '')
      : `${entries.length} postures - drag to orbit, click a pose to load it`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} - asanakit</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<header><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></header>
<div class="stage">
${navFor(entries)}
<div id="asanakit-3d"><span class="hint">drag to orbit &middot; scroll to zoom &middot; right-drag to pan</span></div>
</div>
<div class="gallery">
${galleryFor(entries)}
</div>
<script>window.ASANAKIT_VIEWER = ${inline(payloadFor(entries, camera))};</script>
<script>${inline(bundle)}</script>
</body>
</html>
`;
};

/** A fullscreen interactive viewer for one solved skeleton (the `asanakit view` page). */
export const buildViewerHtml = async (skeleton: Skeleton, options: ViewerOptions): Promise<string> => {
  const bundle = await loadBundle();
  const payload = JSON.stringify({
    poses: [
      {
        id: 'pose',
        name: options.title,
        ...(options.subtitle === undefined ? {} : { sanskrit: options.subtitle }),
        skeleton,
        engaged: options.engaged ?? [],
        stretched: options.stretched ?? [],
        props: options.props ?? [],
      },
    ],
    camera: options.camera,
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
  #asanakit-3d { position: fixed; inset: 0; }
  #asanakit-3d canvas { display: block; }
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
<div id="asanakit-3d"></div>
<script>window.ASANAKIT_VIEWER = ${inline(payload)};</script>
<script>${inline(bundle)}</script>
</body>
</html>
`;
};
