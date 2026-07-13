/**
 * Quaternion helpers on top of gl-matrix (MIT). Quaternions never appear in
 * pose files - YAML speaks degrees about anatomical axes - but every rotation
 * inside the solver is one of these.
 */
import { quat as gl, vec3 as glv } from 'gl-matrix';
import { degToRad } from './angles.js';
import { normalize3, type Vec3 } from './vec3.js';

export type Quat = readonly [number, number, number, number];

export const QUAT_IDENTITY: Quat = [0, 0, 0, 1];

const out = (): [number, number, number, number] => [0, 0, 0, 1];

/** Rotation of `deg` degrees about `axis` (right-hand rule; axis need not be unit). */
export const axisAngleDeg = (axis: Vec3, deg: number): Quat =>
  gl.setAxisAngle(out(), normalize3(axis), degToRad(deg)) as [number, number, number, number];

/** `a` after `b`: the combined rotation applies `b` first, then `a`. */
export const mulQuat = (a: Quat, b: Quat): Quat => gl.multiply(out(), a, b) as [number, number, number, number];

/** The inverse rotation. (Unit quaternions only - which is all of them here.) */
export const conjugateQuat = (q: Quat): Quat => gl.conjugate(out(), q) as [number, number, number, number];

export const rotateVec3 = (q: Quat, v: Vec3): Vec3 =>
  glv.transformQuat([0, 0, 0], v, q) as [number, number, number];

/** Shortest-arc rotation taking unit vector `from` onto unit vector `to`. */
export const rotationTo = (from: Vec3, to: Vec3): Quat =>
  gl.rotationTo(out(), normalize3(from), normalize3(to)) as [number, number, number, number];

/**
 * Root orientation from yaw/pitch/roll in degrees, applied roll first, then
 * pitch, then yaw: yaw turns about +y (positive faces the figure toward its
 * left), pitch tips forward about +x (positive leans toward +z), roll
 * cartwheels about +z (positive drops the figure toward its left).
 */
export const yawPitchRollDeg = (yaw: number, pitch: number, roll: number): Quat =>
  mulQuat(axisAngleDeg([0, 1, 0], yaw), mulQuat(axisAngleDeg([1, 0, 0], pitch), axisAngleDeg([0, 0, 1], roll)));
