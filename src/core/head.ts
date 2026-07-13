/**
 * Where the head is and which way it looks.
 *
 * The rig has no facial bones, but it does know the head's world orientation,
 * and that is enough: the face looks along the head frame's +z, the crown
 * rises along its +y, the left ear sits on its +x. Every consumer that needs
 * a face - the keypoint exporters, the 2D nose mark, the three.js skull -
 * derives it from here and nowhere else, so a figure never looks one way in
 * the drawing and another in the model.
 */
import { rotateVec3 } from './quat.js';
import type { Skeleton } from './types.js';
import { add3, lerp3, scale3, type Vec3 } from './vec3.js';

/** The nose sits this far forward of the head centre, in head-lengths. */
export const NOSE_FORWARD = 0.42;

/** The head centre, a little above the midpoint: the skull's mass is up by the crown, not down at the jaw. */
export const HEAD_CENTRE_ALONG = 0.55;

export interface HeadFrame {
  readonly centre: Vec3;
  /** Unit vector out through the face. */
  readonly forward: Vec3;
  /** Unit vector out through the crown. */
  readonly up: Vec3;
  /** Unit vector out through the figure's LEFT ear. */
  readonly left: Vec3;
  /** The tip of the nose, in world space. */
  readonly nose: Vec3;
  /** Head bone length - the unit every facial offset is measured in. */
  readonly size: number;
}

export const headFrame = (skeleton: Skeleton): HeadFrame => {
  const head = skeleton.bones.head;
  const q = head.orientation;
  const forward = rotateVec3(q, [0, 0, 1]);
  const up = rotateVec3(q, [0, 1, 0]);
  const left = rotateVec3(q, [1, 0, 0]);
  const centre = lerp3(head.start, head.end, HEAD_CENTRE_ALONG);
  const size = head.length;

  return {
    centre,
    forward,
    up,
    left,
    nose: add3(centre, scale3(forward, NOSE_FORWARD * size)),
    size,
  };
};

/** A point on the face, in head-lengths: forward of the nose-line, up toward the crown, out toward the left ear. */
export const facePoint = (frame: HeadFrame, forward: number, rise: number, side: number): Vec3 =>
  add3(
    add3(add3(frame.centre, scale3(frame.forward, forward * frame.size)), scale3(frame.up, rise * frame.size)),
    scale3(frame.left, side * frame.size),
  );
