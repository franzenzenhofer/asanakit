import { degToRad } from '../core/angles.js';
import type { BoneId } from '../core/types.js';

/**
 * Muscles are modelled as capsules laid over the bone they act on: a span
 * `t0..t1` along the bone, pushed off it, and drawn `width` thick.
 *
 * A muscle is displaced in two independent anatomical planes, and which one you
 * can see depends on where you are standing:
 *
 *  - `lateral` - left/right of the midline. You see it face-on; in profile it
 *    points into the screen and collapses to nothing.
 *  - `sagittal` - front/back of the body. You see it in profile; face-on it
 *    points at you and collapses to nothing.
 *
 * Keeping them apart is what stops the chest muscles being drawn behind the back
 * in a side view. Positive `sagittal` is always anterior - toward the front of
 * the body - whatever direction the bone happens to point.
 *
 * This is deliberately illustrative, not a biomechanical model. It is enough to
 * shade "which muscle is working here", which is what a posture infographic needs.
 * All measurements are fractions of stature.
 */
export interface MuscleDef {
  readonly id: MuscleId;
  readonly label: string;
  readonly latin: string;
  readonly region: 'upper' | 'core' | 'lower';
  readonly bone: BoneBase;
  readonly t0: number;
  readonly t1: number;
  /** Offset left/right of the midline. Non-zero means the muscle comes in a pair. */
  readonly lateral: number;
  /** Offset toward the front of the body (positive) or the back (negative). */
  readonly sagittal: number;
  readonly width: number;
}

export type BoneBase =
  | 'pelvis'
  | 'spine'
  | 'neck'
  | 'head'
  | 'clavicle'
  | 'upperArm'
  | 'forearm'
  | 'hand'
  | 'hip'
  | 'thigh'
  | 'shin'
  | 'foot';

/** Torso bones run upwards, limb bones hang downwards, so their left-normals point opposite ways. */
const TORSO_BONES: readonly BoneBase[] = ['pelvis', 'spine', 'neck', 'head', 'clavicle', 'hip'];

const anteriorSign = (bone: BoneBase): number => (TORSO_BONES.includes(bone) ? -1 : 1);

export const MUSCLE_IDS = [
  'deltoid',
  'rotatorCuff',
  'biceps',
  'triceps',
  'forearmFlexors',
  'pectoralis',
  'latissimus',
  'trapezius',
  'serratus',
  'erectorSpinae',
  'rectusAbdominis',
  'obliques',
  'gluteus',
  'hipFlexors',
  'quadriceps',
  'hamstrings',
  'adductors',
  'gastrocnemius',
  'tibialisAnterior',
] as const;

export type MuscleId = (typeof MUSCLE_IDS)[number];

