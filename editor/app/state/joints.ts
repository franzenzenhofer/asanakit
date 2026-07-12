import type { BoneId } from '@asanakit/core/types.js';
import { DEFAULT_RIG } from '@asanakit/core/rig.js';
import { solveSkeleton } from '@asanakit/core/skeleton.js';
import { resolveFigure, type PoseSpecInput } from '@asanakit/model/index.js';
import { validateInput } from './serialize.js';

export interface JointChannels {
  readonly flex: number;
  readonly abduct: number;
  readonly twist: number;
}

type JointValueInput = NonNullable<NonNullable<PoseSpecInput['figure']>['joints']>[BoneId];

/** Read any authored joint value into the canonical flex/abduct/twist triple. */
export const readJoint = (value: JointValueInput): JointChannels => {
  if (value === undefined) return { flex: 0, abduct: 0, twist: 0 };
  if (typeof value === 'number') return { flex: value, abduct: 0, twist: 0 };
  return {
    flex: value.flex ?? (value.extend === undefined ? 0 : -value.extend),
    abduct: value.abduct ?? (value.adduct === undefined ? 0 : -value.adduct),
    twist:
      value.twist ??
      value.externalRotation ??
      (value.internalRotation === undefined ? 0 : -value.internalRotation),
  };
};

/** Write the canonical triple back in the most compact legal form. */
export const writeJoint = (channels: JointChannels): JointValueInput | undefined => {
  const { flex, abduct, twist } = channels;
  if (flex === 0 && abduct === 0 && twist === 0) return undefined;
  if (abduct === 0 && twist === 0) return flex;
  return {
    ...(flex === 0 ? {} : { flex }),
    ...(abduct === 0 ? {} : { abduct }),
    ...(twist === 0 ? {} : { twist }),
  };
};

/** The opposite-side bone, if this bone has one. */
export const counterpart = (bone: BoneId): BoneId | null => {
  if (bone.endsWith('L')) return `${bone.slice(0, -1)}R` as BoneId;
  if (bone.endsWith('R')) return `${bone.slice(0, -1)}L` as BoneId;
  return null;
};

const DEG = 180 / Math.PI;

/**
 * The bone's current absolute direction, from the solved figure - so switching
 * a bone from joint to world control never makes the pose jump.
 */
export const solvedWorldDirection = (pose: PoseSpecInput, bone: BoneId): { azimuth: number; elevation: number } => {
  const { spec } = validateInput(pose);
  if (spec === undefined) return { azimuth: 0, elevation: 0 };

  const skeleton = solveSkeleton(resolveFigure(spec.figure), DEFAULT_RIG);
  const segment = skeleton.bones[bone];

  const [dx, dy, dz] = [
    segment.end[0] - segment.start[0],
    segment.end[1] - segment.start[1],
    segment.end[2] - segment.start[2],
  ];
  const length = Math.hypot(dx, dy, dz);
  if (length < 1e-9) return { azimuth: 0, elevation: 0 };

  return {
    azimuth: Math.round(Math.atan2(dx, dz) * DEG),
    elevation: Math.round(Math.asin(Math.max(-1, Math.min(1, dy / length))) * DEG),
  };
};
