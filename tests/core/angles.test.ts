import { describe, expect, test } from 'vitest';
import { degToRad, interiorAngle, normalizeDeg, radToDeg } from '../../src/core/angles.js';

describe('angles', () => {
  test('degToRad and radToDeg round-trip', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 10);
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90, 10);
  });

  test('normalizeDeg wraps into (-180, 180]', () => {
    expect(normalizeDeg(370)).toBeCloseTo(10, 10);
    expect(normalizeDeg(-190)).toBeCloseTo(170, 10);
    expect(normalizeDeg(180)).toBeCloseTo(180, 10);
    expect(normalizeDeg(-180)).toBeCloseTo(180, 10);
  });

  test('interiorAngle measures the joint angle at the middle point', () => {
    // Right angle: (1,0) -> (0,0) -> (0,1)
    expect(interiorAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 8);
    // Straight line is 180 degrees (a fully extended limb)
    expect(interiorAngle({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180, 8);
  });
});
