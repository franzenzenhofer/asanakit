import type { Bounds, Skeleton } from '../core/types.js';
import type { Projection } from './project.js';
import type { Style } from './styles.js';

/**
 * Everything a draw function needs to put a shape on the canvas. Passing one
 * context beats threading four arguments through every layer, and it keeps the
 * layers honest: they read the scene, they never reach back into the pose.
 */
export interface RenderContext {
  readonly skeleton: Skeleton;
  readonly proj: Projection;
  readonly style: Style;
  /** The full visible extent, used by annotations that span the whole frame. */
  readonly content: Bounds;
}
