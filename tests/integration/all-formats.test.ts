/**
 * The whole product, end to end, ALWAYS FRESH: every run wipes its output
 * directory and regenerates the full Ashtanga Primary Series and every surf
 * technique in every format asanakit supports - SVG, PNG, contact sheet,
 * GLB, glTF, fullscreen viewer HTML, showcase HTML, keypoints, landmarks,
 * and a physics-settled render. The artifacts land in out/integration for
 * human inspection; the assertions make the machine check them first.
 */
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { beforeAll, describe, expect, test } from 'vitest';
import { buildViewerBundle } from '../../scripts/build-viewer.js';
import { resolveCamera } from '../../src/core/camera.js';
import type { Skeleton } from '../../src/core/types.js';
import { exportGlb, exportGltf } from '../../src/export3d/index.js';
import { expandSequence, loadLibrary, type Library } from '../../src/library/index.js';
import type { PoseSpec } from '../../src/model/index.js';
import { renderPng, renderSheet, renderSvg } from '../../src/render/index.js';
import { solvePose } from '../../src/solve.js';
import { toKeypoints } from '../../src/standards/keypoints.js';
import { buildShowcaseHtml, buildViewerHtml, type ShowcaseEntry } from '../../src/viewer/index.js';

const OUT = 'out/integration';
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const SURF_IDS = [
  'paddling',
  'pop-up',
  'takeoff',
  'bottom-turn',
  'cutback',
  'tube-stance',
  'noseride',
  'duck-dive',
] as const;

let lib: Library;
let primarySteps: { pose: PoseSpec; label: string }[] = [];
let surf: ShowcaseEntry[] = [];

beforeAll(async () => {
  await rm(OUT, { recursive: true, force: true }); // always fresh
  await mkdir(`${OUT}/primary`, { recursive: true });
  await mkdir(`${OUT}/surf`, { recursive: true });
  await buildViewerBundle();

  lib = await loadLibrary();
  const sequence = lib.sequences.get('ashtanga-primary');
  if (sequence === undefined) throw new Error('bundled library lost the ashtanga-primary sequence');
  primarySteps = expandSequence(sequence, lib).map((s) => ({ pose: s.pose, label: s.label }));

  surf = await Promise.all(
    SURF_IDS.map(async (id) => {
      const pose = lib.poses.get(id);
      if (pose === undefined) throw new Error(`bundled library lost the surf pose "${id}"`);
      return { pose, skeleton: await solvePose(pose) };
    }),
  );
}, 60_000);

describe('the full Primary Series, always fresh', () => {
  test('has the whole practice: 60 steps over 37+ distinct asanas', () => {
    expect(primarySteps.length).toBeGreaterThanOrEqual(60);
    expect(new Set(primarySteps.map((s) => s.pose.id)).size).toBeGreaterThanOrEqual(37);
  });

  test('every step renders to SVG', async () => {
    for (const [i, step] of primarySteps.entries()) {
      const svg = renderSvg(step.pose, { width: 300, height: 380 });
      expect(svg, step.label).toContain('</svg>');
      expect(svg, step.label).toContain(`data-pose="${step.pose.id}"`);
      await writeFile(`${OUT}/primary/${String(i + 1).padStart(2, '0')}-${step.pose.id}.svg`, svg);
    }
  }, 60_000);

  test('the whole series renders as one PNG contact sheet', async () => {
    const poses = primarySteps.map((s) => ({ ...s.pose, name: s.label }));
    const png = renderPng(renderSheet(poses, { columns: 7, cellWidth: 250, cellHeight: 300, numbered: true }), {});
    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
    expect(png.byteLength).toBeGreaterThan(50_000);
    await writeFile(`${OUT}/primary-series.png`, png);
  }, 60_000);

  test('the whole series becomes one self-contained showcase HTML', async () => {
    const entries: ShowcaseEntry[] = [];
    const seen = new Set<string>();
    for (const step of primarySteps) {
      if (seen.has(step.pose.id)) continue;
      seen.add(step.pose.id);
      entries.push({ pose: step.pose, skeleton: await solvePose(step.pose) });
    }
    const html = await buildShowcaseHtml(entries, { title: 'Ashtanga Primary Series' });
    for (const { pose } of entries) expect(html).toContain(`data-asanakit-pose="${pose.id}"`);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    await writeFile(`${OUT}/primary-series.html`, html);
  }, 60_000);
});

