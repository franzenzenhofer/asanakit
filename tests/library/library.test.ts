import { describe, expect, test } from 'vitest';
import { validatePose } from '../../src/anatomy/validate.js';
import { expandSequence, loadLibrary } from '../../src/library/index.js';
import { renderSvg } from '../../src/render/index.js';

const lib = await loadLibrary();
const poses = [...lib.poses.values()];

describe('bundled pose library', () => {
  test('contains poses', () => {
    expect(poses.length).toBeGreaterThan(0);
  });

  test.each(poses.map((p) => [p.id, p] as const))('%s is anatomically sound', (_id, pose) => {
    expect(validatePose(pose)).toEqual([]);
  });

  test.each(poses.map((p) => [p.id, p] as const))('%s renders', (_id, pose) => {
    expect(renderSvg(pose, { style: 'stick' })).toContain('</svg>');
  });

  test('every pose declares at least one contact point with the floor', () => {
    const missing = poses.filter((p) => p.contact.length === 0).map((p) => p.id);
    expect(missing).toEqual([]);
  });
});

describe('bundled sequences', () => {
  test.each([...lib.sequences.values()].map((s) => [s.id, s] as const))('%s resolves every pose it names', (_id, seq) => {
    expect(() => expandSequence(seq, lib)).not.toThrow();
  });
});
