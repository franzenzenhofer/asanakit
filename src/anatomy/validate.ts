import { radToDeg } from '../core/angles.js';
import { DEFAULT_RIG } from '../core/rig.js';
import { rotateVec3 } from '../core/quat.js';
import { solveSkeleton } from '../core/skeleton.js';
import type { BoneId, LandmarkId, Rig, Skeleton } from '../core/types.js';
import { cross3, dot3, normalize3, sub3 } from '../core/vec3.js';
import { resolveFigure, type PoseSpec } from '../model/index.js';
import { ELBOW_MAX_FLEXION, HINGE_SLACK, KNEE_MAX_FLEXION } from './rom.js';

export type IssueCode =
  | 'knee-hyperextension'
  | 'knee-overflexion'
  | 'elbow-hyperextension'
  | 'elbow-overflexion'
  | 'below-ground'
  | 'no-ground-contact'
  | 'contact-off-ground';

export interface Issue {
  readonly code: IssueCode;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

/**
 * Hinge joints bend one way only. These are the limits a body actually has,
 * measured as the flexion of the child bone away from the parent: 0 is straight,
 * negative is bending backwards, and nobody's knee does that.
 */
interface Hinge {
  readonly child: BoneId;
  readonly parent: BoneId;
  readonly name: string;
  readonly maxFlexion: number;
  readonly hyper: IssueCode;
  readonly over: IssueCode;
}

// The limits themselves live in one place - `rom.ts` - so the editor's sliders
// and this validator can never drift apart about what a knee can do.
const KNEE = { maxFlexion: KNEE_MAX_FLEXION, hyper: 'knee-hyperextension', over: 'knee-overflexion' } as const;
const ELBOW = { maxFlexion: ELBOW_MAX_FLEXION, hyper: 'elbow-hyperextension', over: 'elbow-overflexion' } as const;

const HINGES: readonly Hinge[] = [
  { child: 'shinL', parent: 'thighL', name: 'left knee', ...KNEE },
  { child: 'shinR', parent: 'thighR', name: 'right knee', ...KNEE },
  { child: 'forearmL', parent: 'upperArmL', name: 'left elbow', ...ELBOW },
  { child: 'forearmR', parent: 'upperArmR', name: 'right elbow', ...ELBOW },
];

/** A little slack: a locked-out knee measures a degree or two either side of straight. */
const HYPEREXTENSION_SLACK = HINGE_SLACK;
/**
 * The measured angle is a float derived from two normalised vectors, so a joint
 * authored at exactly its limit can land an ulp beyond it. Sitting ON the limit
 * is not being past it, and no body cares about a millionth of a degree.
 */
const ANGLE_EPSILON = 1e-6;
const GROUND_TOLERANCE = 0.02;
const CONTACT_TOLERANCE = 0.035;

/**
 * Signed flexion of a bone away from its parent: the angle between the two
 * bone directions, signed by the child's own flexion axis (carried into world
 * space by the parent's orientation). Positive is the way the joint actually
 * bends - the axis in the rig says which way that is.
 */
const flexion = (skeleton: Skeleton, hinge: Hinge, rig: Rig): number => {
  const child = skeleton.bones[hinge.child];
  const parent = skeleton.bones[hinge.parent];
  const def = rig.bones.find((b) => b.id === hinge.child);
  if (def === undefined) throw new Error(`Rig "${rig.name}" has no bone "${hinge.child}"`);

  const parentDir = normalize3(sub3(parent.end, parent.start));
  const childDir = normalize3(sub3(child.end, child.start));
  const cos = Math.min(1, Math.max(-1, dot3(parentDir, childDir)));
  const angle = radToDeg(Math.acos(cos));

  const axis = rotateVec3(parent.orientation, def.flexAxis);
  return dot3(cross3(parentDir, childDir), axis) >= 0 ? angle : -angle;
};

const jointIssues = (skeleton: Skeleton, rig: Rig): Issue[] => {
  const issues: Issue[] = [];

  for (const hinge of HINGES) {
    const angle = flexion(skeleton, hinge, rig);

    if (angle < -HYPEREXTENSION_SLACK - ANGLE_EPSILON) {
      issues.push({
        code: hinge.hyper,
        severity: 'error',
        message: `${hinge.name} ("${hinge.child}") bends backwards by ${Math.abs(Math.round(angle))}°. A ${hinge.name} only flexes forwards.`,
      });
    } else if (angle > hinge.maxFlexion + ANGLE_EPSILON) {
      issues.push({
        code: hinge.over,
        severity: 'error',
        message: `${hinge.name} ("${hinge.child}") is flexed ${Math.round(angle)}°, past its ${hinge.maxFlexion}° limit.`,
      });
    }
  }

  return issues;
};

const groundIssues = (skeleton: Skeleton): Issue[] => {
  const issues: Issue[] = [];
  const lowest = skeleton.bounds.minY;

  if (lowest < -GROUND_TOLERANCE) {
    issues.push({
      code: 'below-ground',
      severity: 'error',
      message: `The figure sinks ${Math.abs(lowest).toFixed(2)} below the ground plane. Raise it, or set "grounded: true".`,
    });
  } else if (lowest > GROUND_TOLERANCE) {
    issues.push({
      code: 'no-ground-contact',
      severity: 'error',
      message: `The figure floats ${lowest.toFixed(2)} above the ground plane and touches nothing.`,
    });
  }

  return issues;
};

/**
 * The declared contact points are the pose's own claim about which parts of the
 * body are on the floor. Checking them is what catches a limb that was meant to
 * reach the mat and does not - the single most common authoring mistake.
 */
const contactIssues = (skeleton: Skeleton, contact: readonly LandmarkId[]): Issue[] =>
  contact.flatMap((id): Issue[] => {
    const gap = skeleton.landmarks[id][1] - skeleton.bounds.minY;
    if (gap <= CONTACT_TOLERANCE) return [];
    return [
      {
        code: 'contact-off-ground',
        severity: 'error',
        message: `"${id}" is declared as a contact point but sits ${gap.toFixed(2)} above the ground.`,
      },
    ];
  });

/** Check a pose against the limits of an actual body. Empty result means it is sound. */
export const validatePose = (pose: PoseSpec, rig: Rig = DEFAULT_RIG): Issue[] => {
  const skeleton = solveSkeleton(resolveFigure(pose.figure), rig);
  return [...jointIssues(skeleton, rig), ...groundIssues(skeleton), ...contactIssues(skeleton, pose.contact)];
};
