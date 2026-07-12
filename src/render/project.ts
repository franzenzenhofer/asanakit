import type { Bounds } from '../core/types.js';
import type { Vec2 } from '../core/vec2.js';

/**
 * Maps math coordinates (y up, origin at the figure's feet) into SVG user units
 * (y down, origin top-left). This is the only place the y-axis flips.
 */
export interface Projection {
  /** Project a point. */
  readonly p: (v: Vec2) => [number, number];
  /** SVG units per stature unit - use it to scale every stroke width and radius. */
  readonly s: number;
}

const MIN_EXTENT = 1e-6;

export const unionBounds = (a: Bounds, b: Bounds): Bounds => ({
  minX: Math.min(a.minX, b.minX),
  minY: Math.min(a.minY, b.minY),
  maxX: Math.max(a.maxX, b.maxX),
  maxY: Math.max(a.maxY, b.maxY),
});

export const boundsOfPoints = (points: readonly Vec2[]): Bounds => ({
  minX: Math.min(...points.map((p) => p[0])),
  maxX: Math.max(...points.map((p) => p[0])),
  minY: Math.min(...points.map((p) => p[1])),
  maxY: Math.max(...points.map((p) => p[1])),
});

export const padBounds = (b: Bounds, pad: number): Bounds => ({
  minX: b.minX - pad,
  minY: b.minY - pad,
  maxX: b.maxX + pad,
  maxY: b.maxY + pad,
});

/** Fit `content` inside a width x height canvas, preserving aspect ratio and centring. */
export const fitProjection = (content: Bounds, width: number, height: number): Projection => {
  const bw = Math.max(content.maxX - content.minX, MIN_EXTENT);
  const bh = Math.max(content.maxY - content.minY, MIN_EXTENT);
  const s = Math.min(width / bw, height / bh);
  const offsetX = (width - bw * s) / 2;
  const offsetY = (height - bh * s) / 2;

  return {
    s,
    p: (v: Vec2): [number, number] => [
      offsetX + (v[0] - content.minX) * s,
      height - offsetY - (v[1] - content.minY) * s,
    ],
  };
};
