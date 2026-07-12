import { VIEWS } from './rig.js';
import type { BoneDef, BoneId, BoneSegment, Bounds, KinematicPose, LandmarkId, Rig, Skeleton } from './types.js';
import { add, fromPolar, midpoint, type Vec2 } from './vec2.js';

const boneLength = (bone: BoneDef, pose: KinematicPose): number => {
  const view = VIEWS[pose.view];
  const foreshorten = (bone.lateral ? view.lateralScale : 1) * (bone.foot ? view.footScale : 1);
  return bone.length * foreshorten * pose.root.scale;
};

/**
 * Right-side bones mirror their parent chain, which flips the sign of their
 * rest and joint angles. Directional bones (the feet) point *forward* rather
 * than outward, so they only mirror in views where forward leaves the picture
 * plane - otherwise a side-view figure would walk backwards on one leg.
 */
const sideSign = (bone: BoneDef, pose: KinematicPose): number => {
  if (bone.side !== 'right') return 1;
  if (bone.directional && !VIEWS[pose.view].mirrorDirectional) return 1;
  return -1;
};

const assertKnownJoints = (pose: KinematicPose, rig: Rig): void => {
  const known = new Set<string>(rig.bones.map((b) => b.id));
  for (const joint of Object.keys(pose.joints)) {
    if (!known.has(joint)) {
      throw new Error(`Unknown joint "${joint}". Known joints: ${[...known].sort().join(', ')}`);
    }
  }
};

const solveBones = (pose: KinematicPose, rig: Rig): Record<BoneId, BoneSegment> => {
  const solved = {} as Record<BoneId, BoneSegment>;

  for (const bone of rig.bones) {
    const parent = bone.parent === null ? null : solved[bone.parent];
    if (bone.parent !== null && parent === undefined) {
      throw new Error(`Rig "${rig.name}" lists bone "${bone.id}" before its parent "${bone.parent}"`);
    }

    const parentAngle = parent === null ? pose.root.rotation : parent.worldAngle;
    const start: Vec2 = parent === null ? pose.root.position : bone.attach === 'start' ? parent.start : parent.end;

    const joint = pose.joints[bone.id] ?? 0;
    const worldAngle = parentAngle + sideSign(bone, pose) * (bone.restAngle + joint);
    const length = boneLength(bone, pose);

    solved[bone.id] = {
      id: bone.id,
      start,
      end: add(start, fromPolar(worldAngle, length)),
      worldAngle,
      length,
      side: bone.side,
      group: bone.group,
    };
  }

  return solved;
};

const landmarksOf = (b: Record<BoneId, BoneSegment>): Record<LandmarkId, Vec2> => ({
  hipCenter: b.pelvis.start,
  waist: b.pelvis.end,
  chest: b.spine.end,
  neckBase: b.neck.start,
  headCenter: midpoint(b.head.start, b.head.end),
  headTop: b.head.end,
  shoulderL: b.clavicleL.end,
  elbowL: b.upperArmL.end,
  wristL: b.forearmL.end,
  handTipL: b.handL.end,
  shoulderR: b.clavicleR.end,
  elbowR: b.upperArmR.end,
  wristR: b.forearmR.end,
  handTipR: b.handR.end,
  hipJointL: b.hipL.end,
  kneeL: b.thighL.end,
  ankleL: b.shinL.end,
  toeL: b.footL.end,
  hipJointR: b.hipR.end,
  kneeR: b.thighR.end,
  ankleR: b.shinR.end,
  toeR: b.footR.end,
});

const boundsOf = (points: readonly Vec2[]): Bounds => ({
  minX: Math.min(...points.map((p) => p[0])),
  maxX: Math.max(...points.map((p) => p[0])),
  minY: Math.min(...points.map((p) => p[1])),
  maxY: Math.max(...points.map((p) => p[1])),
});

const transformPoint = (p: Vec2, dy: number, flip: boolean): Vec2 => [flip ? -p[0] : p[0], p[1] + dy];

const transformBone = (bone: BoneSegment, dy: number, flip: boolean): BoneSegment => ({
  ...bone,
  start: transformPoint(bone.start, dy, flip),
  end: transformPoint(bone.end, dy, flip),
  worldAngle: flip ? 180 - bone.worldAngle : bone.worldAngle,
});

/**
 * Forward kinematics: turn a pose (joint angles) into world-space bone segments,
 * named landmarks and bounds. Pure and deterministic - the same pose always
 * yields byte-identical geometry.
 */
export const solveSkeleton = (pose: KinematicPose, rig: Rig): Skeleton => {
  assertKnownJoints(pose, rig);

  const raw = solveBones(pose, rig);
  const rawPoints = Object.values(raw).flatMap((b) => [b.start, b.end]);
  const dy = pose.grounded ? -boundsOf(rawPoints).minY : 0;
  const flip = pose.flip ?? false;

  const bones = Object.fromEntries(
    Object.entries(raw).map(([id, bone]) => [id, transformBone(bone, dy, flip)]),
  ) as Record<BoneId, BoneSegment>;

  const landmarks = landmarksOf(bones);
  const bounds = boundsOf(Object.values(bones).flatMap((b) => [b.start, b.end]));

  return {
    rig,
    view: pose.view,
    scale: pose.root.scale,
    bones,
    landmarks,
    bounds,
    height: bounds.maxY - bounds.minY,
  };
};
