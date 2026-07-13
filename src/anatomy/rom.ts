/**
 * What a body can actually do, and what to call it.
 *
 * The rig speaks three channels - flex, abduct, twist - because that is what
 * the quaternion solver needs, and by construction they mean the same thing on
 * every bone: positive flex is anatomical flexion, positive abduct moves the
 * bone away from the midline, positive twist is external rotation. That is a
 * fine language for a solver and a poor one for a person, who asks for a knee
 * that flexes and a shoulder that externally rotates and would like to be told
 * when neither is possible.
 *
 * So this table is the single place that says, per bone and per channel:
 *
 *  - the RANGE a real joint has, and
 *  - the WORD for each direction of travel.
 *
 * The validator reads it, so lint speaks it. The editor reads it, so its
 * sliders cannot be dragged into an impossible body and its labels say
 * "Flexion / Extension" rather than "Flex". Change a number here and both
 * agree, forever - there is no second copy to forget.
 *
 * Ranges are generous by design: they are the outer edge of a trained,
 * hypermobile body doing advanced asana, not a clinical average. A pose may
 * still exceed them deliberately - the number field always accepts it, and
 * lint says so - but no one arrives there by accident with a slider.
 *
 * Where a joint is a HINGE, its abduct and twist channels are simply absent.
 * A knee does not abduct, and offering a control for it is a lie about the body.
 */
import type { BoneId } from '../core/types.js';

export type Channel = 'flex' | 'abduct' | 'twist';

export interface Range {
  readonly min: number;
  readonly max: number;
  /** What travel in the positive direction is called. */
  readonly positive: string;
  /** What travel in the negative direction is called. */
  readonly negative: string;
}

/** The channels a bone actually has. A missing channel is a joint that cannot do it. */
export type BoneRom = Partial<Record<Channel, Range>>;

const FLEXION = { positive: 'Flexion', negative: 'Extension' } as const;
const ABDUCTION = { positive: 'Abduction', negative: 'Adduction' } as const;
const ROTATION = { positive: 'External rotation', negative: 'Internal rotation' } as const;
const LATERAL = { positive: 'Left lateral flexion', negative: 'Right lateral flexion' } as const;
const AXIAL = { positive: 'Left axial rotation', negative: 'Right axial rotation' } as const;

/** Knee and elbow: one axis, one direction. The slack lets a locked-out joint sit a hair past straight. */
export const HINGE_SLACK = 8;
export const KNEE_MAX_FLEXION = 160;
export const ELBOW_MAX_FLEXION = 155;

/**
 * The neck, which the rig splits between the `neck` bone and the `head` bone.
 * These are the limits of the WHOLE cervical spine, head measured against
 * chest - the only measurement that means anything, since either bone alone can
 * be innocent while the pair is impossible.
 */
export const CERVICAL_ROTATION_WARN = 70;
export const CERVICAL_ROTATION_MAX = 80;
/**
 * Nod and side-bend together, head against chest. The ceiling is high on
 * purpose: a shoulderstand really does flex the cervical spine to about a right
 * angle - it is exactly why the pose is contraindicated for a bad neck - and a
 * lint that called sarvangasana impossible would be a lint nobody believed.
 * Past 90 you are not bending a neck, you are breaking one.
 */
export const CERVICAL_BEND_WARN = 70;
export const CERVICAL_BEND_MAX = 90;

