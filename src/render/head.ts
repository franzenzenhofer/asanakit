/**
 * A head that is looking somewhere.
 *
 * Hand-drawn asana notation never gives the figure a face; it gives it a nose -
 * a dot when the head is toward you, sliding out to the rim and past it as the
 * head turns to profile, and gone when you are looking at the back of the
 * skull. asanakit draws the same mark, except that the nose is a real point on
 * the real 3D head frame, so it lands where the projection puts it at every
 * camera angle, with no per-view special cases.
 *
 * The back of the skull is shaded, and the shape of that shade is the moon's:
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
 * The head: the skull, the shade over its back, and the nose mark. One group,
 * one depth - they are all the same object, and nothing ever sorts between them.
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

  const skull = el('ellipse', {
    'data-part': 'head',
    cx,
    cy,
    rx,
    ry,
    transform: rotation === 0 ? undefined : `rotate(${num(rotation)} ${num(cx)} ${num(cy)})`,
    fill: style.head.fill,
    stroke: style.head.stroke,
    'stroke-width': style.head.strokeWidth * proj.s,
  });

  const face = facing(ctx);
  if (face === null || style.head.shadeOpacity <= 0) return group({ 'data-part': 'head-group' }, [skull]);

  const nodes: SvgNode[] = [skull];

  // The shade is drawn on a unit circle and carried onto the skull by the same
  // transform that would draw the skull itself, so its outer edge always follows
  // the head outline exactly, whatever the style's proportions.
  if (face.toward < 1 - FLAT) {
    nodes.push(
      el('path', {
        'data-part': 'occiput',
        d: occiputPath(face.dir, face.toward),
        transform: `translate(${num(cx)} ${num(cy)})${spin} scale(${num(rx)} ${num(ry)})`,
        fill: style.head.shade,
        opacity: style.head.shadeOpacity,
        stroke: 'none',
      }),
    );
  }

  // The nose is a real point on the head, drawn where the camera actually sees
  // it - centred when the face is toward you, out on the rim in profile - and
  // simply not drawn when the face is behind the skull.
  if (style.head.nose === 'dot' && face.toward >= 0) {
    const [nx, ny] = proj.p(project2d(ctx));
    nodes.push(
      el('circle', {
        'data-part': 'nose',
        cx: nx,
        cy: ny,
        r: style.head.noseRadius * proj.s * skeleton.scale,
        fill: style.head.stroke,
      }),
    );
  }

  return group({ 'data-part': 'head-group' }, nodes);
};

/** The nose, projected into the picture plane through the active camera. */
const project2d = (ctx: RenderContext): Vec2 => {
  const nose = rotateVec3(viewQuat(ctx.skeleton.camera), headFrame(ctx.skeleton.source).nose);
  return [nose[0], nose[1]];
};
