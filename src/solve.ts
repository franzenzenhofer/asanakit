import { DEFAULT_RIG } from './core/rig.js';
import { solveSkeleton } from './core/skeleton.js';
import type { Rig, Skeleton } from './core/types.js';
import { resolveFigure, type PoseSpec } from './model/index.js';

export interface SolveOptions {
  readonly rig?: Rig;
  /** Force physics settling on or off; defaults to the pose's own `physics` field. */
  readonly settle?: boolean;
}

/**
 * Solve a pose file to a world-space skeleton, settling it with Rapier when
 * the pose (or the caller) asks for physics. The physics module - and its
 * WASM - loads only on that path, so a plain solve never touches it.
 */
export const solvePose = async (pose: PoseSpec, options: SolveOptions = {}): Promise<Skeleton> => {
  const skeleton = solveSkeleton(resolveFigure(pose.figure), options.rig ?? DEFAULT_RIG);
  const settle = options.settle ?? pose.physics === 'settle';
  if (!settle) return skeleton;
  const { settleSkeleton } = await import('./physics/settle.js');
  return settleSkeleton(skeleton);
};
