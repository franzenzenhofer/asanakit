import { rotateVec3 } from '../core/quat.js';
import type { Bounds, LandmarkId } from '../core/types.js';
import { add, fromPolar, rotate, scale as scaleVec, type Vec2 } from '../core/vec2.js';
import type { Vec3 } from '../core/vec3.js';
import type { Anchor, Prop } from '../model/schema.js';
import { BOARD_WIDTH_RATIO, matModel, type MatProp } from '../props/geometry.js';
import { viewQuat, type ViewSkeleton } from './camera.js';
import type { RenderContext } from './context.js';
import { drawnPolygon, type Ink } from './hand.js';
import { boundsOfPoints, type Projection } from './project.js';
import { el, group, type SvgNode } from './svg.js';

export const resolveAnchor = (anchor: Anchor, skeleton: ViewSkeleton): Vec2 =>
  typeof anchor === 'string' ? skeleton.landmarks[anchor] : [anchor[0], anchor[1]];

/**
 * Furniture stands in the world, not on the body. The world origin projects to
 * x = 0 in the picture plane under every camera, so that - and never the
 * figure's bounding box - is what the floor, the wall and the wave are built
 * around. Otherwise raising an arm would slide the room sideways.
 */
const WORLD_X = 0;

const centroid = (ids: readonly LandmarkId[], skeleton: ViewSkeleton): Vec2 => {
  if (ids.length === 0) return [WORLD_X, skeleton.bounds.minY];
  const pts = ids.map((id) => skeleton.landmarks[id]);
  return [
    pts.reduce((sum, p) => sum + p[0], 0) / pts.length,
    pts.reduce((sum, p) => sum + p[1], 0) / pts.length,
  ];
};

const WAVE_STEPS = 48;


/**
 * The mat is a real 3D box, and the picture shows its top face projected
 * through the active camera. A mat is about a centimetre thick, so from any
 * camera at eye level this collapses to exactly what it is in life: one line.
 * Raise the camera and it opens into the thin surface you would actually see -
 * no view-specific drawing, just the projection doing its job.
 */
interface MatFace {
  /** The top face, in the picture plane. */
  readonly corners: readonly [Vec2, Vec2, Vec2, Vec2];
}

const matFace = (prop: MatProp, skeleton: ViewSkeleton): MatFace => {
  const q = viewQuat(skeleton.camera);
  const flat = (corner: readonly number[]): Vec2 => {
    const [x, y] = rotateVec3(q, corner as Vec3);
    return [x, y];
  };
  return {
    corners: matModel(prop, skeleton.source).top.map(flat) as unknown as readonly [Vec2, Vec2, Vec2, Vec2],
  };
};

const wavePoints = (prop: Extract<Prop, { type: 'wave' }>, cx: number): Vec2[] => {
  const dir = prop.facing === 'right' ? 1 : -1;
  return Array.from({ length: WAVE_STEPS + 1 }, (_, i) => {
    const t = i / WAVE_STEPS;
    const px = cx + (t - 0.5) * prop.length;
    // A breaking wave: a swell that steepens into a crest on the facing side.
    const swell = Math.sin(t * Math.PI * 2 - Math.PI / 2);
    const steepen = prop.breaking ? Math.pow(t, 1.6) : 1;
    return [px * 1, prop.y + prop.amplitude * swell * steepen * dir * dir] as Vec2;
  });
};

const boardOutline = (centre: Vec2, length: number, rotationDeg: number, width?: number): Vec2[] => {
  const half = length / 2;
  const w = width ?? length * BOARD_WIDTH_RATIO;
  const local: Vec2[] = [
    [half, 0],
    [half * 0.45, w / 2],
    [-half * 0.55, w / 2],
    [-half, w * 0.16],
    [-half, -w * 0.16],
    [-half * 0.55, -w / 2],
    [half * 0.45, -w / 2],
  ];
  return local.map((p) => add(centre, rotate(p, rotationDeg)));
};

/**
 * The furniture is drawn with the same pen as the body - a mat on paper was drawn
 * on paper. When there is a hand in the line, a prop comes back as an ink SHAPE
 * (fill it); when there is not, it is bare geometry (stroke it). `strokeOr` says
 * which, so no caller has to think about it twice.
 */
const polygon = (points: readonly Vec2[], proj: Projection, ink: Ink, close = true): string =>
  drawnPolygon(points.map((pt) => proj.p(pt)), ink, close);

