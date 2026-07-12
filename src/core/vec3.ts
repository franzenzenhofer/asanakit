/**
 * 3D point/vector helpers on top of gl-matrix (MIT).
 *
 * Conventions:
 *  - math coordinates: x = the figure's anatomical left, y = up, z = the
 *    direction the figure faces in anatomical neutral (toward the front camera)
 *  - points are plain `[x, y, z]` tuples
 *  - angles cross the API in degrees; radians live only inside gl-matrix calls
 */
import { glMatrix, vec3 as gl } from 'gl-matrix';

// Float64 instead of gl-matrix's default Float32: poses are authored in degrees
// and small rounding drift is visible once a limb chain is five bones deep.
glMatrix.setMatrixArrayType(Array);

export type Vec3 = readonly [number, number, number];

const out = (): [number, number, number] => [0, 0, 0];

export const vec3 = (x: number, y: number, z: number): Vec3 => [x, y, z];

export const add3 = (a: Vec3, b: Vec3): Vec3 => gl.add(out(), a, b) as [number, number, number];

export const sub3 = (a: Vec3, b: Vec3): Vec3 => gl.sub(out(), a, b) as [number, number, number];

export const scale3 = (a: Vec3, k: number): Vec3 => gl.scale(out(), a, k) as [number, number, number];

export const len3 = (a: Vec3): number => gl.length(a);

export const dist3 = (a: Vec3, b: Vec3): number => gl.dist(a, b);

export const dot3 = (a: Vec3, b: Vec3): number => gl.dot(a, b);

export const cross3 = (a: Vec3, b: Vec3): Vec3 => gl.cross(out(), a, b) as [number, number, number];

export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => gl.lerp(out(), a, b, t) as [number, number, number];

export const midpoint3 = (a: Vec3, b: Vec3): Vec3 => lerp3(a, b, 0.5);

export const normalize3 = (a: Vec3): Vec3 => gl.normalize(out(), a) as [number, number, number];
