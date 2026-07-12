import { path } from 'd3-path';
import { interiorAngle } from '../core/angles.js';
import type { Bounds } from '../core/types.js';
import type { ViewSkeleton } from './camera.js';
import { add, angleOf, dist, fromPolar, lerp, normalLeft, scale as scaleVec, sub, type Vec2 } from '../core/vec2.js';
import type { Annotation } from '../model/schema.js';
import type { RenderContext } from './context.js';
import { boundsOfPoints } from './project.js';
import { resolveAnchor } from './props.js';
import { el, group, num, textEl, type SvgNode } from './svg.js';

export const ARROW_MARKER_ID = 'asanakit-arrow';

export const arrowMarker = (color: string): SvgNode =>
  el('defs', {}, [
    el(
      'marker',
      {
        id: ARROW_MARKER_ID,
        viewBox: '0 0 10 10',
        refX: 8,
        refY: 5,
        markerWidth: 5,
        markerHeight: 5,
        orient: 'auto-start-reverse',
        markerUnits: 'strokeWidth',
      },
      [el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: color })],
    ),
  ]);

const label = (text: string, at: Vec2, ctx: RenderContext, color?: string): SvgNode => {
  const { proj, style } = ctx;
  const [x, y] = proj.p(at);
  return textEl(
    'text',
    {
      x,
      y,
      fill: color ?? style.annotation.color,
      'font-family': style.annotation.fontFamily,
      'font-size': style.annotation.fontSize * proj.s,
      'dominant-baseline': 'middle',
    },
    text,
  );
};

type StrokeAttrs = Record<string, string | number | undefined>;

const strokeAttrs = ({ proj, style }: RenderContext, dashed: boolean, color?: string): StrokeAttrs => ({
  stroke: color ?? style.annotation.stroke,
  'stroke-width': style.annotation.strokeWidth * proj.s,
  'stroke-dasharray': dashed
    ? style.annotation.dash
        .split(' ')
        .map((v) => num(Number(v) * proj.s))
        .join(' ')
    : undefined,
  fill: 'none',
});

const angleArc = (a: Annotation & { type: 'angle' }, ctx: RenderContext): SvgNode => {
  const { skeleton, proj } = ctx;
  const centre = skeleton.landmarks[a.at];
  const from = skeleton.landmarks[a.from];
  const to = skeleton.landmarks[a.to];
  const measured = interiorAngle(from, centre, to);

  const a0 = angleOf(sub(from, centre));
  const a1 = angleOf(sub(to, centre));
  const r = a.radius * skeleton.scale;

  const p = path();
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    // Sweep the short way round, which is the way a joint angle is read.
    const sweep = ((((a1 - a0) % 360) + 540) % 360) - 180;
    const [px, py] = proj.p(add(centre, fromPolar(a0 + (sweep * i) / steps, r)));
    if (i === 0) p.moveTo(num(px), num(py));
    else p.lineTo(num(px), num(py));
  }

  const bisector = lerp(add(centre, fromPolar(a0, r)), add(centre, fromPolar(a1, r)), 0.5);
  const labelAt = add(centre, scaleVec(sub(bisector, centre), 1.9));
  const text = a.label ?? `${Math.round(measured)}°`;

  return group({ 'data-annotation': 'angle', 'data-joint': a.at }, [
    el('path', { d: p.toString(), ...strokeAttrs(ctx, false, a.color) }),
    label(text, labelAt, ctx, a.color),
  ]);
};

const alignmentLine = (a: Annotation & { type: 'line' }, ctx: RenderContext): SvgNode => {
  const { skeleton, proj } = ctx;
  const from = resolveAnchor(a.from, skeleton);
  const to = resolveAnchor(a.to, skeleton);
  const d = sub(to, from);
  const l = Math.max(dist(from, to), 1e-6);
  const ext = scaleVec(d, a.extend / l);
  const [x1, y1] = proj.p(sub(from, ext));
  const [x2, y2] = proj.p(add(to, ext));

  return group({ 'data-annotation': 'line' }, [
    el('line', { x1, y1, x2, y2, ...strokeAttrs(ctx, a.dashed, a.color) }),
    ...(a.label === undefined ? [] : [label(a.label, add(lerp(from, to, 0.5), scaleVec(normalLeft(from, to), 0.05)), ctx, a.color)]),
  ]);
};

