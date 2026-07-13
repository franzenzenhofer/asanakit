import { Plane, Raycaster, Vector2, Vector3, type Camera, type Group, type Mesh } from 'three';
import { boneEndingAt } from '@asanakit/core/skeleton.js';
import type { BoneId, LandmarkId } from '@asanakit/core/types.js';
import { BONE_IDS, LANDMARK_IDS } from '@asanakit/core/types.js';

const isBoneId = (value: string): value is BoneId => (BONE_IDS as readonly string[]).includes(value);
const isLandmarkId = (value: string): value is LandmarkId => (LANDMARK_IDS as readonly string[]).includes(value);

/** `bone:<id>` mesh names come from buildFigureScene; everything else is not pickable. */
export const boneOfMesh = (mesh: Mesh): BoneId | null => {
  const name = mesh.name;
  if (!name.startsWith('bone:')) return null;
  const id = name.slice(5);
  return isBoneId(id) ? id : null;
};

/**
 * A JOINT is a handle. Taking hold of the knee and pulling it is exactly aiming
 * the thigh - and the shin, the foot and the toes come with it, because they hang
 * off the thigh and that is what forward kinematics does. So a joint sphere picks
 * the bone that ENDS there, and the rest of the limb follows for free.
 */
export const jointOfMesh = (mesh: Mesh): BoneId | null => {
  const name = mesh.name;
  if (!name.startsWith('joint:')) return null;
  const id = name.slice(6);
  return isLandmarkId(id) ? boneEndingAt(id) : null;
};

/** The joint the mesh IS, for highlighting the handle you are holding. */
export const landmarkOfMesh = (mesh: Mesh): LandmarkId | null => {
  const name = mesh.name;
  if (!name.startsWith('joint:')) return null;
  const id = name.slice(6);
  return isLandmarkId(id) ? id : null;
};

/**
 * Everything a pick or an aim needs to know about the view. The rect is spelled
 * out rather than taken as a DOMRect, so this module says what it needs and can
 * be reasoned about - and tested - without a browser in the room.
 */
export interface ViewRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface PickContext {
  readonly rect: ViewRect;
  readonly camera: Camera;
  readonly figure: Group;
}

const raycaster = new Raycaster();
const pointer = new Vector2();

const setRay = (x: number, y: number, context: PickContext): void => {
  pointer.set(
    ((x - context.rect.left) / context.rect.width) * 2 - 1,
    -((y - context.rect.top) / context.rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, context.camera);
};

const castAt = (x: number, y: number, context: PickContext): BoneId | null => {
  setRay(x, y, context);
  const hits = raycaster.intersectObjects(context.figure.children, false);

  // A joint sits ON its bones, so it wins: if your finger is over a knee you meant
  // the knee, not whichever of the thigh and the shin happens to be nearer the eye.
  for (const hit of hits) {
    const joint = jointOfMesh(hit.object as Mesh);
    if (joint !== null) return joint;
  }
  for (const hit of hits) {
    const bone = boneOfMesh(hit.object as Mesh);
    if (bone !== null) return bone;
  }
  return null;
};

/** Fingertip offsets: the exact point first, then a widening cross, so thin capsules are tappable. */
const TOUCH_SPREAD = [0, 8, 16] as const;

export const pickBone = (x: number, y: number, context: PickContext): BoneId | null => {
  for (const spread of TOUCH_SPREAD) {
    const offsets: readonly [number, number][] =
      spread === 0 ? [[0, 0]] : [[spread, 0], [-spread, 0], [0, spread], [0, -spread]];
    for (const [dx, dy] of offsets) {
      const bone = castAt(x + dx, y + dy, context);
      if (bone !== null) return bone;
    }
  }
  return null;
};

export interface AimAngles {
  readonly azimuth: number;
  readonly elevation: number;
}

/** The fixed geometry of one drag gesture: the joint the bone swings around. */
export interface AimPivot {
  readonly pivot: Vector3;
  readonly planePoint: Vector3;
}

const DEG = 180 / Math.PI;

/**
 * Drag a bone tip around its fixed start joint: intersect the pointer ray with
 * the camera-facing plane through the tip's position at drag start, and aim
 * the bone from its pivot at that point. Returns the schema's world-direction
 * angles (azimuth from +z toward +x, elevation up).
 */
export const aimFromPointer = (x: number, y: number, context: PickContext, aim: AimPivot): AimAngles | null => {
  setRay(x, y, context);
  const normal = new Vector3();
  context.camera.getWorldDirection(normal);
  const plane = new Plane().setFromNormalAndCoplanarPoint(normal, aim.planePoint);
  const hit = new Vector3();
  if (raycaster.ray.intersectPlane(plane, hit) === null) return null;
  const dir = hit.sub(aim.pivot);
  const length = dir.length();
  if (length < 1e-6) return null;
  return {
    azimuth: Math.round(Math.atan2(dir.x, dir.z) * DEG),
    elevation: Math.round(Math.asin(Math.max(-1, Math.min(1, dir.y / length))) * DEG),
  };
};
