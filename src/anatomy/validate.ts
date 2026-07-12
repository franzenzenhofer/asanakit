import { normalizeDeg } from '../core/angles.js';
import { DEFAULT_RIG } from '../core/rig.js';
import { sideSign, solveSkeleton } from '../core/skeleton.js';
import type { BoneId, LandmarkId, Rig, Skeleton } from '../core/types.js';
import { resolveFigure, type PoseSpec } from '../model/index.js';

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

const KNEE = { maxFlexion: 160, hyper: 'knee-hyperextension', over: 'knee-overflexion' } as const;
const ELBOW = { maxFlexion: 155, hyper: 'elbow-hyperextension', over: 'elbow-overflexion' } as const;

const HINGES: readonly Hinge[] = [
  { child: 'shinL', parent: 'thighL', name: 'left knee', ...KNEE },
  { child: 'shinR', parent: 'thighR', name: 'right knee', ...KNEE },
  { child: 'forearmL', parent: 'upperArmL', name: 'left elbow', ...ELBOW },
  { child: 'forearmR', parent: 'upperArmR', name: 'right elbow', ...ELBOW },
];

/** A little slack: a locked-out knee measures a degree or two either side of straight. */
const HYPEREXTENSION_SLACK = 8;
const GROUND_TOLERANCE = 0.02;
const CONTACT_TOLERANCE = 0.035;

/**
 * Flexion of a bone away from its parent, in the joint's own frame. Right-side
 * bones mirror, so their world delta runs the other way - undo that, and both
 * elbows report flexion as a positive number.
 */
const flexion = (skeleton: Skeleton, hinge: Hinge, rig: Rig): number => {
  const child = skeleton.bones[hinge.child];
  const parent = skeleton.bones[hinge.parent];
  const def = rig.bones.find((b) => b.id === hinge.child);
  if (def === undefined) throw new Error(`Rig "${rig.name}" has no bone "${hinge.child}"`);
  // Read the joint the same way the solver writes it, or a mirrored limb reports
  // a perfectly good elbow as bending backwards.
  return normalizeDeg(child.worldAngle - parent.worldAngle) * sideSign(def, skeleton.view) * (def.flexSign ?? 1);
};

const jointIssues = (skeleton: Skeleton, rig: Rig): Issue[] => {
  const issues: Issue[] = [];

  for (const hinge of HINGES) {
    const angle = flexion(skeleton, hinge, rig);

    if (angle < -HYPEREXTENSION_SLACK) {
      issues.push({
        code: hinge.hyper,
        severity: 'error',
        message: `${hinge.name} ("${hinge.child}") bends backwards by ${Math.abs(Math.round(angle))}°. A ${hinge.name} only flexes forwards.`,
      });
    } else if (angle > hinge.maxFlexion) {
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
      message: `The figure sinks ${Math.abs(lowest).toFixed(2)} below the ground line. Raise it, or set "grounded: true".`,
    });
  } else if (lowest > GROUND_TOLERANCE) {
    issues.push({
      code: 'no-ground-contact',
      severity: 'error',
      message: `The figure floats ${lowest.toFixed(2)} above the ground line and touches nothing.`,
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
