import { describe, expect, test } from 'vitest';
import { DEFAULT_RIG } from '../../src/core/rig.js';
import { solveSkeleton } from '../../src/core/skeleton.js';
import type { KinematicPose } from '../../src/core/types.js';

const pose = (over: Partial<KinematicPose> = {}): KinematicPose => ({
  view: 'front',
  root: { position: [0, 0], rotation: 90, scale: 1 },
  joints: {},
  grounded: false,
  ...over,
});

const solve = (over: Partial<KinematicPose> = {}) => solveSkeleton(pose(over), DEFAULT_RIG).landmarks;

describe('solveSkeleton - rest pose', () => {
  test('places the pelvis at the root position', () => {
    expect(solve().hipCenter).toEqual([0, 0]);
  });

  test('stacks the torso straight up from the hips', () => {
    const l = solve();
    expect(l.headTop[0]).toBeCloseTo(0, 8);
    expect(l.headTop[1]).toBeGreaterThan(l.chest[1]);
    expect(l.chest[1]).toBeGreaterThan(l.waist[1]);
    expect(l.waist[1]).toBeGreaterThan(0);
  });

  test('hangs both arms straight down at the sides', () => {
    const l = solve();
    expect(l.elbowL[1]).toBeLessThan(l.shoulderL[1]);
    expect(l.elbowL[0]).toBeCloseTo(l.shoulderL[0], 8);
    expect(l.wristL[1]).toBeLessThan(l.elbowL[1]);
  });

  test('puts the figure left side on positive x in front view', () => {
    const l = solve();
    expect(l.shoulderL[0]).toBeGreaterThan(0);
    expect(l.shoulderR[0]).toBeLessThan(0);
    expect(l.shoulderL[0]).toBeCloseTo(-l.shoulderR[0], 8);
  });

  test('extends both legs straight down to the ankles', () => {
    const l = solve();
    expect(l.kneeL[1]).toBeLessThan(0);
    expect(l.ankleL[1]).toBeLessThan(l.kneeL[1]);
    expect(l.ankleL[0]).toBeCloseTo(l.kneeL[0], 8);
  });

  test('is roughly one unit tall from sole to crown', () => {
    const s = solveSkeleton(pose(), DEFAULT_RIG);
    expect(s.height).toBeGreaterThan(0.95);
    expect(s.height).toBeLessThan(1.05);
  });
});

describe('solveSkeleton - joint rotations', () => {
  test('a positive shoulder angle abducts the arm out to the side', () => {
    const l = solve({ joints: { upperArmL: 90 } });
    expect(l.elbowL[1]).toBeCloseTo(l.shoulderL[1], 8);
    expect(l.elbowL[0]).toBeGreaterThan(l.shoulderL[0]);
  });

  test('mirrors symmetric joint angles across the body midline', () => {
    const l = solve({ joints: { upperArmL: 120, upperArmR: 120 } });
    expect(l.wristL[0]).toBeCloseTo(-l.wristR[0], 8);
    expect(l.wristL[1]).toBeCloseTo(l.wristR[1], 8);
  });

  test('bends the knee when the shin joint is rotated', () => {
    const straight = solve();
    const bent = solve({ joints: { shinL: 90 } });
    expect(bent.ankleL[1]).toBeGreaterThan(straight.ankleL[1]);
  });

  test('root rotation turns the whole figure', () => {
    const l = solve({ root: { position: [0, 0], rotation: 0, scale: 1 } });
    expect(l.headTop[0]).toBeGreaterThan(0.4);
    expect(l.headTop[1]).toBeCloseTo(0, 8);
  });

  test('root scale scales the whole figure', () => {
    const s = solveSkeleton(pose({ root: { position: [0, 0], rotation: 90, scale: 2 } }), DEFAULT_RIG);
    expect(s.height).toBeGreaterThan(1.9);
  });

  test('rejects an unknown joint name instead of silently ignoring it', () => {
    const bad = pose({ joints: { notAJoint: 20 } as KinematicPose['joints'] });
    expect(() => solveSkeleton(bad, DEFAULT_RIG)).toThrow(/notAJoint/);
  });
});

describe('solveSkeleton - grounding, flipping and bounds', () => {
  test('grounded poses rest their lowest point on y = 0', () => {
    const s = solveSkeleton(pose({ grounded: true }), DEFAULT_RIG);
    expect(s.bounds.minY).toBeCloseTo(0, 8);
    expect(s.landmarks.hipCenter[1]).toBeGreaterThan(0.4);
  });

  test('flip mirrors the whole figure across the vertical axis', () => {
    const normal = solve({ view: 'side' });
    const flipped = solve({ view: 'side', flip: true });
    expect(flipped.toeL[0]).toBeCloseTo(-normal.toeL[0], 8);
    expect(flipped.toeL[1]).toBeCloseTo(normal.toeL[1], 8);
  });

  test('bounds enclose every landmark', () => {
    const s = solveSkeleton(pose({ joints: { upperArmL: 170, upperArmR: 170 } }), DEFAULT_RIG);
    for (const [px, py] of Object.values(s.landmarks)) {
      expect(px).toBeGreaterThanOrEqual(s.bounds.minX - 1e-9);
      expect(px).toBeLessThanOrEqual(s.bounds.maxX + 1e-9);
      expect(py).toBeGreaterThanOrEqual(s.bounds.minY - 1e-9);
      expect(py).toBeLessThanOrEqual(s.bounds.maxY + 1e-9);
    }
  });
});

describe('solveSkeleton - views', () => {
  test('side view collapses the lateral offset between the shoulders', () => {
    const front = solve({ view: 'front' });
    const side = solve({ view: 'side' });
    const frontSpan = Math.abs(front.shoulderL[0] - front.shoulderR[0]);
    const sideSpan = Math.abs(side.shoulderL[0] - side.shoulderR[0]);
    expect(sideSpan).toBeLessThan(frontSpan * 0.3);
  });

  test('side view points both feet the same way', () => {
    const l = solve({ view: 'side' });
    const toeDirL = l.toeL[0] - l.ankleL[0];
    const toeDirR = l.toeR[0] - l.ankleR[0];
    expect(toeDirL).toBeGreaterThan(0);
    expect(toeDirR).toBeGreaterThan(0);
  });

  test('front view splays the feet outward from the midline', () => {
    const l = solve({ view: 'front' });
    expect(l.toeL[0]).toBeGreaterThan(l.ankleL[0]);
    expect(l.toeR[0]).toBeLessThan(l.ankleR[0]);
  });
});
