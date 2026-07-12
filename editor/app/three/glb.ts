import { DEFAULT_RIG } from '@asanakit/core/rig.js';
import { solveSkeleton } from '@asanakit/core/skeleton.js';
import { exportGlbBytes } from '@asanakit/export3d/gltf.js';
import { resolveFigure, type PoseSpec } from '@asanakit/model/index.js';

/** Solve and export the pose as binary GLB - lives in the lazy three.js chunk. */
export const poseToGlb = async (spec: PoseSpec): Promise<Blob> => {
  const skeleton = solveSkeleton(resolveFigure(spec.figure), DEFAULT_RIG);
  const bytes = await exportGlbBytes(skeleton, {
    engaged: [...spec.muscles.engaged],
    stretched: [...spec.muscles.stretched],
    props: [...spec.props],
  });
  return new Blob([bytes], { type: 'model/gltf-binary' });
};
