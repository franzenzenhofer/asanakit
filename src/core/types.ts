import type { Vec2 } from './vec2.js';

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

export interface BoneDef {
  readonly id: BoneId;
  readonly parent: BoneId | null;
  /** Which end of the parent bone this bone hangs off. */
  readonly attach: 'start' | 'end';
  /**
   * The bone whose direction this bone's rest angle is measured against, when
   * that differs from the bone it hangs off. An upper arm *attaches* to the
   * clavicle (which points sideways) but *aims* relative to the spine - keeping
   * the two apart is what stops a profile figure's right arm pointing skyward.
   */
  readonly angleParent?: BoneId;
  /** Bone length as a fraction of the figure's stature (1.0 = full height). */
  readonly length: number;
  /** Angle in degrees relative to the parent bone's direction, in the neutral standing pose. */
  readonly restAngle: number;
  readonly side: Side;
  readonly group: BoneGroup;
  /** Lateral bones (clavicle, hip) foreshorten as the figure turns away from the viewer. */
  readonly lateral?: boolean;
  /** Foot bones foreshorten in front/back views. */
  readonly foot?: boolean;
  /**
   * Which way a positive joint value bends this bone. -1 for the shin, so that
   * "shinL: 90" means the knee is flexed 90 degrees - the way a knee actually
   * bends - rather than hyperextended by 90.
   */
  readonly flexSign?: number;
}

export interface Rig {
  readonly name: string;
  readonly bones: readonly BoneDef[];
}

export type ViewId = 'front' | 'back' | 'side' | 'three-quarter';

export interface ViewConfig {
  /** Foreshortening applied to lateral bones: 1 = full width, 0 = perfectly edge-on. */
  readonly lateralScale: number;
  /** Foreshortening applied to feet. */
  readonly footScale: number;
  /**
   * Whether the right limbs mirror the left ones.
   *
   * Facing the viewer, they do: a raised right arm goes one way and a raised
   * left arm goes the other. Seen from the side, they do not - both arms swing
   * the same way, because you are looking at both of them from the same side.
   */
  readonly mirrorLimbs: boolean;
}

export interface KinematicPose {
  readonly view: ViewId;
  readonly root: {
    readonly position: Vec2;
    /** World angle of the pelvis in degrees; 90 = upright. */
    readonly rotation: number;
    readonly scale: number;
  };
  readonly joints: Partial<Record<JointId, number>>;
  /**
   * Absolute bone directions in degrees. A bone listed here points exactly this
   * way in world space, whatever its parent does - which is how a human (or a
   * model) actually thinks about a posture: "the front thigh points down-left at
   * -150 degrees", not "rotate the hip 60 degrees from neutral".
   */
  readonly world?: Partial<Record<JointId, number>>;
  /** Translate the solved figure so its lowest point sits on y = 0. */
  readonly grounded: boolean;
  /** Mirror the solved figure across the vertical axis (a figure facing the other way). */
  readonly flip?: boolean;
}

export interface BoneSegment {
  readonly id: BoneId;
  readonly start: Vec2;
  readonly end: Vec2;
  /** Absolute direction of the bone in degrees. */
  readonly worldAngle: number;
  readonly length: number;
  readonly side: Side;
  readonly group: BoneGroup;
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface Skeleton {
  readonly rig: Rig;
  readonly view: ViewId;
  readonly scale: number;
  readonly bones: Record<BoneId, BoneSegment>;
  readonly landmarks: Record<LandmarkId, Vec2>;
  readonly bounds: Bounds;
  /** Sole-to-crown extent of the solved figure. */
  readonly height: number;
}
