import type { Bounds } from '../core/types.js';
import type { ViewSkeleton } from './camera.js';
import type { Projection } from './project.js';
import type { Style } from './styles.js';

/**
 * Everything a draw function needs to put a shape on the canvas. Passing one
 * context beats threading four arguments through every layer, and it keeps the
 * layers honest: they read the projected scene, they never reach back into the
 * pose or the 3D solve.
 */
export interface RenderContext {
  readonly skeleton: ViewSkeleton;
  readonly proj: Projection;
  readonly style: Style;
  /** The full visible extent, used by annotations that span the whole frame. */
  readonly content: Bounds;
}
