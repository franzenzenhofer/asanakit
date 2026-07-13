import { describe, expect, test } from 'vitest';
import { DEFAULT_RIG } from '../../src/core/rig.js';
import { boneEndingAt, jointsOfBone, solveSkeleton } from '../../src/core/skeleton.js';
import { LANDMARK_IDS, type KinematicPose } from '../../src/core/types.js';

const pose = (over: Partial<KinematicPose> = {}): KinematicPose => ({
  root: { position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, scale: 1 },
  joints: {},
  world: {},
  grounded: false,
  ...over,
});

const solve = (over: Partial<KinematicPose> = {}) => solveSkeleton(pose(over), DEFAULT_RIG).landmarks;

describe('solveSkeleton - rest pose', () => {
  test('places the pelvis at the root position', () => {
    expect(solve().hipCenter).toEqual([0, 0, 0]);
  });

  test('stacks the torso straight up from the hips', () => {
    const l = solve();
    expect(l.headTop[0]).toBeCloseTo(0, 8);
    expect(l.headTop[2]).toBeCloseTo(0, 8);
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

  test('puts the figure left side on positive x', () => {
    const l = solve();
    expect(l.shoulderL[0]).toBeGreaterThan(0);
    expect(l.shoulderR[0]).toBeLessThan(0);
    expect(l.shoulderL[0]).toBeCloseTo(-l.shoulderR[0], 8);
    expect(l.shoulderL[1]).toBeCloseTo(l.shoulderR[1], 8);
  });

  test('extends both legs straight down to the ankles', () => {
    const l = solve();
    expect(l.kneeL[1]).toBeLessThan(0);
    expect(l.ankleL[1]).toBeLessThan(l.kneeL[1]);
    expect(l.ankleL[0]).toBeCloseTo(l.kneeL[0], 8);
  });

  test('points both feet forward, toward +z', () => {
    const l = solve();
    expect(l.toeL[2]).toBeGreaterThan(l.ankleL[2]);
    expect(l.toeR[2]).toBeGreaterThan(l.ankleR[2]);
    expect(l.toeL[0]).toBeCloseTo(l.ankleL[0], 8);
  });

  test('is roughly one unit tall from sole to crown', () => {
    const s = solveSkeleton(pose(), DEFAULT_RIG);
    expect(s.height).toBeGreaterThan(0.95);
    expect(s.height).toBeLessThan(1.05);
  });
});

describe('solveSkeleton - flexion', () => {
  test('a scalar joint value flexes the bone forward, into +z', () => {
    const l = solve({ joints: { upperArmL: 90 } });
    expect(l.elbowL[2]).toBeGreaterThan(l.shoulderL[2] + 0.1);
    expect(l.elbowL[1]).toBeCloseTo(l.shoulderL[1], 8);
  });

  test('hip flexion swings the thigh forward', () => {
    const l = solve({ joints: { thighL: 90 } });
    expect(l.kneeL[2]).toBeGreaterThan(l.hipJointL[2] + 0.2);
    expect(l.kneeL[1]).toBeCloseTo(l.hipJointL[1], 8);
  });

  test('knee flexion folds the heel up and BACKWARD - the way a knee bends', () => {
    const straight = solve();
    const bent = solve({ joints: { shinL: 90 } });
    expect(bent.ankleL[1]).toBeGreaterThan(straight.ankleL[1]);
    expect(bent.ankleL[2]).toBeLessThan(straight.ankleL[2]);
  });

  test('spine flexion bends the torso forward', () => {
    const l = solve({ joints: { spine: 60 } });
    expect(l.chest[2]).toBeGreaterThan(0.1);
  });
});

describe('solveSkeleton - abduction and twist', () => {
  test('abduction lifts the arm away from the midline, on both sides', () => {
    const l = solve({ joints: { upperArmL: { abduct: 90 }, upperArmR: { abduct: 90 } } });
    expect(l.elbowL[0]).toBeGreaterThan(l.shoulderL[0] + 0.1);
    expect(l.elbowR[0]).toBeLessThan(l.shoulderR[0] - 0.1);
    expect(l.elbowL[1]).toBeCloseTo(l.shoulderL[1], 6);
  });

  test('mirrored joint values yield a perfectly mirrored figure', () => {
    const l = solve({
      joints: {
        upperArmL: { flex: 40, abduct: 70, twist: 25 },
        upperArmR: { flex: 40, abduct: 70, twist: 25 },
        forearmL: 30,
        forearmR: 30,
      },
    });
    expect(l.wristL[0]).toBeCloseTo(-l.wristR[0], 8);
    expect(l.wristL[1]).toBeCloseTo(l.wristR[1], 8);
    expect(l.wristL[2]).toBeCloseTo(l.wristR[2], 8);
  });

  test('external hip twist turns the toes outward, symmetrically', () => {
    const l = solve({ joints: { thighL: { twist: 45 }, thighR: { twist: 45 } } });
    expect(l.toeL[0]).toBeGreaterThan(l.ankleL[0] + 0.02);
    expect(l.toeR[0]).toBeLessThan(l.ankleR[0] - 0.02);
    expect(l.toeL[0]).toBeCloseTo(-l.toeR[0], 8);
  });

  test('rejects an unknown joint name instead of silently ignoring it', () => {
    const bad = pose({ joints: { notAJoint: 20 } as KinematicPose['joints'] });
    expect(() => solveSkeleton(bad, DEFAULT_RIG)).toThrow(/notAJoint/);
  });
});

describe('solveSkeleton - root orientation', () => {
  test('yaw turns the whole figure toward its left', () => {
    const l = solve({ root: { position: [0, 0, 0], yaw: 90, pitch: 0, roll: 0, scale: 1 } });
    // Facing +x now, so the toes point that way.
    expect(l.toeL[0]).toBeGreaterThan(l.ankleL[0] + 0.05);
    expect(l.toeL[2]).toBeCloseTo(l.ankleL[2], 6);
  });

  test('pitch tips the whole figure toward horizontal', () => {
    const l = solve({ root: { position: [0, 0, 0], yaw: 0, pitch: 90, roll: 0, scale: 1 } });
    expect(l.headTop[2]).toBeGreaterThan(0.4);
    expect(l.headTop[1]).toBeCloseTo(0, 6);
  });

  test('root scale scales the whole figure', () => {
    const s = solveSkeleton(pose({ root: { position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, scale: 2 } }), DEFAULT_RIG);
    expect(s.height).toBeGreaterThan(1.9);
  });
});

describe('solveSkeleton - grounding and bounds', () => {
  test('grounded poses rest their lowest point on y = 0', () => {
    const s = solveSkeleton(pose({ grounded: true }), DEFAULT_RIG);
    expect(s.bounds.minY).toBeCloseTo(0, 8);
    expect(s.landmarks.hipCenter[1]).toBeGreaterThan(0.4);
  });

  test('bounds enclose every landmark', () => {
    const s = solveSkeleton(pose({ joints: { upperArmL: 170, upperArmR: { abduct: 170 } } }), DEFAULT_RIG);
    for (const [px, py, pz] of Object.values(s.landmarks)) {
      expect(px).toBeGreaterThanOrEqual(s.bounds.minX - 1e-9);
      expect(px).toBeLessThanOrEqual(s.bounds.maxX + 1e-9);
      expect(py).toBeGreaterThanOrEqual(s.bounds.minY - 1e-9);
      expect(py).toBeLessThanOrEqual(s.bounds.maxY + 1e-9);
      expect(pz).toBeGreaterThanOrEqual(s.bounds.minZ - 1e-9);
      expect(pz).toBeLessThanOrEqual(s.bounds.maxZ + 1e-9);
    }
  });
});

describe('solveSkeleton - absolute world directions', () => {
  test('aims a bone at an absolute direction, ignoring its parent chain', () => {
    // Straight up, whatever the pelvis does.
    const s = solveSkeleton(
      pose({
        root: { position: [0, 0, 0], yaw: 0, pitch: 40, roll: 0, scale: 1 },
        world: { spine: { azimuth: 0, elevation: 90 } },
      }),
      DEFAULT_RIG,
    );
    const spine = s.bones.spine;
    expect(spine.end[1] - spine.start[1]).toBeCloseTo(spine.length, 6);
  });

  test('children of a world-aimed bone stay relative to it', () => {
    // Thigh pinned horizontal-forward; 90 degrees of knee flexion hangs the shin straight down.
    const s = solveSkeleton(
      pose({ world: { thighL: { azimuth: 0, elevation: 0 } }, joints: { shinL: 90 } }),
      DEFAULT_RIG,
    );
    const shin = s.bones.shinL;
    expect(shin.end[1] - shin.start[1]).toBeCloseTo(-shin.length, 6);
  });

  test('a world direction on a right-side bone means what it says', () => {
    const s = solveSkeleton(pose({ world: { thighR: { azimuth: 90, elevation: 0 } } }), DEFAULT_RIG);
    const thigh = s.bones.thighR;
    expect(thigh.end[0] - thigh.start[0]).toBeCloseTo(thigh.length, 6);
  });

  test('rejects an unknown bone in the world block', () => {
    const bad = { notABone: { azimuth: 0, elevation: 0 } } as unknown as KinematicPose['world'];
    expect(() => solveSkeleton(pose({ world: bad }), DEFAULT_RIG)).toThrow(/notABone/);
  });
});

describe('solveSkeleton - determinism', () => {
  test('the same pose always solves to identical geometry', () => {
    const p = pose({ joints: { upperArmL: { flex: 33, abduct: 21, twist: 8 }, shinR: 47 }, grounded: true });
    expect(solveSkeleton(p, DEFAULT_RIG)).toEqual(solveSkeleton(p, DEFAULT_RIG));
  });
});

describe('joints are handles: grab one, and what hangs off it comes along', () => {
  test('a joint moves the bone that ENDS there', () => {
    // Pull the knee and you are aiming the thigh - which is what a knee is.
    expect(boneEndingAt('kneeL')).toBe('thighL');
    expect(boneEndingAt('ankleR')).toBe('shinR');
    expect(boneEndingAt('elbowL')).toBe('upperArmL');
    expect(boneEndingAt('wristR')).toBe('forearmR');
    expect(boneEndingAt('shoulderL')).toBe('clavicleL');
    expect(boneEndingAt('chest')).toBe('thorax');
  });

  test('a landmark that ends nothing is not a handle', () => {
    expect(boneEndingAt('hipCenter')).toBeNull();
    expect(boneEndingAt('neckBase')).toBeNull();
    expect(boneEndingAt('headCenter')).toBeNull();
  });

  test('every handle really is at the end of the bone it claims', () => {
    const skeleton = solveSkeleton(
      { root: { position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, scale: 1 }, joints: { thighL: { flex: 40 }, upperArmR: { abduct: 60 } }, world: {}, grounded: false },
      DEFAULT_RIG,
    );
    for (const id of LANDMARK_IDS) {
      const bone = boneEndingAt(id);
      if (bone === null) continue;
      expect(skeleton.landmarks[id]).toEqual(skeleton.bones[bone].end);
    }
  });

  test('aiming the bone a joint holds carries the whole limb below it', () => {
    const at = (flex: number) =>
      solveSkeleton(
        { root: { position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, scale: 1 }, joints: { thighL: { flex } }, world: {}, grounded: false },
        DEFAULT_RIG,
      );
    const straight = at(0);
    const raised = at(60);

    // The knee is the handle; the ankle and the toes hang off it and must follow.
    expect(raised.landmarks.kneeL).not.toEqual(straight.landmarks.kneeL);
    expect(raised.landmarks.ankleL).not.toEqual(straight.landmarks.ankleL);
    expect(raised.landmarks.toeL).not.toEqual(straight.landmarks.toeL);
  });
});

describe('a bone knows the joints at both of its ends', () => {
  test('a thigh swings around the hip joint and carries the knee', () => {
    expect(jointsOfBone('thighL')).toEqual({ base: 'hipJointL', tip: 'kneeL' });
    expect(jointsOfBone('shinR')).toEqual({ base: 'kneeR', tip: 'ankleR' });
    expect(jointsOfBone('forearmL')).toEqual({ base: 'elbowL', tip: 'wristL' });
  });

  test('the far joint belongs to the bone ABOVE, so stepping to it walks up the body', () => {
    const { base } = jointsOfBone('shinL');
    expect(base).toBe('kneeL');
    expect(boneEndingAt(base as 'kneeL')).toBe('thighL'); // the knee moves the thigh, not the shin
  });

  test('every joint reported really is where the bone begins and ends', () => {
    const skeleton = solveSkeleton(pose({ joints: { thighL: { flex: 35 }, shinL: { flex: 50 } } }), DEFAULT_RIG);
    for (const bone of ['thighL', 'shinL', 'forearmR', 'handR'] as const) {
      const { base, tip } = jointsOfBone(bone);
      if (base !== null) expect(skeleton.landmarks[base]).toEqual(skeleton.bones[bone].start);
      if (tip !== null) expect(skeleton.landmarks[tip]).toEqual(skeleton.bones[bone].end);
    }
  });
});
