/**
 * Prop geometry in WORLD SPACE, defined once: the three.js scene (viewer,
 * GLB) builds meshes from it and the 2D renderer projects it through the
 * camera. Props are honest 3D objects with configurable dimensions - a yoga
 * mat has a width, a length, a thickness and a yaw; a surfboard has a length,
 * a width, a thickness and a pitch.
 */
import { degToRad } from '../core/angles.js';
import type { LandmarkId, Skeleton } from '../core/types.js';
import type { Vec3 } from '../core/vec3.js';
import type { Prop } from '../model/schema.js';

export type MatProp = Extract<Prop, { type: 'mat' }>;
export type SurfboardProp = Extract<Prop, { type: 'surfboard' }>;

const rotateY = (p: Vec3, deg: number, cx: number, cz: number): Vec3 => {
  const r = degToRad(deg);
  const x = p[0] - cx;
  const z = p[2] - cz;
  return [cx + x * Math.cos(r) + z * Math.sin(r), p[1], cz - x * Math.sin(r) + z * Math.cos(r)];
};

/** The forward arrow's footprint on the mat, as fractions of its width and length. */
const ARROW = { halfWidth: 0.15, tip: 0.94, base: 0.79 } as const;

export interface MatModel {
  readonly centre: Vec3;
  /** Corners of the top face, in world space, starting at the BACK-left and running to the FRONT-left. */
  readonly top: readonly [Vec3, Vec3, Vec3, Vec3];
  /** The front short edge - the end the figure faces (+z at yaw 0). */
  readonly frontEdge: readonly [Vec3, Vec3];
  /** A flat arrow lying on the mat, pointing the way the practice faces. */
  readonly frontArrow: readonly [Vec3, Vec3, Vec3];
  readonly width: number;
  readonly length: number;
  readonly thickness: number;
  readonly yaw: number;
}

/**
 * The mat lies on the floor at its own world position `at` = [x, z]. It is
 * furniture: it does NOT follow the body, because a mat does not slide across
 * the room when you raise an arm. `length` runs along the figure's sagittal
 * axis (+z), `width` across it, `yaw` turns the whole mat (90 = length along
 * x, for wide standing poses). `y` is the TOP surface - the figure stands and
 * lies ON it - so the box extends downward by `thickness`.
 */
export const matModel = (prop: MatProp, _skeleton: Skeleton): MatModel => {
  const [cx, cz] = prop.at;
  const topY = prop.y;
  const hw = prop.width / 2;
  const hl = prop.length / 2;
  // Back edge first (-z), front edge last (+z): the figure faces +z, so corners
  // 2 and 3 are the front of the mat, and every renderer can rely on that.
  const corners: [Vec3, Vec3, Vec3, Vec3] = [
    [cx - hw, topY, cz - hl],
    [cx + hw, topY, cz - hl],
    [cx + hw, topY, cz + hl],
    [cx - hw, topY, cz + hl],
  ];
  const top = corners.map((p) => rotateY(p, prop.yaw, cx, cz)) as [Vec3, Vec3, Vec3, Vec3];

  // An arrow lying flat on the mat, pointing at its front edge. It says which
  // way the practice faces without decorating the mat.
  const aw = prop.width * ARROW.halfWidth;
  const arrow: [Vec3, Vec3, Vec3] = [
    [cx - aw, topY, cz + hl * ARROW.base],
    [cx + aw, topY, cz + hl * ARROW.base],
    [cx, topY, cz + hl * ARROW.tip],
  ];

  return {
    centre: [cx, prop.y - prop.thickness / 2, cz],
    top,
    frontEdge: [top[2], top[3]],
    frontArrow: arrow.map((p) => rotateY(p, prop.yaw, cx, cz)) as [Vec3, Vec3, Vec3],
    width: prop.width,
    length: prop.length,
    thickness: prop.thickness,
    yaw: prop.yaw,
  };
};

export const BOARD_WIDTH_RATIO = 0.19;

/** Board plan outline (shared with the three.js extrusion): +u toward the nose, v across; a template every board scales. */
export const BOARD_PLAN: readonly (readonly [number, number])[] = [
  [0.5, 0],
  [0.225, 0.5],
  [-0.275, 0.5],
  [-0.5, 0.16],
  [-0.5, -0.16],
  [-0.275, -0.5],
  [0.225, -0.5],
];

export interface SurfboardModel {
  readonly centre: Vec3;
  /** Deck outline in world space. */
  readonly outline: readonly Vec3[];
  readonly length: number;
  readonly width: number;
  readonly thickness: number;
  /** Nose-up pitch in degrees. */
  readonly pitch: number;
}

/**
 * The board floats under the named landmarks (usually both ankles), nose
 * toward +z, pitched by `rotation` (positive lifts the nose). `offset` slides
 * it along its own axis and vertically.
 */
export const surfboardModel = (prop: SurfboardProp, skeleton: Skeleton): SurfboardModel => {
  const width = prop.width ?? prop.length * BOARD_WIDTH_RATIO;
  const under = prop.under.map((id: LandmarkId) => skeleton.landmarks[id]);
  // An explicit `at` is [along the practice axis, height]: the board lives on
  // the figure's sagittal line, so "along" is world z.
  const centre: Vec3 =
    prop.at !== undefined
      ? [0, prop.at[1], prop.at[0]]
      : under.length > 0
        ? [
            under.reduce((s, p) => s + p[0], 0) / under.length,
            under.reduce((s, p) => s + p[1], 0) / under.length,
            under.reduce((s, p) => s + p[2], 0) / under.length,
          ]
        : [0, 0, 0]; // no anchor at all: the board sits at the world origin, not wherever the body happens to reach

  const cx = centre[0];
  const cy = centre[1] + prop.offset[1];
  const cz = centre[2] + prop.offset[0];
  const pitch = degToRad(prop.rotation);

  const outline = BOARD_PLAN.map(([u, v]): Vec3 => {
    const along = u * prop.length;
    // Pitch about the board's own x-axis: +rotation lifts the nose.
    return [cx + v * width, cy + along * Math.sin(pitch), cz + along * Math.cos(pitch)];
  });

  return { centre: [cx, cy, cz], outline, length: prop.length, width, thickness: prop.thickness, pitch: prop.rotation };
};
