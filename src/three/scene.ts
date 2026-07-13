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
import { headFrame, NOSE_FORWARD } from '../core/head.js';
import type { BoneId, Skeleton } from '../core/types.js';
import { midpoint3, sub3, len3, type Vec3 } from '../core/vec3.js';
import type { Prop } from '../model/schema.js';
import { buildPropMeshes } from './props.js';

export interface FigureSceneOptions {
  /** Bone capsule color for the right side and the centre; a light theme's ink. */
  readonly color?: string;
  /** The left side renders its own color, so profiles tell left from right. */
  readonly leftColor?: string;
  readonly engaged?: readonly MuscleId[];
  readonly stretched?: readonly MuscleId[];
  /** Props with real 3D geometry (mat, surfboard) join the scene. */
  readonly props?: readonly Prop[];
}

const BONE_RADIUS = 0.016;
const HEAD_RADIUS = 0.055;
const JOINT_RADIUS = 0.02;

/** Fixed tessellation, so the same skeleton always exports identical bytes. */
const CAPSULE_SEGMENTS = { cap: 6, radial: 12 } as const;
const SPHERE_SEGMENTS = { width: 24, height: 16 } as const;

const DEFAULT_COLOR = '#1a1a1a';
const LEFT_COLOR = '#6b6b6b';
const ENGAGED_COLOR = '#c0392b';
const STRETCHED_COLOR = '#2471a3';
/** The back of the skull, so you can tell at a glance which way the figure looks. */
const OCCIPUT_COLOR = '#5c5c5c';

const REST_AXIS = new Vector3(0, 1, 0);

/** Which rig bones a highlighted muscle paints. */
const muscleBones = (ids: readonly MuscleId[]): Set<BoneId> => {
  const bones = new Set<BoneId>();
  for (const id of ids) {
    const base = MUSCLES[id].bone;
    if (base === 'pelvis' || base === 'spine' || base === 'thorax' || base === 'neck' || base === 'head') {
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

interface BoneMeshSpec {
  readonly radius: number;
  readonly mat: MeshStandardMaterial;
  readonly name: string;
}

const alignToAxis = (mesh: Mesh, axis: Vec3): void => {
  mesh.quaternion.copy(
    new Quaternion().setFromUnitVectors(REST_AXIS, new Vector3(axis[0], axis[1], axis[2]).normalize()),
  );
};

const boneMesh = (start: Vec3, end: Vec3, spec: BoneMeshSpec): Mesh => {
  const axis = sub3(end, start);
  const length = len3(axis);
  const geometry = new CapsuleGeometry(
    spec.radius,
    Math.max(length, 1e-6),
    CAPSULE_SEGMENTS.cap,
    CAPSULE_SEGMENTS.radial,
  );
  const mesh = new Mesh(geometry, spec.mat);
  mesh.name = spec.name;
  const mid = midpoint3(start, end);
  mesh.position.set(mid[0], mid[1], mid[2]);
  alignToAxis(mesh, axis);
  return mesh;
};

/**
 * The head, looking where it looks. The whole group takes the head bone's own
 * world orientation, so local +y is the crown and local +z is the face - which
 * means the skull is finally yawed correctly (aligning to the bone axis alone
 * left its spin arbitrary), and the nose and the shaded occiput come for free
 * as two children in that frame. Same nose, same facing, same maths as the 2D
 * drawing: `src/core/head.ts`.
 */
const headMesh = (skeleton: Skeleton, mat: MeshStandardMaterial, shadeMat: MeshStandardMaterial): Group => {
  const frame = headFrame(skeleton);
  const [qx, qy, qz, qw] = skeleton.bones.head.orientation;
  const r = HEAD_RADIUS * skeleton.scale;

  const skull = new Mesh(new SphereGeometry(r, SPHERE_SEGMENTS.width, SPHERE_SEGMENTS.height), mat);
  skull.name = 'head:skull';
  skull.scale.set(0.82, 1.18, 0.9); // An ellipsoid skull, not a ball.

  // The back of the skull, a hemisphere facing away from the nose, a hair proud
  // of the surface so it reads as hair rather than z-fighting with it.
  const occiput = new Mesh(
    new SphereGeometry(r * 1.01, SPHERE_SEGMENTS.width, SPHERE_SEGMENTS.height, Math.PI / 2, Math.PI),
    shadeMat,
  );
  occiput.name = 'head:occiput';
  occiput.scale.copy(skull.scale);

  const nose = new Mesh(new SphereGeometry(r * 0.2, 10, 8), mat);
  nose.name = 'head:nose';
  nose.position.set(0, 0, NOSE_FORWARD * frame.size * 0.85);

  const head = new Group();
  head.name = 'bone:head';
  head.position.set(frame.centre[0], frame.centre[1], frame.centre[2]);
  head.quaternion.set(qx, qy, qz, qw);
  head.add(skull, occiput, nose);
  return head;
};

const addJointSpheres = (
  group: Group,
  skeleton: Skeleton,
  mats: { left: MeshStandardMaterial; base: MeshStandardMaterial },
): void => {
  for (const [id, p] of Object.entries(skeleton.landmarks)) {
    if (id === 'headCenter' || id === 'headTop') continue;
    const joint = new Mesh(new SphereGeometry(JOINT_RADIUS * skeleton.scale, 12, 8), id.endsWith('L') ? mats.left : mats.base);
    joint.name = `joint:${id}`;
    joint.position.set(p[0], p[1], p[2]);
    group.add(joint);
  }
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
  const left = material(options.leftColor ?? LEFT_COLOR);
  const engagedMat = material(ENGAGED_COLOR);
  const stretchedMat = material(STRETCHED_COLOR);
  const engaged = muscleBones(options.engaged ?? []);
  const stretched = muscleBones(options.stretched ?? []);
  const scale = skeleton.scale;

  const materialFor = (id: BoneId, side: 'left' | 'right' | 'center'): MeshStandardMaterial =>
    engaged.has(id) ? engagedMat : stretched.has(id) ? stretchedMat : side === 'left' ? left : base;

  for (const bone of Object.values(skeleton.bones)) {
    if (bone.id === 'head') continue; // The head is a sphere, not a stick.
    group.add(
      boneMesh(bone.start, bone.end, {
        radius: BONE_RADIUS * scale,
        mat: materialFor(bone.id, bone.side),
        name: `bone:${bone.id}`,
      }),
    );
  }

  group.add(headMesh(skeleton, materialFor('head', 'center'), material(OCCIPUT_COLOR)));
  addJointSpheres(group, skeleton, { left, base });
  for (const mesh of buildPropMeshes(options.props ?? [], skeleton)) group.add(mesh);

  return group;
};
