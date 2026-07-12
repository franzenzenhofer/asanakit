import { describe, expect, test } from 'vitest';
import { DEFAULT_RIG } from '../../src/core/rig.js';
import { solveSkeleton } from '../../src/core/skeleton.js';
import { COCO_17, MEDIAPIPE_33, toKeypoints } from '../../src/standards/keypoints.js';
import type { KinematicPose } from '../../src/core/types.js';

const POSE: KinematicPose = {
  root: { position: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, scale: 1 },
  joints: {},
  world: {},
  grounded: true,
};

const skeleton = solveSkeleton(POSE, DEFAULT_RIG);

describe('keypoint export', () => {
  test('MediaPipe has 33 landmarks and COCO has 17', () => {
    expect(MEDIAPIPE_33).toHaveLength(33);
    expect(COCO_17).toHaveLength(17);
  });

  test('exports every landmark of the requested standard, in order', () => {
    const kp = toKeypoints(skeleton, 'coco17');
    expect(kp.keypoints).toHaveLength(17);
    expect(kp.keypoints[0]?.name).toBe('nose');
    expect(kp.keypoints.map((k) => k.index)).toEqual([...Array(17).keys()]);
  });

  test('places the shoulders above the hips and the ankles below both', () => {
    const kp = toKeypoints(skeleton, 'mediapipe33');
    const at = (name: string) => kp.keypoints.find((k) => k.name === name);
    expect(at('left_shoulder')?.y).toBeGreaterThan(at('left_hip')?.y as number);
    expect(at('left_hip')?.y).toBeGreaterThan(at('left_ankle')?.y as number);
    expect(at('nose')?.y).toBeGreaterThan(at('left_shoulder')?.y as number);
  });

  test('carries a real z: the nose sits in front of the ears', () => {
    const kp = toKeypoints(skeleton, 'mediapipe33');
    const at = (name: string) => kp.keypoints.find((k) => k.name === name);
    expect(at('nose')?.z).toBeGreaterThan(at('left_ear')?.z as number);
    expect(at('left_foot_index')?.z).toBeGreaterThan(at('left_ankle')?.z as number);
  });

  test('normalised export uses image coordinates: 0..1 with y pointing down', () => {
    const kp = toKeypoints(skeleton, 'mediapipe33', { normalize: true });
    for (const k of kp.keypoints) {
      expect(k.x).toBeGreaterThanOrEqual(0);
      expect(k.x).toBeLessThanOrEqual(1);
      expect(k.y).toBeGreaterThanOrEqual(0);
      expect(k.y).toBeLessThanOrEqual(1);
    }
    const nose = kp.keypoints.find((k) => k.name === 'nose');
    const ankle = kp.keypoints.find((k) => k.name === 'left_ankle');
    expect(nose?.y).toBeLessThan(ankle?.y as number);
  });

  test('reports the skeleton edges so a consumer can draw the pose', () => {
    const kp = toKeypoints(skeleton, 'coco17');
    expect(kp.edges.length).toBeGreaterThan(10);
    for (const [a, b] of kp.edges) {
      expect(a).toBeLessThan(kp.keypoints.length);
      expect(b).toBeLessThan(kp.keypoints.length);
    }
  });
});
