import type { JointId, KinematicPose } from '../core/types.js';
import type { FigureSpec } from './schema.js';

const OTHER_SIDE: Record<string, string> = { L: 'R', R: 'L' };

const mirrorJointId = (id: string): string => {
  const last = id.slice(-1);
  const swapped = OTHER_SIDE[last];
  return swapped === undefined ? id : `${id.slice(0, -1)}${swapped}`;
};

/**
 * Swap every left angle with its right counterpart; centre bones stay put.
 * `mirror` swaps which limb plays which role. Reflecting the picture is `flip`'s
 * job - together they give you the other side of an asymmetric asana.
 */
export const mirrorAngles = <T extends Partial<Record<JointId, number>>>(angles: T): T =>
  Object.fromEntries(Object.entries(angles).map(([id, angle]) => [mirrorJointId(id), angle])) as T;

/** Turn the declarative figure block of a pose file into a solvable kinematic pose. */
export const resolveFigure = (figure: FigureSpec): KinematicPose => ({
  view: figure.view,
  root: {
    position: figure.root.position,
    rotation: figure.root.rotation,
    scale: figure.root.scale,
  },
  joints: figure.mirror ? mirrorAngles(figure.joints) : figure.joints,
  world: figure.mirror ? mirrorAngles(figure.world) : figure.world,
  grounded: figure.grounded,
  flip: figure.flip,
});
