import { jointQuat, sphereDir } from './joints.js';
import { axisAngleDeg, mulQuat, rotateVec3, rotationTo, yawPitchRollDeg, type Quat } from './quat.js';
import type {
  BoneDef,
  BoneId,
  BoneSegment,
  Bounds3,
  KinematicPose,
  LandmarkId,
  Rig,
  Skeleton,
} from './types.js';
import { add3, midpoint3, scale3, type Vec3 } from './vec3.js';

const assertKnownJoints = (pose: KinematicPose, rig: Rig): void => {
  const known = new Set<string>(rig.bones.map((b) => b.id));
  const names = [...Object.keys(pose.joints), ...Object.keys(pose.world)];
  for (const joint of names) {
    if (!known.has(joint)) {
      throw new Error(`Unknown bone "${joint}". Known bones: ${[...known].sort().join(', ')}`);
    }
  }
};

/** Where a bone begins: the start or the end of the bone it hangs off. */
const originOf = (bone: BoneDef, parent: BoneSegment | null, pose: KinematicPose): Vec3 => {
  if (parent === null) return pose.root.position;
  return bone.attach === 'start' ? parent.start : parent.end;
};

/**
 * A `world` override aims the bone at an absolute direction, whatever its
 * parent does - which is how a human (or a model) actually thinks about a
 * posture: "the front thigh points down and forward", not "rotate the hip 60
 * degrees from neutral". The orientation is the shortest arc from rest, plus
 * any requested twist about the target direction; children hang off it.
 */
const worldOrientation = (bone: BoneDef, target: NonNullable<KinematicPose['world'][BoneId]>): Quat => {
  const dir = sphereDir(target);
  const swing = rotationTo(bone.dir, dir);
  const twist = target.twist ?? 0;
  return twist === 0 ? swing : mulQuat(axisAngleDeg(dir, twist), swing);
};

const solveBone = (
  bone: BoneDef,
  solved: Record<BoneId, BoneSegment>,
  pose: KinematicPose,
  rootQuat: Quat,
): BoneSegment => {
  const parent = bone.parent === null ? null : solved[bone.parent];
  if (bone.parent !== null && parent === undefined) {
    throw new Error(`Bone "${bone.id}" is listed before its parent "${bone.parent}"`);
  }

  const override = pose.world[bone.id];
  const parentQuat = parent === null || parent === undefined ? rootQuat : parent.orientation;
  const orientation =
    override === undefined
      ? mulQuat(parentQuat, jointQuat(bone, pose.joints[bone.id] ?? 0))
      : worldOrientation(bone, override);

  const start = originOf(bone, parent ?? null, pose);
  const length = bone.length * pose.root.scale;

  return {
    id: bone.id,
    start,
    end: add3(start, rotateVec3(orientation, scale3(bone.dir, length))),
    orientation,
    length,
    side: bone.side,
    group: bone.group,
  };
};

const landmarksOf = (b: Record<BoneId, BoneSegment>): Record<LandmarkId, Vec3> => ({
  hipCenter: b.pelvis.start,
  waist: b.pelvis.end,
  chest: b.spine.end,
  neckBase: b.neck.start,
  headCenter: midpoint3(b.head.start, b.head.end),
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

const boundsOf = (points: readonly Vec3[]): Bounds3 => ({
  minX: Math.min(...points.map((p) => p[0])),
  maxX: Math.max(...points.map((p) => p[0])),
  minY: Math.min(...points.map((p) => p[1])),
  maxY: Math.max(...points.map((p) => p[1])),
  minZ: Math.min(...points.map((p) => p[2])),
  maxZ: Math.max(...points.map((p) => p[2])),
});

const lift = (bone: BoneSegment, dy: number): BoneSegment =>
  dy === 0
    ? bone
    : { ...bone, start: add3(bone.start, [0, dy, 0]), end: add3(bone.end, [0, dy, 0]) };

/**
 * Forward kinematics: turn a pose (joint rotations about anatomical axes) into
 * world-space bone segments, named landmarks and bounds. Pure and
 * deterministic - the same pose always yields byte-identical geometry.
 */
export const solveSkeleton = (pose: KinematicPose, rig: Rig): Skeleton => {
  assertKnownJoints(pose, rig);

  const rootQuat = yawPitchRollDeg(pose.root.yaw, pose.root.pitch, pose.root.roll);
  const raw = {} as Record<BoneId, BoneSegment>;
  for (const bone of rig.bones) raw[bone.id] = solveBone(bone, raw, pose, rootQuat);

  const rawPoints = Object.values(raw).flatMap((b) => [b.start, b.end]);
  const dy = pose.grounded ? -boundsOf(rawPoints).minY : 0;

  const bones = Object.fromEntries(
    Object.entries(raw).map(([id, bone]) => [id, lift(bone, dy)]),
  ) as Record<BoneId, BoneSegment>;

  const landmarks = landmarksOf(bones);
  const bounds = boundsOf(Object.values(bones).flatMap((b) => [b.start, b.end]));

  return {
    rig,
    scale: pose.root.scale,
    bones,
    landmarks,
    bounds,
    height: bounds.maxY - bounds.minY,
  };
};
