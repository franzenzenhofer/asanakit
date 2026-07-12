/**
 * 2D point/vector helpers on top of gl-matrix (MIT).
 *
 * Conventions:
 *  - math coordinates: x right, y up, angles in degrees CCW from +x
 *  - points are plain `[x, y]` tuples, which d3-shape path generators consume directly
 *  - the single y-flip into SVG space happens in the renderer's projection step
 */
import { glMatrix, vec2 as gl } from 'gl-matrix';
import { degToRad, radToDeg } from './angles.js';

// Float64 instead of gl-matrix's default Float32: poses are authored in degrees
// and small rounding drift is visible once a limb chain is five bones deep.
glMatrix.setMatrixArrayType(Array);

export type Vec2 = readonly [number, number];

const out = (): [number, number] => [0, 0];

export const vec = (x: number, y: number): Vec2 => [x, y];

export const x = (v: Vec2): number => v[0];
export const y = (v: Vec2): number => v[1];

export const add = (a: Vec2, b: Vec2): Vec2 => gl.add(out(), a, b) as [number, number];

export const sub = (a: Vec2, b: Vec2): Vec2 => gl.sub(out(), a, b) as [number, number];

export const scale = (a: Vec2, k: number): Vec2 => gl.scale(out(), a, k) as [number, number];

export const len = (a: Vec2): number => gl.length(a);

export const dist = (a: Vec2, b: Vec2): number => gl.dist(a, b);

export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => gl.lerp(out(), a, b, t) as [number, number];

export const midpoint = (a: Vec2, b: Vec2): Vec2 => lerp(a, b, 0.5);

export const rotate = (a: Vec2, angleDeg: number, origin: Vec2 = [0, 0]): Vec2 =>
  gl.rotate(out(), a, origin, degToRad(angleDeg)) as [number, number];

export const fromPolar = (angleDeg: number, length: number): Vec2 => {
  const r = degToRad(angleDeg);
  return [Math.cos(r) * length, Math.sin(r) * length];
};

export const angleOf = (a: Vec2): number => radToDeg(Math.atan2(a[1], a[0]));

/** Unit vector perpendicular to a->b, rotated +90 degrees (to its left). */
export const normalLeft = (a: Vec2, b: Vec2): Vec2 => {
  const d = sub(b, a);
  const l = len(d);
  if (l === 0) return [0, 0];
  return [-d[1] / l, d[0] / l];
};

/** Point at `t` along a->b, offset sideways by `offset` (left-positive). */
export const along = (a: Vec2, b: Vec2, t: number, offset = 0): Vec2 =>
  offset === 0 ? lerp(a, b, t) : add(lerp(a, b, t), scale(normalLeft(a, b), offset));