const KNEE: BoneRom = { flex: { min: -HINGE_SLACK, max: KNEE_MAX_FLEXION, ...FLEXION } };
const ELBOW: BoneRom = {
  flex: { min: -HINGE_SLACK, max: ELBOW_MAX_FLEXION, ...FLEXION },
  // Not the elbow: the radioulnar joint, which lives along the forearm itself.
  twist: { min: -80, max: 85, positive: 'Supination', negative: 'Pronation' },
};
const SHOULDER: BoneRom = {
  flex: { min: -60, max: 180, ...FLEXION },
  abduct: { min: -40, max: 180, ...ABDUCTION },
  twist: { min: -90, max: 90, ...ROTATION },
};
const HIP: BoneRom = {
  flex: { min: -50, max: 145, ...FLEXION },
  abduct: { min: -30, max: 90, ...ABDUCTION },
  twist: { min: -50, max: 60, ...ROTATION },
};
const ANKLE: BoneRom = {
  // Verified against the solver: positive flex lifts the toes.
  flex: { min: -50, max: 25, positive: 'Dorsiflexion', negative: 'Plantarflexion' },
  abduct: { min: -30, max: 20, positive: 'Eversion', negative: 'Inversion' },
};
const WRIST: BoneRom = {
  flex: { min: -70, max: 80, ...FLEXION },
  abduct: { min: -20, max: 30, positive: 'Ulnar deviation', negative: 'Radial deviation' },
};
const SHOULDER_GIRDLE: BoneRom = {
  flex: { min: -15, max: 30, positive: 'Elevation', negative: 'Depression' },
  abduct: { min: -20, max: 20, positive: 'Protraction', negative: 'Retraction' },
};
const PELVIC_GIRDLE: BoneRom = {
  flex: { min: -20, max: 20, ...FLEXION },
  abduct: { min: -20, max: 20, ...ABDUCTION },
};

/**
 * Cervical rotation tops out around 90 degrees in total, and it is shared: the
 * neck carries most of it and the skull the rest. Splitting it here is what
 * stops a figure from being able to look straight backwards.
 */
const NECK: BoneRom = {
  flex: { min: -60, max: 60, ...FLEXION },
  abduct: { min: -45, max: 45, ...LATERAL },
  twist: { min: -70, max: 70, ...AXIAL },
};
const HEAD: BoneRom = {
  flex: { min: -25, max: 25, ...FLEXION },
  abduct: { min: -10, max: 10, ...LATERAL },
  twist: { min: -20, max: 20, ...AXIAL },
};
/**
 * The trunk, in its two halves. The lumbar spine flexes and extends freely and
 * barely rotates at all - its facets are built to resist it. The thorax is the
 * opposite: the ribs hold it, so it bends little and rotates well. Together they
 * come to the range the old single bone claimed, and separately they are the
 * reason a backbend has somewhere to arch that is not the neck.
 */
const LUMBAR: BoneRom = {
  flex: { min: -30, max: 60, ...FLEXION },
  abduct: { min: -25, max: 25, ...LATERAL },
  twist: { min: -10, max: 10, ...AXIAL },
};
const THORAX: BoneRom = {
  flex: { min: -35, max: 35, ...FLEXION },
  abduct: { min: -25, max: 25, ...LATERAL },
  twist: { min: -35, max: 35, ...AXIAL },
};

export const ROM: Record<BoneId, BoneRom> = {
  pelvis: { flex: { min: -30, max: 30, positive: 'Anterior tilt', negative: 'Posterior tilt' }, abduct: { min: -20, max: 20, ...LATERAL }, twist: { min: -30, max: 30, ...AXIAL } },
  spine: LUMBAR,
  thorax: THORAX,
  neck: NECK,
  head: HEAD,
  clavicleL: SHOULDER_GIRDLE,
  clavicleR: SHOULDER_GIRDLE,
  upperArmL: SHOULDER,
  upperArmR: SHOULDER,
  forearmL: ELBOW,
  forearmR: ELBOW,
  handL: WRIST,
  handR: WRIST,
  hipL: PELVIC_GIRDLE,
  hipR: PELVIC_GIRDLE,
  thighL: HIP,
  thighR: HIP,
  shinL: KNEE,
  shinR: KNEE,
  footL: ANKLE,
  footR: ANKLE,
};

/** The channels this bone has, in a stable order. A hinge yields exactly one. */
export const channelsOf = (bone: BoneId): readonly Channel[] =>
  (['flex', 'abduct', 'twist'] as const).filter((c) => ROM[bone][c] !== undefined);

/** True when the joint bends on one axis only - a knee, an elbow. */
export const isHinge = (bone: BoneId): boolean => ROM[bone].abduct === undefined;

/** "Flexion" or "Extension", depending on which way you are going. */
export const termFor = (bone: BoneId, channel: Channel, value: number): string | null => {
  const range = ROM[bone][channel];
  if (range === undefined) return null;
  return value < 0 ? range.negative : range.positive;
};
