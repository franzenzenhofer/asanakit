/**
 * Export a solved skeleton as keypoints in the two standard layouts, so asanakit
 * output can feed anything that already speaks pose-estimation data.
 *
 * The landmark NAMES and EDGE lists below restate the public layouts of
 * MediaPipe BlazePose (33) and COCO (17), as published in the Apache-2.0
 * licensed tfjs-models / mediapipe projects. Only the layout is reused; the
 * geometry is asanakit's own - and since the rig is 3D, every keypoint carries
 * a real z (MediaPipe convention: hip-relative, negative toward the camera).
 */
import { axisAngleDeg, rotateVec3 } from '../core/quat.js';
import type { Skeleton } from '../core/types.js';
import { add3, lerp3, normalize3, scale3, sub3, type Vec3 } from '../core/vec3.js';

export const MEDIAPIPE_33 = [
  'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer', 'right_eye_inner', 'right_eye', 'right_eye_outer',
  'left_ear', 'right_ear', 'mouth_left', 'mouth_right',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist',
  'left_pinky', 'right_pinky', 'left_index', 'right_index', 'left_thumb', 'right_thumb',
  'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
  'left_heel', 'right_heel', 'left_foot_index', 'right_foot_index',
] as const;

export const COCO_17 = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist',
  'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
] as const;

const COCO_EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [0, 2], [1, 3], [2, 4], [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
];

const MEDIAPIPE_EDGES: readonly (readonly [number, number])[] = [
  [0, 2], [0, 5], [2, 7], [5, 8], [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [27, 31],
  [24, 26], [26, 28], [28, 30], [28, 32],
];

export type KeypointFormat = 'mediapipe33' | 'coco17';

export interface Keypoint {
  readonly index: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface KeypointSet {
  readonly format: KeypointFormat;
  readonly space: 'stature' | 'normalized';
  readonly keypoints: readonly Keypoint[];
  readonly edges: readonly (readonly [number, number])[];
}

export interface KeypointOptions {
  /** Emit image coordinates: 0..1 across the pose bounds, y pointing down, z hip-relative. */
  readonly normalize?: boolean;
}

/**
 * The rig has no facial bones, so eyes, ears and mouth are derived from the
 * head bone's frame. They are approximations by construction - honest ones,
 * and enough for a consumer that only needs head orientation.
 */
const facePoints = (skeleton: Skeleton): Record<string, Vec3> => {
  const head = skeleton.bones.head;
  const q = head.orientation;
  const up = rotateVec3(q, [0, 1, 0]);
  const forward = rotateVec3(q, [0, 0, 1]);
  const left = rotateVec3(q, [1, 0, 0]);
  const centre = lerp3(head.start, head.end, 0.55);
  const size = head.length;

  const at = (fwd: number, rise: number, side: number): Vec3 =>
    add3(add3(add3(centre, scale3(forward, fwd * size)), scale3(up, rise * size)), scale3(left, side * size));

  return {
    nose: at(0.42, 0, 0),
    left_eye: at(0.3, 0.12, 0.08),
    left_eye_inner: at(0.32, 0.12, 0.03),
    left_eye_outer: at(0.26, 0.12, 0.14),
    right_eye: at(0.3, 0.12, -0.08),
    right_eye_inner: at(0.32, 0.12, -0.03),
    right_eye_outer: at(0.26, 0.12, -0.14),
    left_ear: at(-0.1, 0.06, 0.22),
    right_ear: at(-0.1, 0.06, -0.22),
    mouth_left: at(0.3, -0.18, 0.09),
    mouth_right: at(0.3, -0.18, -0.09),
  };
};

const heel = (skeleton: Skeleton, side: 'L' | 'R'): Vec3 => {
  const foot = skeleton.bones[side === 'L' ? 'footL' : 'footR'];
  const dir = normalize3(sub3(foot.end, foot.start));
  return add3(foot.start, scale3(dir, -foot.length * 0.35));
};

/** Pinky and thumb fan out from the wrist around the hand's own forward axis. */
const hand = (skeleton: Skeleton, side: 'L' | 'R', spread: number): Vec3 => {
  const h = skeleton.bones[side === 'L' ? 'handL' : 'handR'];
  const dir = normalize3(sub3(h.end, h.start));
  const axis = rotateVec3(h.orientation, [0, 0, 1]);
  return add3(h.end, scale3(rotateVec3(axisAngleDeg(axis, spread), dir), h.length * 0.3));
};

const pointFor = (name: string, skeleton: Skeleton, face: Record<string, Vec3>): Vec3 => {
  const l = skeleton.landmarks;
  const table: Record<string, Vec3> = {
    left_shoulder: l.shoulderL,
    right_shoulder: l.shoulderR,
    left_elbow: l.elbowL,
    right_elbow: l.elbowR,
    left_wrist: l.wristL,
    right_wrist: l.wristR,
    left_index: l.handTipL,
    right_index: l.handTipR,
    left_pinky: hand(skeleton, 'L', 55),
    right_pinky: hand(skeleton, 'R', 55),
    left_thumb: hand(skeleton, 'L', -55),
    right_thumb: hand(skeleton, 'R', -55),
    left_hip: l.hipJointL,
    right_hip: l.hipJointR,
    left_knee: l.kneeL,
    right_knee: l.kneeR,
    left_ankle: l.ankleL,
    right_ankle: l.ankleR,
    left_foot_index: l.toeL,
    right_foot_index: l.toeR,
    left_heel: heel(skeleton, 'L'),
    right_heel: heel(skeleton, 'R'),
  };
  const point = table[name] ?? face[name];
  if (point === undefined) throw new Error(`No geometry for keypoint "${name}"`);
  return point;
};

export const toKeypoints = (
  skeleton: Skeleton,
  format: KeypointFormat,
  options: KeypointOptions = {},
): KeypointSet => {
  const names: readonly string[] = format === 'coco17' ? COCO_17 : MEDIAPIPE_33;
  const face = facePoints(skeleton);
  const raw = names.map((name) => pointFor(name, skeleton, face));

  const normalize = options.normalize === true;
  const xs = raw.map((p) => p[0]);
  const ys = raw.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY, 1e-6);
  const hipZ = skeleton.landmarks.hipCenter[2];

  return {
    format,
    space: normalize ? 'normalized' : 'stature',
    edges: format === 'coco17' ? COCO_EDGES : MEDIAPIPE_EDGES,
    keypoints: names.map((name, index) => {
      const p = raw[index] as Vec3;
      return {
        index,
        name,
        // Image space is y-down, so normalising also flips that axis; z stays
        // hip-relative and negative toward the camera, as MediaPipe reports it.
        x: normalize ? (p[0] - minX) / span : p[0],
        y: normalize ? 1 - (p[1] - minY) / span : p[1],
        z: normalize ? -(p[2] - hipZ) / span : p[2],
      };
    }),
  };
};
