import { describe, expect, test } from 'vitest';
import { loadLibrary } from '../../src/library/index.js';
import { isCameraPresetId } from '../../src/core/camera.js';

const lib = await loadLibrary();
const poses = [...lib.poses.values()];
const yoga = poses.filter((p) => p.discipline === 'yoga');

/**
 * The metadata quality bar for the bundled library. Every pose that ships is
 * browsable, printable and teachable: family, difficulty, cues and muscle
 * work are not optional extras, they are the product.
 */
describe('bundled library integrity', () => {
  test('the library is big and both disciplines are covered', () => {
    expect(poses.length).toBeGreaterThanOrEqual(120);
    expect(poses.filter((p) => p.discipline === 'surf').length).toBeGreaterThanOrEqual(13);
    expect(lib.sequences.size).toBeGreaterThanOrEqual(4);
  });

  test.each(poses.map((p) => [p.id, p] as const))('%s meets the metadata bar', (_id, pose) => {
    expect(pose.family, 'family').toBeTruthy();
    expect(pose.difficulty, 'difficulty').toBeGreaterThanOrEqual(1);
    expect(pose.cues.length, 'cues').toBeGreaterThanOrEqual(1);
    // Savasana honestly engages nothing; resting poses may rest completely.
    if (pose.family !== 'restorative' && pose.family !== 'supine') {
      expect(pose.muscles.engaged.length + pose.muscles.stretched.length, 'muscle work').toBeGreaterThanOrEqual(1);
    }
    expect(pose.description, 'description').toBeTruthy();
    const camera = pose.camera;
    expect(typeof camera === 'string' ? isCameraPresetId(camera) : typeof camera.azimuth === 'number', 'camera').toBe(true);
  });

  test.each(yoga.map((p) => [p.id, p] as const))('%s (yoga) has sanskrit', (_id, pose) => {
    expect(pose.sanskrit).toBeTruthy();
  });

  test('every sequence step resolves and expands', () => {
    for (const sequence of lib.sequences.values()) {
      for (const section of sequence.sections) {
        for (const step of section.steps) {
          expect(lib.poses.has(step.pose), `${sequence.id} -> ${step.pose}`).toBe(true);
        }
      }
    }
  });
});
