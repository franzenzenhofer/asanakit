import { describe, expect, test } from 'vitest';
import { CAMERA_PRESETS, resolveCamera } from '../../src/core/camera.js';
import { DEFAULT_RIG } from '../../src/core/rig.js';
import { solveSkeleton } from '../../src/core/skeleton.js';
import type { KinematicPose } from '../../src/core/types.js';
import { viewSkeleton } from '../../src/render/camera.js';
import { parsePose } from '../../src/model/index.js';
import { renderSvg } from '../../src/render/index.js';

const pose = (over: Partial<KinematicPose> = {}): KinematicPose => ({
  root: { position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, scale: 1 },
  joints: {},
  world: {},
  grounded: true,
  ...over,
});

const SKELETON = solveSkeleton(pose(), DEFAULT_RIG);

describe('resolveCamera', () => {
  test('defaults to the front preset', () => {
    expect(resolveCamera()).toEqual({ azimuth: 0, elevation: 0, roll: 0 });
  });

  test('fills partial angles with zeros', () => {
    expect(resolveCamera({ azimuth: 30 })).toEqual({ azimuth: 30, elevation: 0, roll: 0 });
  });
});

describe('viewSkeleton - projections', () => {
  test('the front view shows the figure left side on picture-right', () => {
    const v = viewSkeleton(SKELETON, CAMERA_PRESETS.front);
    expect(v.landmarks.shoulderL[0]).toBeGreaterThan(v.landmarks.shoulderR[0]);
  });

  test('the back view swaps the sides', () => {
    const v = viewSkeleton(SKELETON, CAMERA_PRESETS.back);
    expect(v.landmarks.shoulderL[0]).toBeLessThan(v.landmarks.shoulderR[0]);
  });

  test('the side view collapses the shoulder span and faces the figure picture-right', () => {
    const front = viewSkeleton(SKELETON, CAMERA_PRESETS.front);
    const side = viewSkeleton(SKELETON, CAMERA_PRESETS.side);
    const frontSpan = Math.abs(front.landmarks.shoulderL[0] - front.landmarks.shoulderR[0]);
    const sideSpan = Math.abs(side.landmarks.shoulderL[0] - side.landmarks.shoulderR[0]);
    expect(sideSpan).toBeLessThan(frontSpan * 0.05);
    expect(side.landmarks.toeL[0]).toBeGreaterThan(side.landmarks.ankleL[0]);
  });

  test('height survives any horizontal orbit', () => {
    for (const camera of [CAMERA_PRESETS.front, CAMERA_PRESETS.back, CAMERA_PRESETS.left, CAMERA_PRESETS.side]) {
      expect(viewSkeleton(SKELETON, camera).height).toBeCloseTo(SKELETON.height, 8);
    }
  });

  test('the top view flattens the figure', () => {
    const v = viewSkeleton(SKELETON, CAMERA_PRESETS.top);
    expect(v.height).toBeLessThan(SKELETON.height * 0.4);
  });

  test('depth tells the near side from the far side', () => {
    // From the figure's right, the right arm is near the camera and the left is far.
    const v = viewSkeleton(SKELETON, CAMERA_PRESETS.side);
    expect(v.bones.upperArmR.depth).toBeGreaterThan(v.bones.upperArmL.depth);
    // From the left it is the other way round.
    const w = viewSkeleton(SKELETON, CAMERA_PRESETS.left);
    expect(w.bones.upperArmL.depth).toBeGreaterThan(w.bones.upperArmR.depth);
  });
});

describe('renderSvg - cameras', () => {
  const POSE = parsePose('asanakit: 2\nid: t\nname: T\ndiscipline: yoga\n', 't.pose.yaml');

  test('renders any azimuth and elevation deterministically', () => {
    const options = { camera: { azimuth: 33, elevation: 17 } } as const;
    const first = renderSvg(POSE, options);
    expect(first).toContain('</svg>');
    expect(renderSvg(POSE, options)).toBe(first);
  });

  test('different cameras give different pictures of the same pose', () => {
    expect(renderSvg(POSE, { camera: 'front' })).not.toBe(renderSvg(POSE, { camera: 'side' }));
  });

  test('the far arm is painted before the near arm in profile', () => {
    const svg = renderSvg(POSE, { camera: 'side' });
    const far = svg.indexOf('data-bone="upperArmL"');
    const near = svg.indexOf('data-bone="upperArmR"');
    expect(far).toBeGreaterThan(-1);
    expect(near).toBeGreaterThan(far);
  });

  test('the CLI-facing pose camera is honoured when no option overrides it', () => {
    const sidePose = parsePose('asanakit: 2\nid: t\nname: T\ndiscipline: yoga\ncamera: side\n', 't.pose.yaml');
    expect(renderSvg(sidePose)).toBe(renderSvg(POSE, { camera: 'side' }));
  });
});
