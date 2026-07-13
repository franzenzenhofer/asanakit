/**
 * The 2D view is a DRAWING.
 *
 * That is the whole point of it: it is not a screenshot of the 3D model and it
 * is not a CAD plot. It is the picture that goes on paper, and a picture on
 * paper was drawn by a hand - so the lines are not ruled. They bow, they
 * overshoot the corner they were aiming at, and no two of them are quite alike.
 *
 * The drawing itself is done by rough.js, which is very good at this and which
 * we are not going to reimplement. All this module owns is the two things
 * rough.js cannot know:
 *
 *  - the SEED. rough.js is random unless you give it one, and a library whose
 *    renders are byte-golden cannot have a random anything. So the seed is a
 *    hash of the stroke's own geometry: the same line always draws the same,
 *    on every machine, forever - and two different bones still draw differently,
 *    which is exactly what a hand does.
 *  - `hand`, one number from the style, that says how much of a hand there is in
 *    the line at all. 0 is a ruler; 1 is a pen held loosely.
 */
import type { Drawable, Options } from 'roughjs/bin/core.js';
import rough from 'roughjs/bundled/rough.esm.js';
import { path } from 'd3-path';
import type { Vec2 } from '../core/vec2.js';
import { num } from './svg.js';

/**
 * Bundlers and Node disagree about where a CommonJS-flavoured default export
 * lands, so take it from whichever hand is holding it. This is interop, not
 * cleverness, and it is the whole of it.
 */
const lib = ((rough as { default?: typeof rough }).default ?? rough);
const generator = lib.generator();

/** rough.js wants a 32-bit integer seed, and it must fall out of the geometry. */
const seedOf = (points: readonly Vec2[]): number => {
  let hash = 0x811c9dc5;
  for (const [x, y] of points) {
    // Round first: a coordinate that wobbles in its last float bit must not
    // change the drawing, or "the same pose" would stop meaning the same picture.
    for (const value of [num(x), num(y)]) {
      hash ^= Math.imul(Math.round(value * 1000), 0x01000193);
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return Math.abs(hash) % 2 ** 31;
};

/** How loose the pen is, per unit of `hand`. Beyond this it stops being a drawing and starts being a scribble. */
const ROUGHNESS = 1.1;
const BOWING = 1.4;

const options = (points: readonly Vec2[], hand: number): Options => ({
  seed: seedOf(points),
  roughness: ROUGHNESS * hand,
  bowing: BOWING * hand,
  // The fill and the stroke come from the style, on the node itself. rough.js is
  // only lending us its hand, not its palette.
  disableMultiStroke: false,
});

const toPath = (drawable: Drawable): string =>
  generator
    .toPaths(drawable)
    .map((piece) => piece.d)
    .join(' ');

const ruled = (points: readonly Vec2[], close: boolean): string => {
  const p = path();
  points.forEach(([x, y], i) => (i === 0 ? p.moveTo(num(x), num(y)) : p.lineTo(num(x), num(y))));
  if (close) p.closePath();
  return p.toString();
};

/** A drawn line. `hand` 0 gives back an exactly straight path - a ruler, for when you want one. */
export const drawnLine = (a: Vec2, b: Vec2, hand: number): string => {
  if (hand <= 0) return ruled([a, b], false);
  return toPath(generator.line(a[0], a[1], b[0], b[1], options([a, b], hand)));
};

/** A drawn shape: every edge struck by hand, closing back on itself. */
export const drawnPolygon = (points: readonly Vec2[], hand: number, close = true): string => {
  if (points.length < 2) return '';
  if (hand <= 0) return ruled(points, close);

  const pts = points.map(([x, y]): [number, number] => [x, y]);
  const drawable = close
    ? generator.polygon(pts, options(points, hand))
    : generator.linearPath(pts, options(points, hand));
  return toPath(drawable);
};

export interface DrawnEllipse {
  readonly centre: Vec2;
  readonly radii: Vec2;
  /** Degrees clockwise, the way SVG turns. */
  readonly rotation: number;
}

/**
 * A drawn skull. rough.js draws an axis-aligned ellipse, so the rotation is
 * carried by a transform on the node - which is what the caller does with it.
 */
export const drawnEllipse = ({ centre, radii }: DrawnEllipse, hand: number): string => {
  const [cx, cy] = centre;
  const [rx, ry] = radii;
  if (hand <= 0) {
    // A ruled ellipse, four beziers, the classic circle constant.
    const k = 0.5522847498;
    const p = path();
    p.moveTo(num(cx + rx), num(cy));
    p.bezierCurveTo(num(cx + rx), num(cy + ry * k), num(cx + rx * k), num(cy + ry), num(cx), num(cy + ry));
    p.bezierCurveTo(num(cx - rx * k), num(cy + ry), num(cx - rx), num(cy + ry * k), num(cx - rx), num(cy));
    p.bezierCurveTo(num(cx - rx), num(cy - ry * k), num(cx - rx * k), num(cy - ry), num(cx), num(cy - ry));
    p.bezierCurveTo(num(cx + rx * k), num(cy - ry), num(cx + rx), num(cy - ry * k), num(cx + rx), num(cy));
    p.closePath();
    return p.toString();
  }
  return toPath(generator.ellipse(cx, cy, rx * 2, ry * 2, options([centre, radii], hand)));
};
