import type { JointId, JointValue, KinematicPose, WorldDirection } from '../core/types.js';
import type { FigureSpec } from './schema.js';

const OTHER_SIDE: Record<string, string> = { L: 'R', R: 'L' };

const mirrorJointId = (id: string): string => {
  const last = id.slice(-1);
  const swapped = OTHER_SIDE[last];
  return swapped === undefined ? id : `${id.slice(0, -1)}${swapped}`;
};

const swapSides = <V>(angles: Partial<Record<JointId, V>>): Partial<Record<JointId, V>> =>
  Object.fromEntries(
    Object.entries(angles).map(([id, value]) => [mirrorJointId(id), value]),
  ) as Partial<Record<JointId, V>>;

/**
 * Swap every left joint with its right counterpart; centre bones stay put.
 * Joint values carry over untouched, because flex/abduct/twist are defined
 * relative to each side's own anatomy - "abduct 30" means "30 away from the
 * midline" on either side.
 */
export const mirrorJoints = (joints: Partial<Record<JointId, JointValue>>): Partial<Record<JointId, JointValue>> =>
  swapSides(joints);

/**
 * World directions are absolute, so mirroring a pose across the sagittal plane
 * must also flip which way they point: azimuth negates, elevation stays.
 */
export const mirrorWorld = (
  world: Partial<Record<JointId, WorldDirection>>,
): Partial<Record<JointId, WorldDirection>> =>
  Object.fromEntries(
    Object.entries(swapSides(world)).map(([id, dir]) => [
      id,
      { ...dir, azimuth: -dir.azimuth, ...(dir.twist === undefined ? {} : { twist: -dir.twist }) },
    ]),
  ) as Partial<Record<JointId, WorldDirection>>;

/** Turn the declarative figure block of a pose file into a solvable kinematic pose. */
export const resolveFigure = (figure: FigureSpec): KinematicPose => {
  const m = figure.mirror;
  const [px, py, pz] = figure.root.position;
  return {
    root: {
      position: m ? [-px, py, pz] : [px, py, pz],
      yaw: m ? -figure.root.yaw : figure.root.yaw,
      pitch: figure.root.pitch,
      roll: m ? -figure.root.roll : figure.root.roll,
      scale: figure.root.scale,
    },
    joints: m ? mirrorJoints(figure.joints) : figure.joints,
    world: m ? mirrorWorld(figure.world) : figure.world,
    grounded: figure.grounded,
  };
};