/** The attributes that turn a drawn path into ink, or a ruled one into a stroke. */
const strokeOr = (ink: Ink, colour: string, fill = 'none'): Record<string, string | number | undefined> =>
  ink.hand > 0
    ? { fill: colour, stroke: 'none' }
    : { fill, stroke: colour, 'stroke-width': ink.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

const propPoints = (prop: Prop, skeleton: ViewSkeleton): Vec2[] => {
  const cx = WORLD_X;
  switch (prop.type) {
    case 'ground':
      return [
        [cx - prop.width / 2, prop.y],
        [cx + prop.width / 2, prop.y],
      ];
    case 'mat':
      return [...matFace(prop, skeleton).corners];
    case 'block': {
      const at = resolveAnchor(prop.at, skeleton);
      return [
        [at[0] - prop.width, at[1] - prop.height],
        [at[0] + prop.width, at[1] + prop.height],
      ];
    }
    case 'strap':
      return [resolveAnchor(prop.from, skeleton), resolveAnchor(prop.to, skeleton)];
    case 'wall':
      return [
        [prop.x, skeleton.bounds.minY],
        [prop.x, skeleton.bounds.maxY],
      ];
    case 'surfboard': {
      const centre = prop.at ?? add(centroid(prop.under, skeleton), prop.offset);
      return boardOutline(centre, prop.length, prop.rotation, prop.width);
    }
    case 'wave':
      return wavePoints(prop, cx);
  }
};

export const propsBounds = (props: readonly Prop[], skeleton: ViewSkeleton): Bounds | null => {
  const pts = props.flatMap((prop) => propPoints(prop, skeleton));
  return pts.length === 0 ? null : boundsOfPoints(pts);
};

const renderProp = (prop: Prop, ctx: RenderContext): SvgNode => {
  const { skeleton, proj, style } = ctx;
  const cx = WORLD_X;
  const ink: Ink = { hand: style.hand, width: style.props.strokeWidth * proj.s };
  const colour = style.props.stroke;

  switch (prop.type) {
    case 'ground': {
      const line: Vec2[] = [
        [cx - prop.width / 2, prop.y],
        [cx + prop.width / 2, prop.y],
      ];
      return el('path', {
        'data-prop': 'ground',
        d: polygon(line, proj, ink, false),
        ...strokeOr(ink, colour),
      });
    }
    case 'mat':
      // Just the mat. The forward arrow belongs in the 3D scene, where you are
      // flying around the thing and can lose your bearings; a flat drawing has
      // a camera, and the camera already told you which way you are looking.
      return el('path', {
        'data-prop': 'mat',
        d: polygon(matFace(prop, skeleton).corners, proj, ink),
        ...strokeOr(ink, colour, style.props.fill),
      });
    case 'block': {
      const at = resolveAnchor(prop.at, skeleton);
      const local: Vec2[] = [
        [-prop.width / 2, -prop.height / 2],
        [prop.width / 2, -prop.height / 2],
        [prop.width / 2, prop.height / 2],
        [-prop.width / 2, prop.height / 2],
      ];
      const corners: Vec2[] = local.map((p) => add(at, rotate(p, prop.rotation)));
      return el('path', {
        'data-prop': 'block',
        d: polygon(corners, proj, ink),
        ...strokeOr(ink, colour, style.props.fill),
      });
    }
    case 'strap': {
      // A strap hangs, so it is walked through its own sag rather than drawn straight.
      const a = resolveAnchor(prop.from, skeleton);
      const b = resolveAnchor(prop.to, skeleton);
      const mid = add(scaleVec(add(a, b), 0.5), [0, -Math.abs(prop.sag)]);
      const curve: Vec2[] = Array.from({ length: 9 }, (_, i): Vec2 => {
        const t = i / 8;
        const u = 1 - t;
        return [
          u * u * a[0] + 2 * u * t * mid[0] + t * t * b[0],
          u * u * a[1] + 2 * u * t * mid[1] + t * t * b[1],
        ];
      });
      return el('path', {
        'data-prop': 'strap',
        d: polygon(curve, proj, ink, false),
        ...strokeOr(ink, colour),
      });
    }
    case 'wall': {
      const line: Vec2[] = [
        [prop.x, skeleton.bounds.minY],
        [prop.x, skeleton.bounds.maxY],
      ];
      return el('path', { 'data-prop': 'wall', d: polygon(line, proj, ink, false), ...strokeOr(ink, colour) });
    }
    case 'surfboard': {
      const centre = prop.at ?? add(centroid(prop.under, skeleton), prop.offset);
      const outline = boardOutline(centre, prop.length, prop.rotation, prop.width);
      const stringer: Vec2[] = [
        add(centre, fromPolar(prop.rotation + 180, prop.length / 2)),
        add(centre, fromPolar(prop.rotation, prop.length / 2)),
      ];
      return group({ 'data-prop': 'surfboard' }, [
        el('path', { d: polygon(outline, proj, ink), ...strokeOr(ink, colour, style.props.fill) }),
        el('path', {
          'data-part': 'stringer',
          d: polygon(stringer, proj, ink, false),
          ...strokeOr(ink, colour),
          opacity: 0.5,
        }),
      ]);
    }
    case 'wave': {
      const crest: Ink = { ...ink, width: ink.width * 1.5 };
      return el('path', {
        'data-prop': 'wave',
        d: polygon(wavePoints(prop, cx), proj, crest, false),
        ...strokeOr(crest, colour),
      });
    }
  }
};

export const renderProps = (ctx: RenderContext, props: readonly Prop[]): SvgNode | null =>
  props.length === 0 ? null : group({ 'data-layer': 'props' }, props.map((p) => renderProp(p, ctx)));
