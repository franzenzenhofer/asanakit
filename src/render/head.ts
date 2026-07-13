/**
 * A head that is looking somewhere.
 *
 * A drawn figure gets no face - no eyes, no smile, and no nose either: a nose
 * stuck on a stick figure reads as a mistake, not as a mark.
 *
 * What says which way the head is looking is the BACK of it, greyed. And the
 * shape of that grey is the moon's:
 * the boundary between the face-side and the back-side of a sphere projects to
 * an ellipse whose width collapses as the head turns broadside. Face-on, no
 * shade; in profile, exactly half; facing away, the whole skull. So the two
 * marks always agree, and either one alone tells you which way the figure looks.
 */
import { headFrame } from '../core/head.js';
import { rotateVec3 } from '../core/quat.js';
import type { Vec2 } from '../core/vec2.js';

import { viewQuat } from './camera.js';
import type { RenderContext } from './context.js';
import { drawnEllipse, ellipsePath } from './hand.js';
import { el, group, num, type SvgNode } from './svg.js';

/** Below this the head is edge-on to the shade's own axis, and the terminator is drawn as a straight edge. */
const FLAT = 1e-4;

interface Facing {
  /** Where the face points, in SVG picture space (y down), unit length. */
  readonly dir: Vec2;
  /** How much of the facing is toward the camera: 1 = at you, 0 = profile, -1 = away. */
  readonly toward: number;
}

const facing = (ctx: RenderContext): Facing | null => {
  const forward = rotateVec3(viewQuat(ctx.skeleton.camera), headFrame(ctx.skeleton.source).forward);
  // The projection flips y into SVG space; the facing has to flip with it.
  const [fx, fy, fz] = [forward[0], -forward[1], forward[2]];
  const flat = Math.hypot(fx, fy);
  // Dead-on or dead-away: there is no picture-plane direction to speak of, and
  // the shade is a full disc or nothing at all.
  if (flat < FLAT) return { dir: [1, 0], toward: fz >= 0 ? 1 : -1 };
  return { dir: [fx / flat, fy / flat], toward: fz };
};

/** Samples per arc. Enough that the skull reads as round at poster size. */
const ARC_STEPS = 32;

/**
 * The shaded back of the skull, on the unit circle. Two arcs:
 *
 *  - the rim, from one side of the head around the BACK to the other;
 *  - the terminator, back again - the great circle dividing face from occiput,
 *    which projects to an ellipse of half-width `toward` along the facing.
 *
 * The terminator bows AWAY from the face by exactly `toward`, which is what
 * makes this a moon phase: face at the camera (toward = 1) and it lies on the
 * rim, leaving nothing shaded; profile (0) and it is a straight edge, halving
 * the skull; face away (-1) and it bows across to the far rim, shading all of it.
 */
const occiputPath = (dir: Vec2, toward: number): string => {
  const [ux, uy] = dir;
  const [nx, ny] = [-uy, ux];
  const at = (alongU: number, alongN: number): string =>
    `${num(ux * alongU + nx * alongN)} ${num(uy * alongU + ny * alongN)}`;

  const points: string[] = [];
  for (let i = 0; i <= ARC_STEPS; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / ARC_STEPS; // rim: -n, round the back, to +n
    points.push(at(-Math.cos(t), Math.sin(t)));
  }
  for (let i = ARC_STEPS; i >= 0; i--) {
    const t = -Math.PI / 2 + (Math.PI * i) / ARC_STEPS; // terminator: +n back to -n
    points.push(at(-toward * Math.cos(t), Math.sin(t)));
  }
  return `M ${points.join(' L ')} Z`;
};

/**
 * Carry a picture-space direction back into the circle the shade is authored on.
 *
 * The shade is drawn on a unit circle and carried onto the skull by the same
 * transform that draws the skull, so its outer edge follows the head outline
 * exactly, whatever the style's proportions. Which means the FACING has to travel
 * the other way first: undo the spin, then undo the stretch. Hand that transform
 * a picture-space direction instead, and it spins it a SECOND time - which is how
 * the back of the head ends up on top of the head.
 */
const intoSkullFrame = (dir: Vec2, rotation: number, { radii }: { radii: Vec2 }): Vec2 => {
  const rad = (rotation * Math.PI) / 180;
  const [dx, dy] = dir;
  const [rx, ry] = radii;
  const local: Vec2 = [
    (dx * Math.cos(rad) + dy * Math.sin(rad)) / rx,
    (-dx * Math.sin(rad) + dy * Math.cos(rad)) / ry,
  ];
  const length = Math.hypot(local[0], local[1]);
  return length < FLAT ? [1, 0] : [local[0] / length, local[1] / length];
};

/**
 * The head: the skull and the shade over the back of it. One group, one depth -
 * they are the same object, and nothing ever sorts between them.
 */
export const renderHead = (ctx: RenderContext): SvgNode | null => {
  const { skeleton, proj, style } = ctx;
  if (style.head.shape === 'none') return null;

  const bone = skeleton.bones.head;
  const [cx, cy] = proj.p(skeleton.landmarks.headCenter);
  const rx = style.head.rx * proj.s * skeleton.scale;
  const ry = (style.head.shape === 'circle' ? style.head.rx : style.head.ry) * proj.s * skeleton.scale;
  // SVG rotates clockwise because y points down, so the sign flips against the world angle.
  const rotation = 90 - bone.worldAngle;
  const spin = rotation === 0 ? '' : ` rotate(${num(rotation)})`;

  // Drawn, not struck with a compass: a skull on paper is round the way a drawn
  // skull is round, which is nearly.
  const ellipse = { centre: [cx, cy] as Vec2, radii: [rx, ry] as Vec2 };
  const spin2 = rotation === 0 ? undefined : `rotate(${num(rotation)} ${num(cx)} ${num(cy)})`;

  // The skull is the paper the head is drawn on - a flat fill - and the RIM is the
  // pen mark round it, which is an ink shape of its own and therefore filled.
  const paper = el('path', {
    'data-part': 'head',
    d: ellipsePath(ellipse),
    transform: spin2,
    fill: style.head.fill,
    stroke: style.hand > 0 ? 'none' : style.head.stroke,
    'stroke-width': style.hand > 0 ? undefined : style.head.strokeWidth * proj.s,
  });

  const rim =
    style.hand > 0
      ? el('path', {
          'data-part': 'head-rim',
          d: drawnEllipse(ellipse, { hand: style.hand, width: style.head.strokeWidth * proj.s }),
          transform: spin2,
          fill: style.head.stroke,
          stroke: 'none',
        })
      : null;

  const skull = rim === null ? paper : group({ 'data-part': 'skull' }, [paper, rim]);

  const face = facing(ctx);
  if (face === null || style.head.shadeOpacity <= 0) return group({ 'data-part': 'head-group' }, [skull]);

  const nodes: SvgNode[] = [skull];

  if (face.toward < 1 - FLAT) {
    nodes.push(
      el('path', {
        'data-part': 'occiput',
        d: occiputPath(intoSkullFrame(face.dir, rotation, ellipse), face.toward),
        transform: `translate(${num(cx)} ${num(cy)})${spin} scale(${num(rx)} ${num(ry)})`,
        fill: style.head.shade,
        opacity: style.head.shadeOpacity,
        stroke: 'none',
      }),
    );
  }

  return group({ 'data-part': 'head-group' }, nodes);
};