const plumbLine = (a: Annotation & { type: 'plumb' }, ctx: RenderContext): SvgNode => {
  const { skeleton, proj, content } = ctx;
  const at = resolveAnchor(a.at, skeleton);
  const [x1, y1] = proj.p([at[0], content.minY]);
  const [x2, y2] = proj.p([at[0], content.maxY]);
  return group({ 'data-annotation': 'plumb' }, [
    el('line', { x1, y1, x2, y2, ...strokeAttrs(ctx, a.dashed, a.color) }),
    ...(a.label === undefined ? [] : [label(a.label, [at[0] + 0.03, content.maxY], ctx, a.color)]),
  ]);
};

const arrow = (a: Annotation & { type: 'arrow' }, ctx: RenderContext): SvgNode => {
  const { skeleton, proj } = ctx;
  const from = resolveAnchor(a.from, skeleton);
  const to = resolveAnchor(a.to, skeleton);
  const mid = add(lerp(from, to, 0.5), scaleVec(normalLeft(from, to), a.curve));
  const [x1, y1] = proj.p(from);
  const [mx, my] = proj.p(mid);
  const [x2, y2] = proj.p(to);

  const p = path();
  p.moveTo(num(x1), num(y1));
  p.quadraticCurveTo(num(mx), num(my), num(x2), num(y2));

  return group({ 'data-annotation': 'arrow' }, [
    el('path', {
      d: p.toString(),
      ...strokeAttrs(ctx, false, a.color),
      'marker-end': `url(#${ARROW_MARKER_ID})`,
    }),
    ...(a.label === undefined ? [] : [label(a.label, mid, ctx, a.color)]),
  ]);
};

const leaderLabel = (a: Annotation & { type: 'label' }, ctx: RenderContext): SvgNode => {
  const { skeleton, proj, style } = ctx;
  const at = resolveAnchor(a.at, skeleton);
  const target = add(at, a.offset);
  const [x1, y1] = proj.p(at);
  const [x2, y2] = proj.p(target);
  const textAnchor = a.offset[0] < 0 ? 'end' : 'start';
  const [tx, ty] = proj.p(add(target, [a.offset[0] < 0 ? -0.012 : 0.012, 0]));

  return group({ 'data-annotation': 'label' }, [
    el('line', { x1, y1, x2, y2, ...strokeAttrs(ctx, false, a.color) }),
    el('circle', { cx: x1, cy: y1, r: 0.008 * proj.s, fill: a.color ?? style.annotation.accent }),
    textEl(
      'text',
      {
        x: tx,
        y: ty,
        fill: a.color ?? style.annotation.color,
        'font-family': style.annotation.fontFamily,
        'font-size': style.annotation.fontSize * proj.s,
        'dominant-baseline': 'middle',
        'text-anchor': textAnchor,
      },
      a.text,
    ),
  ]);
};

const dot = (a: Annotation & { type: 'point' }, ctx: RenderContext): SvgNode => {
  const { skeleton, proj, style } = ctx;
  const at = resolveAnchor(a.at, skeleton);
  const [cx, cy] = proj.p(at);
  return group({ 'data-annotation': 'point' }, [
    el('circle', { cx, cy, r: 0.012 * proj.s, fill: a.color ?? style.annotation.accent }),
    ...(a.label === undefined ? [] : [label(a.label, add(at, [0.03, 0.02]), ctx, a.color)]),
  ]);
};

const annotationPoints = (a: Annotation, skeleton: ViewSkeleton): Vec2[] => {
  switch (a.type) {
    case 'angle':
      return [skeleton.landmarks[a.at]];
    case 'line':
    case 'arrow':
      return [resolveAnchor(a.from, skeleton), resolveAnchor(a.to, skeleton)];
    case 'plumb':
    case 'point':
      return [resolveAnchor(a.at, skeleton)];
    case 'label':
      return [resolveAnchor(a.at, skeleton), add(resolveAnchor(a.at, skeleton), a.offset)];
  }
};

export const annotationsBounds = (annotations: readonly Annotation[], skeleton: ViewSkeleton): Bounds | null => {
  const pts = annotations.flatMap((a) => annotationPoints(a, skeleton));
  return pts.length === 0 ? null : boundsOfPoints(pts);
};

export const renderAnnotations = (ctx: RenderContext, annotations: readonly Annotation[]): SvgNode | null => {
  if (annotations.length === 0) return null;

  const nodes = annotations.map((a): SvgNode => {
    switch (a.type) {
      case 'angle':
        return angleArc(a, ctx);
      case 'line':
        return alignmentLine(a, ctx);
      case 'plumb':
        return plumbLine(a, ctx);
      case 'arrow':
        return arrow(a, ctx);
      case 'label':
        return leaderLabel(a, ctx);
      case 'point':
        return dot(a, ctx);
    }
  });

  return group({ 'data-layer': 'annotations' }, nodes);
};
