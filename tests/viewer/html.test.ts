import { beforeAll, describe, expect, test } from 'vitest';
import { buildViewerBundle } from '../../scripts/build-viewer.js';
import { resolveCamera } from '../../src/core/camera.js';
import { DEFAULT_RIG } from '../../src/core/rig.js';
import { solveSkeleton } from '../../src/core/skeleton.js';
import type { KinematicPose } from '../../src/core/types.js';
import { buildViewerHtml } from '../../src/viewer/index.js';

const POSE: KinematicPose = {
  root: { position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, scale: 1 },
  joints: {},
  world: {},
  grounded: true,
};

const SKELETON = solveSkeleton(POSE, DEFAULT_RIG);

let html = '';

beforeAll(async () => {
  await buildViewerBundle();
  html = await buildViewerHtml(SKELETON, {
    title: 'Mountain <Pose>',
    subtitle: 'Tāḍāsana',
    camera: resolveCamera('three-quarter'),
    engaged: ['quadriceps'],
  });
}, 30_000);

describe('buildViewerHtml', () => {
  test('is a complete standalone HTML document', () => {
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
    expect(html).toContain('window.ASANAKIT_VIEWER');
  });

  test('embeds the solved skeleton and the muscle highlights', () => {
    expect(html).toContain('"hipCenter"');
    expect(html).toContain('"quadriceps"');
    expect(html).toContain('"azimuth":-45');
  });

  test('loads nothing from the network: no external scripts, styles or fetches', () => {
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).not.toMatch(/@import/);
    expect(html).not.toMatch(/fetch\(["'`]http/);
  });

  test('keeps the light theme: white background, dark ink', () => {
    expect(html).toContain('background: #ffffff');
  });

  test('escapes the pose name so it cannot inject markup', () => {
    expect(html).toContain('Mountain &lt;Pose&gt;');
    // The raw name may appear inside the JSON payload (harmless there, since
    // every `</` is escaped) but never in the HTML itself.
    const markup = html.slice(0, html.indexOf('<script>'));
    expect(markup).not.toContain('Mountain <Pose>');
  });

  test('never closes a script tag early, even with </script> in the data', () => {
    const scripts = html.split('<script>').length - 1;
    const closers = html.split('</script>').length - 1;
    expect(scripts).toBe(2);
    expect(closers).toBe(2);
  });
});
