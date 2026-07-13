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

  // Sound means POSSIBLE. A warning is the library telling the truth about a
  // hard pose - a shoulderstand really does flex the neck to a right angle -
  // and about the rig, whose single spine bone makes a deep backbend spend its
  // arch in the neck. Neither is a body that cannot exist, which is what an
  // error means and what this gate is for.
  test.each(poses.map((p) => [p.id, p] as const))('%s is anatomically possible', (_id, pose) => {
    expect(validatePose(pose).filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  test.each(poses.map((p) => [p.id, p] as const))('%s renders', (_id, pose) => {
    expect(renderSvg(pose, { style: 'stick' })).toContain('</svg>');
  });

  test('every grounded pose declares at least one contact point with the floor', () => {
    // An airborne figure (grounded: false, e.g. a surf aerial) honestly has none.
    const missing = poses.filter((p) => p.figure.grounded && p.contact.length === 0).map((p) => p.id);
    expect(missing).toEqual([]);
  });
});

describe('bundled sequences', () => {
  test.each([...lib.sequences.values()].map((s) => [s.id, s] as const))('%s resolves every pose it names', (_id, seq) => {
    expect(() => expandSequence(seq, lib)).not.toThrow();
  });
});
