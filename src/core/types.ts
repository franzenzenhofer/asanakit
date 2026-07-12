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
   * Directional bones point "forward" rather than "outward". They are only
   * mirrored for the right side in views where forward is out of the picture plane.
   */
  readonly directional?: boolean;
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
  /** Whether directional bones (feet) mirror across the midline. */
  readonly mirrorDirectional: boolean;
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
