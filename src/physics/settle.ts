import { mulQuat, rotateVec3, type Quat } from '../core/quat.js';
import type { BoneId, BoneSegment, Bounds3, LandmarkId, Skeleton } from '../core/types.js';
import { add3, len3, midpoint3, normalize3, scale3, sub3, type Vec3 } from '../core/vec3.js';
import type { RapierApi, RapierQuaternion } from './rapier-types.js';
import { rapier } from './world.js';

/**
 * Realistic positioning, when necessary: drop the solved figure onto the
 * ground plane and let a mature physics engine (Rapier) find where it rests.
 *
 * The whole skeleton is ONE compound rigid body - a capsule per bone, a ball
 * for the head - so the authored pose is preserved exactly; only the figure's
 * position and orientation change. That is precisely what the kinematic
 * grounding (translate min-y to 0) gets wrong when the lowest vertex is not a
 * real support surface.
 *
 * Determinism: fixed timestep, fixed iteration order, a fresh world per call.
 * Rapier is run-to-run deterministic on the same machine; settled output is
 * never byte-compared across machines.
 */
const BONE_RADIUS = 0.016;
const HEAD_RADIUS = 0.055;

/**
 * A foot's support is its sole, not the ankle-to-toe bone: that bone slopes,
 * and a figure standing on nothing but its toe caps tips straight over. The
 * collider therefore runs from a heel point - below and behind the ankle, in
 * the foot's own frame - to the toe, flat along the sole.
 */
const HEEL_LOCAL: Vec3 = [0, -0.031, -0.03];

const TIMESTEP = 1 / 240;
const MAX_STEPS = 2400;
const DROP_HEIGHT = 0.01;

const quatOf = (from: Vec3, to: Vec3, R: RapierApi): RapierQuaternion => {
  // Rapier wants the rotation aligning its capsule axis (+y) with the bone.
  const axis: Vec3 = [0, 1, 0];
  const dir = normalize3(sub3(to, from));
  const cross: Vec3 = [
    axis[1] * dir[2] - axis[2] * dir[1],
    axis[2] * dir[0] - axis[0] * dir[2],
    axis[0] * dir[1] - axis[1] * dir[0],
  ];
  const dot = axis[0] * dir[0] + axis[1] * dir[1] + axis[2] * dir[2];
  if (dot < -0.999999) return new R.Quaternion(1, 0, 0, 0); // 180° about x
  const w = 1 + dot;
  const n = Math.hypot(cross[0], cross[1], cross[2], w);
  return new R.Quaternion(cross[0] / n, cross[1] / n, cross[2] / n, w / n);
};

const footSpan = (bone: BoneSegment, scale: number): { start: Vec3; end: Vec3 } => ({
  start: add3(bone.start, rotateVec3(bone.orientation, scale3(HEEL_LOCAL, scale))),
  end: bone.end,
});

const transformPoint = (p: Vec3, rotation: Quat, translation: Vec3): Vec3 =>
  add3(rotateVec3(rotation, p), translation);

const boundsOf = (points: readonly Vec3[]): Bounds3 => ({
  minX: Math.min(...points.map((p) => p[0])),
  maxX: Math.max(...points.map((p) => p[0])),
  minY: Math.min(...points.map((p) => p[1])),
  maxY: Math.max(...points.map((p) => p[1])),
  minZ: Math.min(...points.map((p) => p[2])),
  maxZ: Math.max(...points.map((p) => p[2])),
});

/** Apply the settled rigid-body transform back onto the pure skeleton. */
const transformSkeleton = (skeleton: Skeleton, rotation: Quat, translation: Vec3): Skeleton => {
  const bones = Object.fromEntries(
    Object.entries(skeleton.bones).map(([id, bone]) => [
      id,
      {
        ...bone,
        start: transformPoint(bone.start, rotation, translation),
        end: transformPoint(bone.end, rotation, translation),
        orientation: mulQuat(rotation, bone.orientation),
      },
    ]),
  ) as Record<BoneId, BoneSegment>;

  const landmarks = Object.fromEntries(
    Object.entries(skeleton.landmarks).map(([id, p]) => [id, transformPoint(p, rotation, translation)]),
  ) as Record<LandmarkId, Vec3>;

  const bounds = boundsOf(Object.values(bones).flatMap((b) => [b.start, b.end]));
  return { ...skeleton, bones, landmarks, bounds, height: bounds.maxY - bounds.minY };
};

export const settleSkeleton = async (skeleton: Skeleton): Promise<Skeleton> => {
  const R = await rapier();
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = TIMESTEP;

  // The floor: a static half-space would do, but a wide thin box keeps every
  // solver code path in the well-trodden convex-vs-convex case.
  const ground = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.05, 0));
  world.createCollider(R.ColliderDesc.cuboid(50, 0.05, 50).setFriction(0.9), ground);

  const body = world.createRigidBody(
    R.RigidBodyDesc.dynamic()
      .setTranslation(0, DROP_HEIGHT, 0)
      .setLinearDamping(0.15)
      .setAngularDamping(0.4),
  );

  const scale = skeleton.scale;
  for (const bone of Object.values(skeleton.bones)) {
    if (bone.id === 'head') continue;
    const span = bone.id === 'footL' || bone.id === 'footR' ? footSpan(bone, scale) : bone;
    const mid = midpoint3(span.start, span.end);
    const half = len3(sub3(span.end, span.start)) / 2;
    world.createCollider(
      R.ColliderDesc.capsule(Math.max(half, 1e-4), BONE_RADIUS * scale)
        .setTranslation(mid[0], mid[1], mid[2])
        .setRotation(quatOf(span.start, span.end, R))
        .setFriction(0.9)
        .setRestitution(0),
      body,
    );
  }
  const head = skeleton.landmarks.headCenter;
  world.createCollider(
    R.ColliderDesc.ball(HEAD_RADIUS * scale).setTranslation(head[0], head[1], head[2]).setFriction(0.9).setRestitution(0),
    body,
  );

  for (let i = 0; i < MAX_STEPS && !body.isSleeping(); i++) world.step();

  const t = body.translation();
  const r = body.rotation();
  world.free();

  return transformSkeleton(skeleton, [r.x, r.y, r.z, r.w], [t.x, t.y, t.z]);
};
