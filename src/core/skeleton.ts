import { VIEWS } from './rig.js';
import type {
  BoneDef,
  BoneId,
  BoneSegment,
  Bounds,
  KinematicPose,
  LandmarkId,
  Rig,
  Skeleton,
  ViewId,
} from './types.js';
import { add, fromPolar, midpoint, type Vec2 } from './vec2.js';

const boneLength = (bone: BoneDef, pose: KinematicPose): number => {
  const view = VIEWS[pose.view];
  const foreshorten = (bone.lateral ? view.lateralScale : 1) * (bone.foot ? view.footScale : 1);
  return bone.length * foreshorten * pose.root.scale;
};

/**
 * Which way a positive angle turns a right-side bone.
 *
 * Lateral bones (clavicle, hip) always mirror - that is what puts the right
 * shoulder on the other side of the spine. Limbs only mirror when the figure
 * faces us; in profile both arms swing the same way, because we are looking at
 * both of them from the same side.
 */
export const sideSign = (bone: BoneDef, view: ViewId): number => {
  if (bone.side !== 'right') return 1;
  if (bone.lateral === true) return -1;
  return VIEWS[view].mirrorLimbs ? -1 : 1;
};

/**
 * Where the left/right offset points on screen.
 *
 * Facing the viewer it lies in the picture plane, so it swings with the torso: a
 * tilted chest tilts the shoulder line. Seen from the side it points into the
 * screen, so it must project as a small sideways nudge and nothing else - if it
 * rotated with the torso, a figure in a horizontal plank would end up with one
 * shoulder above the other and one hand hovering off the floor.
 */
const isDepthAxis = (bone: BoneDef, view: ViewId): boolean =>
  bone.lateral === true && VIEWS[view].lateralScale < 1;

const relativeAngle = (bone: BoneDef, pose: KinematicPose, parentAngle: number, joint: number): number => {
  if (isDepthAxis(bone, pose.view)) return bone.side === 'right' ? 180 : 0;
  return parentAngle + sideSign(bone, pose.view) * (bone.restAngle + joint);
};

const assertKnownJoints = (pose: KinematicPose, rig: Rig): void => {
  const known = new Set<string>(rig.bones.map((b) => b.id));
  const names = [...Object.keys(pose.joints), ...Object.keys(pose.world ?? {})];
  for (const joint of names) {
    if (!known.has(joint)) {
      throw new Error(`Unknown bone "${joint}". Known bones: ${[...known].sort().join(', ')}`);
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

    const aimedAt = bone.angleParent === undefined ? parent : solved[bone.angleParent];
    const parentAngle = aimedAt === null || aimedAt === undefined ? pose.root.rotation : aimedAt.worldAngle;
    const start: Vec2 = parent === null ? pose.root.position : bone.attach === 'start' ? parent.start : parent.end;

    const absolute = pose.world?.[bone.id];
    const joint = (pose.joints[bone.id] ?? 0) * (bone.flexSign ?? 1);
    const worldAngle = absolute ?? relativeAngle(bone, pose, parentAngle, joint);
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
