import { degToRad } from './angles.js';
import { axisAngleDeg, mulQuat, QUAT_IDENTITY, type Quat } from './quat.js';
import type { BoneDef, JointRotation, JointValue, WorldDirection } from './types.js';
import type { Vec3 } from './vec3.js';

const NEUTRAL: JointRotation = { flex: 0, abduct: 0, twist: 0 };

/**
 * A scalar joint value is pure flexion; an object fills in what it names.
 * Anatomical antonyms fold onto the canonical axes: extension is negative
 * flexion, adduction negative abduction, internal rotation negative twist.
 */
export const normalizeJoint = (value: JointValue): JointRotation => {
  if (typeof value === 'number') return { ...NEUTRAL, flex: value };
  return {
    flex: (value.flex ?? 0) - (value.extend ?? 0),
    abduct: (value.abduct ?? 0) - (value.adduct ?? 0),
    twist: (value.twist ?? 0) + (value.externalRotation ?? 0) - (value.internalRotation ?? 0),
  };
};

/**
 * The rotation a joint value applies to its bone, about the bone's anatomical
 * axes in the rest frame: twist first (along the bone), then abduction, then
 * flexion.
 */
export const jointQuat = (bone: BoneDef, value: JointValue): Quat => {
  const j = normalizeJoint(value);
  if (j.flex === 0 && j.abduct === 0 && j.twist === 0) return QUAT_IDENTITY;
  return mulQuat(
    axisAngleDeg(bone.flexAxis, j.flex),
    mulQuat(axisAngleDeg(bone.abductAxis, j.abduct), axisAngleDeg(bone.twistAxis, j.twist)),
  );
};

/**
 * The unit direction a `world` override names: azimuth turns from +z (the
 * figure's facing direction) toward +x (the figure's left), elevation rises
 * from horizontal.
 */
export const sphereDir = (world: WorldDirection): Vec3 => {
  const az = degToRad(world.azimuth);
  const el = degToRad(world.elevation);
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
};
