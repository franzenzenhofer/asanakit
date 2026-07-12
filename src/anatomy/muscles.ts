import type { BoneId } from '../core/types.js';

/**
 * Muscles are modelled as capsules laid over the bone they act on: a span
 * `t0..t1` along the bone, pushed sideways by `offset` (positive = the bone's
 * left normal, i.e. anterior for a figure facing +x) and drawn `width` thick.
 *
 * This is deliberately illustrative, not a biomechanical model: it is enough to
 * shade "which muscle is working here", which is what a posture infographic
 * needs. All measurements are fractions of stature.
 */
export interface MuscleDef {
  readonly id: MuscleId;
  readonly label: string;
  readonly latin: string;
  readonly region: 'upper' | 'core' | 'lower';
  /** Bone base name; bilateral muscles resolve to both the L and R bone. */
  readonly bone: BoneBase;
  readonly t0: number;
  readonly t1: number;
  readonly offset: number;
  readonly width: number;
  readonly bilateral: boolean;
  /** For paired muscles on a centre bone, the offset flips sign on the right side. */
  readonly mirrorOffset?: boolean;
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
  deltoid: { id: 'deltoid', label: 'Deltoid', latin: 'musculus deltoideus', region: 'upper', bone: 'upperArm', t0: -0.08, t1: 0.32, offset: 0, width: 0.058, bilateral: true },
  rotatorCuff: { id: 'rotatorCuff', label: 'Rotator cuff', latin: 'musculi rotatores', region: 'upper', bone: 'upperArm', t0: -0.05, t1: 0.12, offset: -0.012, width: 0.04, bilateral: true },
  biceps: { id: 'biceps', label: 'Biceps', latin: 'musculus biceps brachii', region: 'upper', bone: 'upperArm', t0: 0.18, t1: 0.92, offset: 0.02, width: 0.04, bilateral: true },
  triceps: { id: 'triceps', label: 'Triceps', latin: 'musculus triceps brachii', region: 'upper', bone: 'upperArm', t0: 0.15, t1: 0.95, offset: -0.02, width: 0.04, bilateral: true },
  forearmFlexors: { id: 'forearmFlexors', label: 'Forearm flexors', latin: 'flexores antebrachii', region: 'upper', bone: 'forearm', t0: 0.05, t1: 0.8, offset: 0.012, width: 0.034, bilateral: true },
  pectoralis: { id: 'pectoralis', label: 'Chest', latin: 'musculus pectoralis major', region: 'upper', bone: 'spine', t0: 0.55, t1: 0.92, offset: 0.05, width: 0.062, bilateral: true, mirrorOffset: true },
  latissimus: { id: 'latissimus', label: 'Lats', latin: 'musculus latissimus dorsi', region: 'upper', bone: 'spine', t0: 0.32, t1: 0.78, offset: 0.062, width: 0.05, bilateral: true, mirrorOffset: true },
  trapezius: { id: 'trapezius', label: 'Trapezius', latin: 'musculus trapezius', region: 'upper', bone: 'spine', t0: 0.8, t1: 1.04, offset: 0.032, width: 0.05, bilateral: true, mirrorOffset: true },
  serratus: { id: 'serratus', label: 'Serratus', latin: 'musculus serratus anterior', region: 'upper', bone: 'spine', t0: 0.45, t1: 0.7, offset: 0.056, width: 0.03, bilateral: true, mirrorOffset: true },
  erectorSpinae: { id: 'erectorSpinae', label: 'Spinal erectors', latin: 'musculi erectores spinae', region: 'core', bone: 'spine', t0: 0.02, t1: 0.88, offset: -0.022, width: 0.032, bilateral: false },
  rectusAbdominis: { id: 'rectusAbdominis', label: 'Abdominals', latin: 'musculus rectus abdominis', region: 'core', bone: 'spine', t0: 0.0, t1: 0.56, offset: 0.024, width: 0.055, bilateral: false },
  obliques: { id: 'obliques', label: 'Obliques', latin: 'musculi obliqui abdominis', region: 'core', bone: 'spine', t0: 0.05, t1: 0.5, offset: 0.05, width: 0.04, bilateral: true, mirrorOffset: true },
  gluteus: { id: 'gluteus', label: 'Glutes', latin: 'musculus gluteus maximus', region: 'lower', bone: 'thigh', t0: -0.06, t1: 0.24, offset: -0.03, width: 0.066, bilateral: true },
  hipFlexors: { id: 'hipFlexors', label: 'Hip flexors', latin: 'musculus iliopsoas', region: 'lower', bone: 'thigh', t0: -0.04, t1: 0.34, offset: 0.03, width: 0.036, bilateral: true },
  quadriceps: { id: 'quadriceps', label: 'Quadriceps', latin: 'musculus quadriceps femoris', region: 'lower', bone: 'thigh', t0: 0.14, t1: 0.96, offset: 0.022, width: 0.052, bilateral: true },
  hamstrings: { id: 'hamstrings', label: 'Hamstrings', latin: 'musculi ischiocrurales', region: 'lower', bone: 'thigh', t0: 0.12, t1: 0.94, offset: -0.024, width: 0.048, bilateral: true },
  adductors: { id: 'adductors', label: 'Adductors', latin: 'musculi adductores', region: 'lower', bone: 'thigh', t0: 0.08, t1: 0.78, offset: 0.0, width: 0.03, bilateral: true },
  gastrocnemius: { id: 'gastrocnemius', label: 'Calves', latin: 'musculus gastrocnemius', region: 'lower', bone: 'shin', t0: 0.04, t1: 0.62, offset: -0.022, width: 0.046, bilateral: true },
  tibialisAnterior: { id: 'tibialisAnterior', label: 'Shin', latin: 'musculus tibialis anterior', region: 'lower', bone: 'shin', t0: 0.06, t1: 0.72, offset: 0.016, width: 0.03, bilateral: true },
};

export const isMuscleId = (value: string): value is MuscleId => value in MUSCLES;

/** Resolve a muscle definition to the concrete bones it is drawn on. */
export const muscleBones = (muscle: MuscleDef): readonly { bone: BoneId; offsetSign: number }[] => {
  if (!muscle.bilateral) return [{ bone: muscle.bone as BoneId, offsetSign: 1 }];
  if (muscle.mirrorOffset) {
    // A paired muscle on a centre bone (chest, lats): one belly either side of the spine.
    return [
      { bone: muscle.bone as BoneId, offsetSign: 1 },
      { bone: muscle.bone as BoneId, offsetSign: -1 },
    ];
  }
  return [
    { bone: `${muscle.bone}L` as BoneId, offsetSign: 1 },
    { bone: `${muscle.bone}R` as BoneId, offsetSign: 1 },
  ];
};
