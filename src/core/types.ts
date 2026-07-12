import type { Quat } from './quat.js';
import type { Vec3 } from './vec3.js';

export type Side = 'left' | 'right' | 'center';

export type BoneGroup = 'torso' | 'head' | 'arm' | 'leg';

export const BONE_IDS = [
  'pelvis',
  'spine',
  'neck',
  'head',
  'clavicleL',
  'upperArmL',
  'forearmL',
  'handL',
  'clavicleR',
  'upperArmR',
  'forearmR',
  'handR',
  'hipL',
  'thighL',
  'shinL',
  'footL',
  'hipR',
  'thighR',
  'shinR',
  'footR',
] as const;

export type BoneId = (typeof BONE_IDS)[number];

/** A joint is named after the bone it rotates: rotating `forearmL` bends the left elbow. */
export type JointId = BoneId;

export const LANDMARK_IDS = [
  'hipCenter',
  'waist',
  'chest',
  'neckBase',
  'headCenter',
  'headTop',
  'shoulderL',
  'elbowL',
  'wristL',
  'handTipL',
  'shoulderR',
  'elbowR',
  'wristR',
  'handTipR',
  'hipJointL',
  'kneeL',
  'ankleL',
  'toeL',
  'hipJointR',
  'kneeR',
  'ankleR',
  'toeR',
] as const;

export type LandmarkId = (typeof LANDMARK_IDS)[number];

/**
 * A bone in anatomical neutral (standing, arms down, facing +z). The three
 * axes carry the whole sign convention of the format, as data:
 *
 *  - `dir` - the direction the bone points at rest (unit vector)
 *  - `flexAxis` - positive `flex` rotates about this: anatomical flexion
 *    (a knee bends backward, a hip swings forward - each bone's axis says so)
 *  - `abductAxis` - positive `abduct` moves the bone away from the midline
 *    (for center bones: toward the figure's left)
 *  - `twistAxis` - positive `twist` turns about this, along the bone: external
 *    rotation for limbs, turning toward the figure's left for center bones
 *
 * Because the signs live in the axes - and axes mirror as the pseudovectors
 * they are - the right side is an exact mirror of the left and swapping L/R
 * joint values mirrors a pose. No code branches on side anywhere.
 */
export interface BoneDef {
  readonly id: BoneId;
  readonly parent: BoneId | null;
  /** Which end of the parent bone this bone hangs off. */
  readonly attach: 'start' | 'end';
  /** Bone length as a fraction of the figure's stature (1.0 = full height). */
  readonly length: number;
  readonly dir: Vec3;
  readonly flexAxis: Vec3;
  readonly abductAxis: Vec3;
  readonly twistAxis: Vec3;
  readonly side: Side;
  readonly group: BoneGroup;
}

export interface Rig {
  readonly name: string;
  readonly bones: readonly BoneDef[];
}

/** A joint rotation in degrees about the bone's anatomical axes, applied twist, then abduct, then flex. */
export interface JointRotation {
  readonly flex: number;
  readonly abduct: number;
  readonly twist: number;
}

/**
 * What an author may write: the three canonical axes plus their anatomical
 * antonyms - `extend` is negative flexion, `adduct` negative abduction,
 * `internalRotation` negative twist (and `externalRotation` spells the
 * positive one out). Anatomy is spoken in these pairs; the format accepts
 * both directions by name and rejects contradictions.
 */
export interface JointRotationInput {
  readonly flex?: number | undefined;
  readonly extend?: number | undefined;
  readonly abduct?: number | undefined;
  readonly adduct?: number | undefined;
  readonly twist?: number | undefined;
  readonly externalRotation?: number | undefined;
  readonly internalRotation?: number | undefined;
}

/** A scalar is pure flexion - the common case reads like anatomy: "forearmL: 90" bends the elbow. */
export type JointValue = number | JointRotationInput;

/**
 * An absolute bone direction: where the bone points in world space, whatever
 * its parent does. `azimuth` turns from +z (the figure's facing direction)
 * toward +x (the figure's left); `elevation` rises from horizontal (90 = up).
 */
export interface WorldDirection {
  readonly azimuth: number;
  readonly elevation: number;
  readonly twist?: number | undefined;
}

export interface KinematicPose {
  readonly root: {
    readonly position: Vec3;
    /** Degrees. Yaw turns the figure (+ = toward its left), pitch tips it forward, roll cartwheels it. */
    readonly yaw: number;
    readonly pitch: number;
    readonly roll: number;
    readonly scale: number;
  };
  readonly joints: Partial<Record<JointId, JointValue>>;
  readonly world: Partial<Record<JointId, WorldDirection>>;
  /** Translate the solved figure so its lowest point sits on y = 0. */
  readonly grounded: boolean;
}

export interface BoneSegment {
  readonly id: BoneId;
  readonly start: Vec3;
  readonly end: Vec3;
  /** World orientation of the bone's rest frame. */
  readonly orientation: Quat;
  readonly length: number;
  readonly side: Side;
  readonly group: BoneGroup;
}

/** 2D extent in a projected picture plane. */
export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** 3D extent of a solved skeleton. */
export interface Bounds3 {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

export interface Skeleton {
  readonly rig: Rig;
  readonly scale: number;
  readonly bones: Record<BoneId, BoneSegment>;
  readonly landmarks: Record<LandmarkId, Vec3>;
  readonly bounds: Bounds3;
  /** Sole-to-crown extent of the solved figure. */
  readonly height: number;
}
