import { curveBasis, line } from 'd3-shape';
import { path } from 'd3-path';
import { rotateVec3 } from '../core/quat.js';
import type { Bounds, LandmarkId } from '../core/types.js';
import { add, fromPolar, rotate, scale as scaleVec, type Vec2 } from '../core/vec2.js';
import type { Anchor, Prop } from '../model/schema.js';
import { BOARD_WIDTH_RATIO, matModel, type MatProp } from '../props/geometry.js';
import { viewQuat, type ViewSkeleton } from './camera.js';
import type { RenderContext } from './context.js';
import { boundsOfPoints, type Projection } from './project.js';
import { el, group, num, type SvgNode } from './svg.js';

export const resolveAnchor = (anchor: Anchor, skeleton: ViewSkeleton): Vec2 =>
  typeof anchor === 'string' ? skeleton.landmarks[anchor] : [anchor[0], anchor[1]];

const centreX = (skeleton: ViewSkeleton): number => (skeleton.bounds.minX + skeleton.bounds.maxX) / 2;

const centroid = (ids: readonly LandmarkId[], skeleton: ViewSkeleton): Vec2 => {
  if (ids.length === 0) return [centreX(skeleton), skeleton.bounds.minY];
  const pts = ids.map((id) => skeleton.landmarks[id]);
  return [
    pts.reduce((sum, p) => sum + p[0], 0) / pts.length,
    pts.reduce((sum, p) => sum + p[1], 0) / pts.length,
  ];
};

const smooth = line<Vec2>()
  .x((p) => p[0])
  .y((p) => p[1])
  .curve(curveBasis);

const WAVE_STEPS = 48;

/**
 * The mat is a real 3D box; its picture-plane footprint is the projection of
 * its top face through the active camera - a side camera sees the length, a
 * front camera the width, a yawed mat whatever the yaw exposes.
 */
const matSpan = (prop: MatProp, skeleton: ViewSkeleton): readonly [number, number] => {
  const q = viewQuat(skeleton.camera);
  const xs = matModel(prop, skeleton.source).top.map((corner) => rotateVec3(q, corner)[0]);
  return [Math.min(...xs), Math.max(...xs)];
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

const polygon = (points: readonly Vec2[], proj: Projection): string => {
  const p = path();
  points.forEach((pt, i) => {
    const [px, py] = proj.p(pt);
    if (i === 0) p.moveTo(num(px), num(py));
    else p.lineTo(num(px), num(py));
  });
  p.closePath();
  return p.toString();
};

const propPoints = (prop: Prop, skeleton: ViewSkeleton): Vec2[] => {
  const cx = centreX(skeleton);
  switch (prop.type) {
    case 'ground':
      return [
        [cx - prop.width / 2, prop.y],
        [cx + prop.width / 2, prop.y],
      ];
    case 'mat': {
      const [x1, x2] = matSpan(prop, skeleton);
      return [
        [x1, prop.y - prop.thickness],
        [x2, prop.y + prop.thickness],
      ];
    }
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
  const cx = centreX(skeleton);
  const attrs = { stroke: style.props.stroke, 'stroke-width': style.props.strokeWidth * proj.s };

  switch (prop.type) {
    case 'ground': {
      const [x1, y1] = proj.p([cx - prop.width / 2, prop.y]);
      const [x2, y2] = proj.p([cx + prop.width / 2, prop.y]);
      return el('line', { 'data-prop': 'ground', x1, y1, x2, y2, ...attrs, 'stroke-linecap': 'round' });
    }
    case 'mat': {
      const [mx1, mx2] = matSpan(prop, skeleton);
      const [x1, y1] = proj.p([mx1, prop.y + prop.thickness]);
      const [x2] = proj.p([mx2, prop.y]);
      return el('rect', {
        'data-prop': 'mat',
        x: x1,
        y: y1,
        width: x2 - x1,
        height: prop.thickness * 2 * proj.s,
        rx: prop.thickness * proj.s,
        fill: style.props.fill,
        ...attrs,
      });
    }
    case 'block': {
      const at = resolveAnchor(prop.at, skeleton);
      const local: Vec2[] = [
        [-prop.width / 2, -prop.height / 2],
        [prop.width / 2, -prop.height / 2],
        [prop.width / 2, prop.height / 2],
        [-prop.width / 2, prop.height / 2],
      ];
      const corners: Vec2[] = local.map((p) => add(at, rotate(p, prop.rotation)));
      return el('path', { 'data-prop': 'block', d: polygon(corners, proj), fill: style.props.fill, ...attrs });
    }
    case 'strap': {
      const a = resolveAnchor(prop.from, skeleton);
      const b = resolveAnchor(prop.to, skeleton);
      const mid = add(scaleVec(add(a, b), 0.5), [0, -Math.abs(prop.sag)]);
      const [ax, ay] = proj.p(a);
      const [mx, my] = proj.p(mid);
      const [bx, by] = proj.p(b);
      const p = path();
      p.moveTo(num(ax), num(ay));
      p.quadraticCurveTo(num(mx), num(my), num(bx), num(by));
      return el('path', { 'data-prop': 'strap', d: p.toString(), fill: 'none', ...attrs });
    }
    case 'wall': {
      const [x1, y1] = proj.p([prop.x, skeleton.bounds.minY]);
      const [x2, y2] = proj.p([prop.x, skeleton.bounds.maxY]);
      return el('line', { 'data-prop': 'wall', x1, y1, x2, y2, ...attrs });
    }
    case 'surfboard': {
      const centre = prop.at ?? add(centroid(prop.under, skeleton), prop.offset);
      const outline = boardOutline(centre, prop.length, prop.rotation, prop.width);
      const stringerEnd = add(centre, fromPolar(prop.rotation, prop.length / 2));
      const stringerStart = add(centre, fromPolar(prop.rotation + 180, prop.length / 2));
      const [sx1, sy1] = proj.p(stringerStart);
      const [sx2, sy2] = proj.p(stringerEnd);
      return group({ 'data-prop': 'surfboard' }, [
        el('path', { d: polygon(outline, proj), fill: style.props.fill, ...attrs, 'stroke-linejoin': 'round' }),
        el('line', { 'data-part': 'stringer', x1: sx1, y1: sy1, x2: sx2, y2: sy2, ...attrs, opacity: 0.5 }),
      ]);
    }
    case 'wave': {
      const pts = wavePoints(prop, cx).map((p) => proj.p(p));
      const d = smooth(pts as Vec2[]);
      return el('path', {
        'data-prop': 'wave',
        d: d ?? '',
        fill: 'none',
        ...attrs,
        'stroke-width': style.props.strokeWidth * 1.5 * proj.s,
        'stroke-linecap': 'round',
      });
    }
  }
};

export const renderProps = (ctx: RenderContext, props: readonly Prop[]): SvgNode | null =>
  props.length === 0 ? null : group({ 'data-layer': 'props' }, props.map((p) => renderProp(p, ctx)));