export const MUSCLES: Record<MuscleId, MuscleDef> = {
  deltoid: { id: 'deltoid', label: 'Deltoid', latin: 'musculus deltoideus', region: 'upper', bone: 'upperArm', t0: -0.08, t1: 0.32, lateral: 0, sagittal: 0, width: 0.058 },
  rotatorCuff: { id: 'rotatorCuff', label: 'Rotator cuff', latin: 'musculi rotatores', region: 'upper', bone: 'upperArm', t0: -0.05, t1: 0.12, lateral: 0, sagittal: -0.012, width: 0.04 },
  biceps: { id: 'biceps', label: 'Biceps', latin: 'musculus biceps brachii', region: 'upper', bone: 'upperArm', t0: 0.18, t1: 0.92, lateral: 0, sagittal: 0.02, width: 0.04 },
  triceps: { id: 'triceps', label: 'Triceps', latin: 'musculus triceps brachii', region: 'upper', bone: 'upperArm', t0: 0.15, t1: 0.95, lateral: 0, sagittal: -0.02, width: 0.04 },
  forearmFlexors: { id: 'forearmFlexors', label: 'Forearm flexors', latin: 'flexores antebrachii', region: 'upper', bone: 'forearm', t0: 0.05, t1: 0.8, lateral: 0, sagittal: 0.012, width: 0.034 },

  pectoralis: { id: 'pectoralis', label: 'Chest', latin: 'musculus pectoralis major', region: 'upper', bone: 'spine', t0: 0.55, t1: 0.92, lateral: 0.05, sagittal: 0.032, width: 0.062 },
  latissimus: { id: 'latissimus', label: 'Lats', latin: 'musculus latissimus dorsi', region: 'upper', bone: 'spine', t0: 0.32, t1: 0.78, lateral: 0.062, sagittal: -0.04, width: 0.05 },
  trapezius: { id: 'trapezius', label: 'Trapezius', latin: 'musculus trapezius', region: 'upper', bone: 'spine', t0: 0.8, t1: 1.04, lateral: 0.032, sagittal: -0.03, width: 0.05 },
  serratus: { id: 'serratus', label: 'Serratus', latin: 'musculus serratus anterior', region: 'upper', bone: 'spine', t0: 0.45, t1: 0.7, lateral: 0.056, sagittal: 0.01, width: 0.03 },
  erectorSpinae: { id: 'erectorSpinae', label: 'Spinal erectors', latin: 'musculi erectores spinae', region: 'core', bone: 'spine', t0: 0.02, t1: 0.88, lateral: 0, sagittal: -0.026, width: 0.032 },
  rectusAbdominis: { id: 'rectusAbdominis', label: 'Abdominals', latin: 'musculus rectus abdominis', region: 'core', bone: 'spine', t0: 0.0, t1: 0.56, lateral: 0, sagittal: 0.03, width: 0.055 },
  obliques: { id: 'obliques', label: 'Obliques', latin: 'musculi obliqui abdominis', region: 'core', bone: 'spine', t0: 0.05, t1: 0.5, lateral: 0.05, sagittal: 0.012, width: 0.04 },

  gluteus: { id: 'gluteus', label: 'Glutes', latin: 'musculus gluteus maximus', region: 'lower', bone: 'thigh', t0: -0.06, t1: 0.24, lateral: 0, sagittal: -0.03, width: 0.066 },
  hipFlexors: { id: 'hipFlexors', label: 'Hip flexors', latin: 'musculus iliopsoas', region: 'lower', bone: 'thigh', t0: -0.04, t1: 0.34, lateral: 0, sagittal: 0.03, width: 0.036 },
  quadriceps: { id: 'quadriceps', label: 'Quadriceps', latin: 'musculus quadriceps femoris', region: 'lower', bone: 'thigh', t0: 0.14, t1: 0.96, lateral: 0, sagittal: 0.024, width: 0.052 },
  hamstrings: { id: 'hamstrings', label: 'Hamstrings', latin: 'musculi ischiocrurales', region: 'lower', bone: 'thigh', t0: 0.12, t1: 0.94, lateral: 0, sagittal: -0.026, width: 0.048 },
  adductors: { id: 'adductors', label: 'Adductors', latin: 'musculi adductores', region: 'lower', bone: 'thigh', t0: 0.08, t1: 0.78, lateral: 0, sagittal: 0.0, width: 0.03 },
  gastrocnemius: { id: 'gastrocnemius', label: 'Calves', latin: 'musculus gastrocnemius', region: 'lower', bone: 'shin', t0: 0.04, t1: 0.62, lateral: 0, sagittal: -0.024, width: 0.046 },
  tibialisAnterior: { id: 'tibialisAnterior', label: 'Shin', latin: 'musculus tibialis anterior', region: 'lower', bone: 'shin', t0: 0.06, t1: 0.72, lateral: 0, sagittal: 0.016, width: 0.03 },
};

export const isMuscleId = (value: string): value is MuscleId => value in MUSCLES;

export interface MuscleInstance {
  readonly bone: BoneId;
  /** Offset along the bone's left-normal, already projected for this view. */
  readonly offset: number;
}

const isTorsoMuscle = (muscle: MuscleDef): boolean => TORSO_BONES.includes(muscle.bone);

/** A pair of bellies this close together reads as one; draw it once. */
const PAIR_MERGE = 0.015;

/**
 * Resolve a muscle to the concrete bellies drawn for a camera azimuth.
 *
 * The two displacement planes fade continuously with the viewpoint: the
 * left/right split is fully visible face-on (azimuth 0) and collapses in
 * profile; the front/back displacement does the opposite, signed by which
 * profile the camera stands on. Face-on, a paired torso muscle is two bellies
 * either side of the spine; in profile it is one belly, in front of or behind
 * it. Limb muscles are always drawn on both limbs - in profile the two simply
 * overlap, which is exactly what you see.
 */
export const muscleInstances = (muscle: MuscleDef, azimuthDeg: number): MuscleInstance[] => {
  const az = degToRad(azimuthDeg);
  const lateralVis = Math.cos(az);
  const sagittalVis = -Math.sin(az);
  const sagittal = muscle.sagittal * anteriorSign(muscle.bone) * sagittalVis;

  if (isTorsoMuscle(muscle)) {
    const bone = muscle.bone as BoneId;
    const split = muscle.lateral * lateralVis;
    if (Math.abs(split) < PAIR_MERGE) return [{ bone, offset: sagittal }];
    return [
      { bone, offset: sagittal + split },
      { bone, offset: sagittal - split },
    ];
  }

  const offset = muscle.lateral * lateralVis + sagittal;
  return [
    { bone: `${muscle.bone}L` as BoneId, offset },
    { bone: `${muscle.bone}R` as BoneId, offset },
  ];
};
