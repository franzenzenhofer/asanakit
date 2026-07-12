import { describe, expect, test } from 'vitest';
import { DEFAULT_RIG } from '../../src/core/rig.js';
import { solveSkeleton } from '../../src/core/skeleton.js';
import type { KinematicPose } from '../../src/core/types.js';

const pose = (over: Partial<KinematicPose> = {}): KinematicPose => ({
  view: 'front',
  root: { position: [0, 0], rotation: 90, scale: 1 },
  joints: {},
  world: {},
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

  test('a positive shin angle flexes the knee: the heel swings up and back', () => {
    const straight = solve();
    const bent = solve({ joints: { shinL: 90 } });
    expect(bent.ankleL[1]).toBeGreaterThan(straight.ankleL[1]);
    // Flexion takes the heel behind the knee, never in front of it.
    expect(bent.ankleL[0]).toBeLessThan(straight.ankleL[0]);
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

describe('solveSkeleton - absolute world angles', () => {
  test('points a bone in an absolute direction, ignoring its rest angle', () => {
    const s = solveSkeleton(pose({ world: { thighL: -150 } }), DEFAULT_RIG);
    expect(s.bones.thighL.worldAngle).toBeCloseTo(-150, 8);
  });

  test('children of a world-angled bone stay relative to it', () => {
    // Thigh pinned down-and-back; 30 degrees of knee flexion folds the shin further back.
    const s = solveSkeleton(pose({ world: { thighL: -150 }, joints: { shinL: 30 } }), DEFAULT_RIG);
    expect(s.bones.shinL.worldAngle).toBeCloseTo(-180, 8);
  });

  test('a world angle on a right-side bone is not mirrored: it means what it says', () => {
    const s = solveSkeleton(pose({ world: { thighR: -150 } }), DEFAULT_RIG);
    expect(s.bones.thighR.worldAngle).toBeCloseTo(-150, 8);
  });

  test('world angles compose with root rotation rather than fighting it', () => {
    const s = solveSkeleton(pose({ root: { position: [0, 0], rotation: -30, scale: 1 }, world: { spine: 0 } }), DEFAULT_RIG);
    expect(s.bones.spine.worldAngle).toBeCloseTo(0, 8);
    expect(s.bones.pelvis.worldAngle).toBeCloseTo(-30, 8);
  });

  test('rejects an unknown bone in the world block', () => {
    const bad = { elbowL: 10 } as NonNullable<KinematicPose['world']>;
    expect(() => solveSkeleton(pose({ world: bad }), DEFAULT_RIG)).toThrow(/elbowL/);
  });
});

describe('solveSkeleton - lateral offset in profile views', () => {
  test('keeps the two shoulders at the same height however the torso is rotated', () => {
    // In profile, left/right separation points into the screen. It must project as a
    // sideways nudge, never as a vertical one - otherwise a horizontal spine (plank,
    // chaturanga) lifts one shoulder above the other and one hand misses the floor.
    const l = solve({ view: 'side', root: { position: [0, 0], rotation: 0, scale: 1 } });
    expect(l.shoulderL[1]).toBeCloseTo(l.shoulderR[1], 8);
    expect(l.hipJointL[1]).toBeCloseTo(l.hipJointR[1], 8);
  });

  test('lands both hands at the same height in a horizontal profile pose', () => {
    const l = solve({
      view: 'side',
      root: { position: [0, 0], rotation: 0, scale: 1 },
      world: { upperArmL: -90, upperArmR: -90, forearmL: -90, forearmR: -90 },
    });
    expect(l.wristL[1]).toBeCloseTo(l.wristR[1], 8);
  });

  test('front view still tilts the shoulder line with the torso', () => {
    const l = solve({ view: 'front', root: { position: [0, 0], rotation: 70, scale: 1 } });
    expect(Math.abs(l.shoulderL[1] - l.shoulderR[1])).toBeGreaterThan(0.02);
  });
});
