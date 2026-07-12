import { describe, expect, test } from 'vitest';
import { add, along, angleOf, dist, fromPolar, lerp, midpoint, rotate, scale, sub, vec } from '../../src/core/vec2.js';

describe('vec2', () => {
  test('add and sub combine components', () => {
    expect(add(vec(1, 2), vec(3, 4))).toEqual([4, 6]);
    expect(sub(vec(3, 4), vec(1, 2))).toEqual([2, 2]);
  });

  test('scale multiplies both components', () => {
    expect(scale(vec(2, -3), 2.5)).toEqual([5, -7.5]);
  });

  test('dist measures euclidean distance', () => {
    expect(dist(vec(0, 0), vec(3, 4))).toBeCloseTo(5, 10);
  });

  test('fromPolar builds a vector from degrees and length in math coordinates', () => {
    const [px, py] = fromPolar(90, 2);
    expect(px).toBeCloseTo(0, 10);
    expect(py).toBeCloseTo(2, 10);
  });

  test('angleOf is the inverse of fromPolar', () => {
    expect(angleOf(fromPolar(137, 3))).toBeCloseTo(137, 10);
  });

  test('rotate turns a vector counter-clockwise by degrees', () => {
    const [rx, ry] = rotate(vec(1, 0), 90);
    expect(rx).toBeCloseTo(0, 10);
    expect(ry).toBeCloseTo(1, 10);
  });

  test('lerp and midpoint interpolate between two points', () => {
    expect(lerp(vec(0, 0), vec(10, 20), 0.25)).toEqual([2.5, 5]);
    expect(midpoint(vec(0, 0), vec(10, 20))).toEqual([5, 10]);
  });

  test('along offsets sideways from the segment, positive to its left', () => {
    const [ax, ay] = along(vec(0, 0), vec(10, 0), 0.5, 2);
    expect(ax).toBeCloseTo(5, 10);
    expect(ay).toBeCloseTo(2, 10);
  });

  test('keeps double precision through a long chain of rotations', () => {
    let p = vec(1, 0);
    for (let i = 0; i < 36; i++) p = rotate(p, 10);
    expect(p[0]).toBeCloseTo(1, 10);
    expect(p[1]).toBeCloseTo(0, 10);
  });
});
