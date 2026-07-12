type Point = readonly [number, number];

const DEG_PER_RAD = 180 / Math.PI;
const HALF_TURN = 180;
const FULL_TURN = 360;

export const degToRad = (deg: number): number => deg / DEG_PER_RAD;

export const radToDeg = (rad: number): number => rad * DEG_PER_RAD;

/** Wrap an angle into the half-open range (-180, 180]. */
export const normalizeDeg = (deg: number): number => {
  const wrapped = ((deg % FULL_TURN) + FULL_TURN) % FULL_TURN;
  return wrapped > HALF_TURN ? wrapped - FULL_TURN : wrapped;
};

/**
 * Interior angle at `b` formed by the segments b->a and b->c, in [0, 180].
 * This is how anatomy reports joint angles: 180 = fully extended limb.
 */
export const interiorAngle = (a: Point, b: Point, c: Point): number => {
  const ux = a[0] - b[0];
  const uy = a[1] - b[1];
  const vx = c[0] - b[0];
  const vy = c[1] - b[1];
  const lu = Math.hypot(ux, uy);
  const lv = Math.hypot(vx, vy);
  if (lu === 0 || lv === 0) return 0;
  const cos = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / (lu * lv)));
  return radToDeg(Math.acos(cos));
};