describe('every surf technique, in every format', () => {
  test('all eight techniques are present', () => {
    expect(surf).toHaveLength(8);
  });

  test('SVG and PNG', async () => {
    for (const { pose, skeleton } of surf) {
      const svg = renderSvg(pose, { skeleton, width: 320, height: 260, title: true });
      expect(svg, pose.id).toContain(`data-pose="${pose.id}"`);
      const png = renderPng(svg, {});
      expect(png.subarray(0, 4), pose.id).toEqual(PNG_MAGIC);
      await writeFile(`${OUT}/surf/${pose.id}.svg`, svg);
      await writeFile(`${OUT}/surf/${pose.id}.png`, png);
    }
  }, 60_000);

  test('GLB models any 3D viewer can open', async () => {
    for (const { skeleton, pose } of surf) {
      const glb = await exportGlb(skeleton, { engaged: pose.muscles.engaged, stretched: pose.muscles.stretched });
      expect(glb.toString('ascii', 0, 4), pose.id).toBe('glTF');
      expect(glb.readUInt32LE(8), pose.id).toBe(glb.byteLength);
      await writeFile(`${OUT}/surf/${pose.id}.glb`, glb);
    }
  }, 60_000);

  test('glTF JSON with a node per bone', async () => {
    const { pose, skeleton } = surf[0] as ShowcaseEntry;
    const gltf = JSON.parse(await exportGltf(skeleton)) as { nodes?: { name?: string }[] };
    expect((gltf.nodes ?? []).filter((n) => n.name?.startsWith('bone:'))).toHaveLength(20);
    await writeFile(`${OUT}/surf/${pose.id}.gltf`, JSON.stringify(gltf));
  });

  test('fullscreen viewer HTML per technique', async () => {
    for (const { pose, skeleton } of surf) {
      const html = await buildViewerHtml(skeleton, {
        title: pose.name,
        subtitle: pose.sanskrit,
        camera: resolveCamera(pose.camera),
      });
      expect(html, pose.id).toContain('window.ASANAKIT_VIEWER');
      expect(html, pose.id).not.toMatch(/<script[^>]+src=/);
      await writeFile(`${OUT}/surf/${pose.id}.viewer.html`, html);
    }
  }, 60_000);

  test('one showcase HTML with all eight techniques', async () => {
    const html = await buildShowcaseHtml(surf, { title: 'Surf Techniques' });
    for (const { pose } of surf) expect(html).toContain(`data-asanakit-pose="${pose.id}"`);
    await writeFile(`${OUT}/surf-techniques.html`, html);
  });

  test('keypoints in both standards, with real z', () => {
    for (const { skeleton, pose } of surf) {
      const mp = toKeypoints(skeleton, 'mediapipe33');
      const coco = toKeypoints(skeleton, 'coco17');
      expect(mp.keypoints, pose.id).toHaveLength(33);
      expect(coco.keypoints, pose.id).toHaveLength(17);
      expect(mp.keypoints.some((k) => k.z !== 0), pose.id).toBe(true);
    }
  });

  test('landmarks: the solved skeleton serialises', async () => {
    const { pose, skeleton } = surf[0] as ShowcaseEntry;
    const json = JSON.stringify({ pose: pose.id, landmarks: skeleton.landmarks, bounds: skeleton.bounds });
    expect(JSON.parse(json)).toHaveProperty('landmarks.hipCenter');
    await writeFile(`${OUT}/surf/${pose.id}.landmarks.json`, json);
  });
});

describe('physics-settled output', () => {
  test('a settled pose renders and is deterministic per machine', async () => {
    const pose = lib.poses.get('adho-mukha-svanasana');
    if (pose === undefined) throw new Error('bundled library lost adho-mukha-svanasana');
    const a: Skeleton = await solvePose(pose, { settle: true });
    const b: Skeleton = await solvePose(pose, { settle: true });
    expect(a.landmarks).toEqual(b.landmarks);
    const svg = renderSvg(pose, { skeleton: a });
    expect(svg).toContain('</svg>');
    await writeFile(`${OUT}/settled-downdog.svg`, svg);
  }, 60_000);
});

describe('the output directory really is fresh', () => {
  test('contains exactly this run\'s artifacts', async () => {
    const files = await readdir(OUT);
    expect(files.sort()).toEqual(
      ['primary', 'primary-series.html', 'primary-series.png', 'settled-downdog.svg', 'surf', 'surf-techniques.html'].sort(),
    );
    expect((await readdir(`${OUT}/primary`)).length).toBeGreaterThanOrEqual(60);
    // 8 techniques x (svg + png + glb + viewer.html) + 1 gltf + 1 landmarks.json
    expect((await readdir(`${OUT}/surf`)).length).toBe(34);
  });
});
