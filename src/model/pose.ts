import type { JointId, KinematicPose } from '../core/types.js';
import type { FigureSpec } from './schema.js';

const OTHER_SIDE: Record<string, string> = { L: 'R', R: 'L' };

const mirrorJointId = (id: string): string => {
  const last = id.slice(-1);
  const swapped = OTHER_SIDE[last];
  return swapped === undefined ? id : `${id.slice(0, -1)}${swapped}`;
};

/** Swap every left joint angle with its right counterpart; centre joints stay put. */
export const mirrorJoints = (joints: Partial<Record<JointId, number>>): Partial<Record<JointId, number>> =>
  Object.fromEntries(Object.entries(joints).map(([id, angle]) => [mirrorJointId(id), angle]));

/** Turn the declarative figure block of a pose file into a solvable kinematic pose. */
export const resolveFigure = (figure: FigureSpec): KinematicPose => ({
  view: figure.view,
  root: {
    position: figure.root.position,
    rotation: figure.root.rotation,
    scale: figure.root.scale,
  },
  joints: figure.mirror ? mirrorJoints(figure.joints) : figure.joints,
  grounded: figure.grounded,
  flip: figure.flip,
});
