/**
 * Prop geometry in WORLD SPACE, defined once: the three.js scene (viewer,
 * GLB) builds meshes from it and the 2D renderer projects it through the
 * camera. Props are honest 3D objects with configurable dimensions - a yoga
 * mat has a width, a length, a thickness and a yaw; a surfboard has a length,
 * a width, a thickness and a pitch.
 */
import { degToRad } from '../core/angles.js';
import type { Bounds3, LandmarkId, Skeleton } from '../core/types.js';
import type { Vec3 } from '../core/vec3.js';
import type { Prop } from '../model/schema.js';

export type MatProp = Extract<Prop, { type: 'mat' }>;
export type SurfboardProp = Extract<Prop, { type: 'surfboard' }>;

const centreOf = (bounds: Bounds3): [number, number] => [
  (bounds.minX + bounds.maxX) / 2,
  (bounds.minZ + bounds.maxZ) / 2,
];

const rotateY = (p: Vec3, deg: number, cx: number, cz: number): Vec3 => {
  const r = degToRad(deg);
  const x = p[0] - cx;
  const z = p[2] - cz;
  return [cx + x * Math.cos(r) + z * Math.sin(r), p[1], cz - x * Math.sin(r) + z * Math.cos(r)];
};

export interface MatModel {
  readonly centre: Vec3;
  /** Corners of the top face, in world space. */
  readonly top: readonly [Vec3, Vec3, Vec3, Vec3];
  readonly width: number;
  readonly length: number;
  readonly thickness: number;
  readonly yaw: number;
}

/**
 * The mat lies on the floor under the figure's footprint centre: `length`
 * runs along the figure's sagittal axis (+z), `width` across it, `yaw` turns
 * the whole mat (90 = length along x, for wide standing poses). `y` is the
 * TOP surface - the figure stands and lies ON it - so the box extends
 * downward by `thickness`.
 */
export const matModel = (prop: MatProp, skeleton: Skeleton): MatModel => {
  const [cx, cz] = centreOf(skeleton.bounds);
  const topY = prop.y;
  const hw = prop.width / 2;
  const hl = prop.length / 2;
  const corners: [Vec3, Vec3, Vec3, Vec3] = [
    [cx - hw, topY, cz - hl],
    [cx + hw, topY, cz - hl],
    [cx + hw, topY, cz + hl],
    [cx - hw, topY, cz + hl],
  ];
  return {
    centre: [cx, prop.y - prop.thickness / 2, cz],
    top: corners.map((p) => rotateY(p, prop.yaw, cx, cz)) as [Vec3, Vec3, Vec3, Vec3],
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
        : [0, 0, (skeleton.bounds.minZ + skeleton.bounds.maxZ) / 2];

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
