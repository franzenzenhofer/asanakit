/**
 * Skeleton -> three.js scene graph. One shared module builds the figure for
 * BOTH consumers: the GLB exporter running in Node and the interactive viewer
 * running in a browser. three's scene-graph math is pure JavaScript, so no
 * GPU or DOM is needed here.
 */
import {
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { MUSCLES, type MuscleId } from '../anatomy/muscles.js';
import type { BoneId, Skeleton } from '../core/types.js';
import { midpoint3, sub3, len3, type Vec3 } from '../core/vec3.js';

export interface FigureSceneOptions {
  /** Bone capsule color; a light theme's ink. */
  readonly color?: string;
  readonly engaged?: readonly MuscleId[];
  readonly stretched?: readonly MuscleId[];
}

const BONE_RADIUS = 0.016;
const HEAD_RADIUS = 0.055;
const JOINT_RADIUS = 0.02;

/** Fixed tessellation, so the same skeleton always exports identical bytes. */
const CAPSULE_SEGMENTS = { cap: 6, radial: 12 } as const;
const SPHERE_SEGMENTS = { width: 24, height: 16 } as const;

const DEFAULT_COLOR = '#1a1a1a';
const ENGAGED_COLOR = '#c0392b';
const STRETCHED_COLOR = '#2471a3';

const REST_AXIS = new Vector3(0, 1, 0);

/** Which rig bones a highlighted muscle paints. */
const muscleBones = (ids: readonly MuscleId[]): Set<BoneId> => {
  const bones = new Set<BoneId>();
  for (const id of ids) {
    const base = MUSCLES[id].bone;
    if (base === 'pelvis' || base === 'spine' || base === 'neck' || base === 'head') {
      bones.add(base);
    } else {
      bones.add(`${base}L` as BoneId);
      bones.add(`${base}R` as BoneId);
    }
  }
  return bones;
};

const material = (color: string): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness: 0.65, metalness: 0 });

const boneMesh = (
  start: Vec3,
  end: Vec3,
  radius: number,
  mat: MeshStandardMaterial,
  name: string,
): Mesh => {
  const axis = sub3(end, start);
  const length = len3(axis);
  const geometry = new CapsuleGeometry(radius, Math.max(length, 1e-6), CAPSULE_SEGMENTS.cap, CAPSULE_SEGMENTS.radial);
  const mesh = new Mesh(geometry, mat);
  mesh.name = name;
  const mid = midpoint3(start, end);
  mesh.position.set(mid[0], mid[1], mid[2]);
  mesh.quaternion.copy(
    new Quaternion().setFromUnitVectors(REST_AXIS, new Vector3(axis[0], axis[1], axis[2]).normalize()),
  );
  return mesh;
};

/**
 * Build the stick figure as a group of capsules and spheres, y-up, feet on
 * y = 0, about one unit tall - exactly the solver's world space, so the GLB
 * and the viewer agree with every SVG projection of the same skeleton.
 */
export const buildFigureScene = (skeleton: Skeleton, options: FigureSceneOptions = {}): Group => {
  const group = new Group();
  group.name = 'asanakit-figure';

  const base = material(options.color ?? DEFAULT_COLOR);
  const engagedMat = material(ENGAGED_COLOR);
  const stretchedMat = material(STRETCHED_COLOR);
  const engaged = muscleBones(options.engaged ?? []);
  const stretched = muscleBones(options.stretched ?? []);
  const scale = skeleton.scale;

  for (const bone of Object.values(skeleton.bones)) {
    if (bone.id === 'head') continue; // The head is a sphere, not a stick.
    const mat = engaged.has(bone.id) ? engagedMat : stretched.has(bone.id) ? stretchedMat : base;
    group.add(boneMesh(bone.start, bone.end, BONE_RADIUS * scale, mat, `bone:${bone.id}`));
  }

  const head = new Mesh(
    new SphereGeometry(HEAD_RADIUS * scale, SPHERE_SEGMENTS.width, SPHERE_SEGMENTS.height),
    engaged.has('head') ? engagedMat : base,
  );
  head.name = 'bone:head';
  const centre = skeleton.landmarks.headCenter;
  head.position.set(centre[0], centre[1], centre[2]);
  const headBone = skeleton.bones.head;
  const axis = sub3(headBone.end, headBone.start);
  head.quaternion.copy(
    new Quaternion().setFromUnitVectors(REST_AXIS, new Vector3(axis[0], axis[1], axis[2]).normalize()),
  );
  head.scale.set(0.82, 1.18, 0.9); // An ellipsoid skull, not a ball.
  group.add(head);

  const jointMat = base;
  for (const [id, p] of Object.entries(skeleton.landmarks)) {
    if (id === 'headCenter' || id === 'headTop') continue;
    const joint = new Mesh(new SphereGeometry(JOINT_RADIUS * scale, 12, 8), jointMat);
    joint.name = `joint:${id}`;
    joint.position.set(p[0], p[1], p[2]);
    group.add(joint);
  }

  return group;
};
