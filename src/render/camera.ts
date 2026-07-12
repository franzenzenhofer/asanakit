import type { CameraAngles } from '../core/camera.js';
import { axisAngleDeg, mulQuat, rotateVec3, type Quat } from '../core/quat.js';
import type { BoneGroup, BoneId, Bounds, LandmarkId, Side, Skeleton } from '../core/types.js';
import { radToDeg } from '../core/angles.js';
import type { Vec2 } from '../core/vec2.js';
import type { Vec3 } from '../core/vec3.js';

/**
 * A bone as the camera sees it: picture-plane endpoints, the picture angle,
 * and its depth - larger is closer to the camera. Depth is what orders the
 * painter's algorithm; nothing else in the renderer knows about 3D.
 */
export interface ViewBone {
  readonly id: BoneId;
  readonly start: Vec2;
  readonly end: Vec2;
  /** Picture-plane direction in degrees CCW from +x. */
  readonly worldAngle: number;
  readonly depth: number;
  readonly length: number;
  readonly side: Side;
  readonly group: BoneGroup;
}

/** The solved skeleton projected through a camera: everything the SVG layers consume. */
export interface ViewSkeleton {
  readonly camera: CameraAngles;
  readonly scale: number;
  readonly bones: Record<BoneId, ViewBone>;
  readonly landmarks: Record<LandmarkId, Vec2>;
  readonly bounds: Bounds;
  readonly height: number;
}

/**
 * The world-to-view rotation of an orbiting orthographic camera. Yaw about +y
 * walks the camera around the figure, then elevation pitches it above, then
 * roll tilts the picture. Applied to points, the picture is view x/y and depth
 * is view z.
 */
export const viewQuat = (camera: CameraAngles): Quat =>
  mulQuat(
    axisAngleDeg([0, 0, 1], camera.roll),
    mulQuat(axisAngleDeg([1, 0, 0], camera.elevation), axisAngleDeg([0, 1, 0], -camera.azimuth)),
  );

const project = (q: Quat, p: Vec3): Vec3 => rotateVec3(q, p);

const pictureAngle = (start: Vec3, end: Vec3): number =>
  radToDeg(Math.atan2(end[1] - start[1], end[0] - start[0]));

const boundsOf = (points: readonly Vec3[]): Bounds => ({
  minX: Math.min(...points.map((p) => p[0])),
  maxX: Math.max(...points.map((p) => p[0])),
  minY: Math.min(...points.map((p) => p[1])),
  maxY: Math.max(...points.map((p) => p[1])),
});

/**
 * Project a solved skeleton into a camera's picture plane. Orthographic on
 * purpose: a posture diagram wants measurable, undistorted proportions, and
 * the interactive viewer is where perspective lives.
 */
export const viewSkeleton = (skeleton: Skeleton, camera: CameraAngles): ViewSkeleton => {
  const q = viewQuat(camera);

  const projected = Object.entries(skeleton.bones).map(([id, bone]) => {
    const start = project(q, bone.start);
    const end = project(q, bone.end);
    return [
      id,
      {
        id: bone.id,
        start: [start[0], start[1]] as Vec2,
        end: [end[0], end[1]] as Vec2,
        worldAngle: pictureAngle(start, end),
        depth: (start[2] + end[2]) / 2,
        length: bone.length,
        side: bone.side,
        group: bone.group,
      },
    ] as const;
  });

  const landmarks = Object.fromEntries(
    Object.entries(skeleton.landmarks).map(([id, p]) => {
      const v = project(q, p);
      return [id, [v[0], v[1]] as Vec2];
    }),
  ) as Record<LandmarkId, Vec2>;

  const points = projected.flatMap(([, b]) => [b.start, b.end]).map((p): Vec3 => [p[0], p[1], 0]);
  const bounds = boundsOf(points);

  return {
    camera,
    scale: skeleton.scale,
    bones: Object.fromEntries(projected) as Record<BoneId, ViewBone>,
    landmarks,
    bounds,
    height: bounds.maxY - bounds.minY,
  };
};
