/**
 * The 2D view is a DRAWING.
 *
 * That is the whole point of it: it is not a screenshot of the 3D model and it
 * is not a CAD plot. It is the picture that goes on paper, and a picture on
 * paper was drawn with a pen - so a line here is not a line, it is a STROKE. It
 * has a body: it swells where the pen pressed and tapers where it lifted, and it
 * wanders a hair off the ruler on the way.
 *
 * `perfect-freehand` lays the ink - the library tldraw draws with - and we are
 * not going to reimplement it. It takes the points a hand moved through and
 * gives back the OUTLINE of the mark that hand would leave, which is why these
 * come back filled rather than stroked: a real pen mark is a shape, not a path
 * with a width.
 *
 * What this module owns is the two things the ink cannot know:
 *
 *  - the WANDER. perfect-freehand will faithfully draw whatever it is given,
 *    including a perfectly straight line - so the points are nudged first, by a
 *    hash of the stroke's own geometry. Never a random number: a library whose
 *    renders are byte-golden cannot have a random anything. The same line draws
 *    the same on every machine forever, and two different bones still draw
 *    differently, which is exactly what a hand does.
 *  - `hand`, one style token: how much of a hand is in the line at all. 0 is a
 *    ruler, for anyone who wants the technical plot back; 1 is a pen held loosely.
 */
import { path } from 'd3-path';
import { getStroke } from 'perfect-freehand';
import type { Vec2 } from '../core/vec2.js';
import { num } from './svg.js';

/** A hash, not a random number - see above. Same geometry in, same wander out. */
const noise = (seed: number, salt: number): number => {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

const seedOf = (points: readonly Vec2[]): number => {
  let seed = 0;
  for (const [x, y] of points) seed += num(x) * 0.731 + num(y) * 1.317;
  return seed;
};

/** How far a hand strays from the ruler, as a fraction of the stroke's own length. */
const WANDER = 0.018;
/** Points along a stroke: enough for the pen to breathe, few enough that it stays a line. */
const SAMPLES = 8;

/**
 * The nib. perfect-freehand's `size` is the full width of the mark at full
 * pressure, and it draws a body around the line rather than centring a stroke on
 * it - so a pen asked for the old stroke-width comes out FATTER than the ruled
 * line it replaced. It is trimmed back to match.
 */
const NIB = 0.62;

/** Thinning gives the mark a living weight; the easing puts the swell in its middle. */
const PEN = {
  thinning: 0.3,
  smoothing: 0.62,
  streamline: 0.45,
  simulatePressure: true,
  easing: (t: number): number => Math.sin((t * Math.PI) / 2),
} as const;

/** perfect-freehand hands back the outline of the mark; close it, and it is fillable. */
const outline = (points: readonly Vec2[], width: number): string => {
  const stroke = getStroke(
    points.map(([x, y]) => [x, y]),
    { size: width * NIB, ...PEN },
  ) as [number, number][];
  const first = stroke[0];
  if (first === undefined) return '';

  const p = path();
  p.moveTo(num(first[0]), num(first[1]));
  for (const [x, y] of stroke.slice(1)) p.lineTo(num(x), num(y));
  p.closePath();
  return p.toString();
};

/**
 * Walk from a to b the way a hand walks it: nearly straight, bowing a little.
 * The ends are pinned - a bone must begin and end exactly at its joint, or the
 * skeleton would come apart at the seams.
 */
const wander = (a: Vec2, b: Vec2, hand: number): Vec2[] => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return [a, b];

  const seed = seedOf([a, b]);
  const [nx, ny] = [-dy / length, dx / length];
  const bow = WANDER * hand * length;

  return Array.from({ length: SAMPLES + 1 }, (_, i): Vec2 => {
    const t = i / SAMPLES;
    const off = Math.sin(t * Math.PI) * bow * noise(seed, i);
    return [a[0] + dx * t + nx * off, a[1] + dy * t + ny * off];
  });
};

const ruled = (points: readonly Vec2[], close: boolean): string => {
  const p = path();
  points.forEach(([x, y], i) => (i === 0 ? p.moveTo(num(x), num(y)) : p.lineTo(num(x), num(y))));
  if (close) p.closePath();
  return p.toString();
};

export interface Ink {
  /** How much of a hand is in the line. 0 is a ruler. */
  readonly hand: number;
  /** The width of the pen, in picture units. */
  readonly width: number;
}

/**
 * A drawn stroke: the OUTLINE of the mark a pen would leave. FILL it, do not
 * stroke it. With `hand: 0` you get the bare geometry back, to stroke as you like.
 */
export const drawnLine = (a: Vec2, b: Vec2, ink: Ink): string =>
  ink.hand <= 0 ? ruled([a, b], false) : outline(wander(a, b, ink.hand), ink.width);

/** A drawn shape: the pen goes round it in one movement. */
export const drawnPolygon = (points: readonly Vec2[], ink: Ink, close = true): string => {
  if (points.length < 2) return '';
  if (ink.hand <= 0) return ruled(points, close);

  const walked: Vec2[] = [];
  const edges = close ? points.length : points.length - 1;
  for (let i = 0; i < edges; i++) {
    const a = points[i] as Vec2;
    const b = points[(i + 1) % points.length] as Vec2;
    walked.push(...wander(a, b, ink.hand).slice(i === 0 ? 0 : 1));
  }
  return outline(walked, ink.width);
};

export interface Ellipse {
  readonly centre: Vec2;
  readonly radii: Vec2;
}

const RING = 40;

const ring = (ellipse: Ellipse, hand: number): Vec2[] => {
  const [cx, cy] = ellipse.centre;
  const [rx, ry] = ellipse.radii;
  const seed = seedOf([ellipse.centre, ellipse.radii]);

  return Array.from({ length: RING + 1 }, (_, i): Vec2 => {
    const t = (i / RING) * Math.PI * 2;
    // The wander rides on the radius, so the skull breathes instead of wobbling.
    const r = 1 + WANDER * hand * noise(seed, i % RING) * 0.5;
    return [cx + Math.cos(t) * rx * r, cy + Math.sin(t) * ry * r];
  });
};

/** A drawn skull - the pen goes round, and comes back onto its own beginning. */
export const drawnEllipse = (ellipse: Ellipse, ink: Ink): string =>
  ink.hand <= 0 ? ruled(ring(ellipse, 0), true) : outline(ring(ellipse, ink.hand), ink.width);

/** The bare ellipse: the FILL that sits under a drawn skull. Four beziers, the circle constant. */
export const ellipsePath = ({ centre, radii }: Ellipse): string => {
  const [cx, cy] = centre;
  const [rx, ry] = radii;
  const k = 0.5522847498;
  const p = path();
  p.moveTo(num(cx + rx), num(cy));
  p.bezierCurveTo(num(cx + rx), num(cy + ry * k), num(cx + rx * k), num(cy + ry), num(cx), num(cy + ry));
  p.bezierCurveTo(num(cx - rx * k), num(cy + ry), num(cx - rx), num(cy + ry * k), num(cx - rx), num(cy));
  p.bezierCurveTo(num(cx - rx), num(cy - ry * k), num(cx - rx * k), num(cy - ry), num(cx), num(cy - ry));
  p.bezierCurveTo(num(cx + rx * k), num(cy - ry), num(cx + rx), num(cy - ry * k), num(cx + rx), num(cy));
  p.closePath();
  return p.toString();
};
