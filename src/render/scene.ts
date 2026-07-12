import { resolveCamera, type CameraInput } from '../core/camera.js';
import { DEFAULT_RIG } from '../core/rig.js';
import { solveSkeleton } from '../core/skeleton.js';
import type { Bounds, Rig, Skeleton } from '../core/types.js';
import { resolveFigure, type PoseSpec } from '../model/index.js';
import { renderMuscles } from './anatomy.js';
import { annotationsBounds, arrowMarker, renderAnnotations } from './annotations.js';
import { viewSkeleton, type ViewSkeleton } from './camera.js';
import type { RenderContext } from './context.js';
import { renderFigure } from './figure.js';
import { fitProjection, padBounds, unionBounds, type Projection } from './project.js';
import { propsBounds, renderProps } from './props.js';
import { resolveStyle, type Style, type StyleId, type StyleOverride } from './styles.js';
import { el, group, serialize, textEl, type SvgNode } from './svg.js';

export interface RenderOptions {
  readonly width?: number;
  readonly height?: number;
  readonly style?: StyleId;
  readonly styleOverride?: StyleOverride;
  readonly rig?: Rig;
  /** Viewpoint: a preset name or orbit angles. Overrides the pose's own `camera`. */
  readonly camera?: CameraInput;
  /** A pre-solved (e.g. physics-settled) skeleton to render instead of solving the figure. */
  readonly skeleton?: Skeleton;
  /** Draw the pose name (and Sanskrit name) above the figure. */
  readonly title?: boolean;
  /** Draw the teaching cues below the figure. */
  readonly caption?: boolean;
  readonly background?: string;
  /** Force the muscle layer on or off, overriding the style. */
  readonly muscles?: boolean;
}

export const DEFAULT_WIDTH = 600;
export const DEFAULT_HEIGHT = 800;

const TITLE_BAND = 2.4;
const CAPTION_LINE = 1.55;

const shiftProjection = (proj: Projection, dy: number): Projection => ({
  s: proj.s,
  p: (v): [number, number] => {
    const [x, y] = proj.p(v);
    return [x, y + dy];
  },
});

/** Everything that must be visible: the figure, its props and its annotations. */
export const contentBounds = (pose: PoseSpec, skeleton: ViewSkeleton, style: Style): Bounds => {
  const headPad = Math.max(style.head.rx, style.head.ry) * skeleton.scale;
  let bounds = padBounds(skeleton.bounds, headPad);

  const props = propsBounds(pose.props, skeleton);
  if (props !== null) bounds = unionBounds(bounds, props);

  const annotations = annotationsBounds(pose.annotations, skeleton);
  if (annotations !== null) bounds = unionBounds(bounds, annotations);

  return padBounds(bounds, style.padding);
};

const styleFor = (options: RenderOptions): Style => {
  const base = resolveStyle(options.style ?? 'stick', options.styleOverride ?? {});
  if (options.muscles === undefined) return base;
  return { ...base, muscles: { ...base.muscles, show: options.muscles } };
};

interface Layout {
  readonly width: number;
  readonly height: number;
  readonly titleSize: number;
  readonly captionSize: number;
  readonly cues: readonly string[];
  readonly titleBand: number;
  readonly captionBand: number;
}

const layoutFor = (pose: PoseSpec, options: RenderOptions, style: Style): Layout => {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const titleSize = style.text.titleSize * height;
  const captionSize = style.text.captionSize * height;
  const cues = options.caption === true ? pose.cues : [];

  return {
    width,
    height,
    titleSize,
    captionSize,
    cues,
    titleBand: options.title === true ? titleSize * TITLE_BAND : 0,
    captionBand: cues.length === 0 ? 0 : captionSize * (1 + cues.length * CAPTION_LINE),
  };
};

/**
 * Shrink a title until it fits the canvas. A clipped pose name is a broken sheet,
 * and "Parivrtta Parsvakonasana" is not a short word.
 */
const AVG_GLYPH_WIDTH = 0.56;
const TITLE_SAFE_WIDTH = 0.84;

const fitText = (text: string, size: number, width: number): number =>
  Math.min(size, (width * TITLE_SAFE_WIDTH) / (Math.max(text.length, 1) * AVG_GLYPH_WIDTH));

const titleBlock = (pose: PoseSpec, layout: Layout, style: Style): SvgNode => {
  const size = fitText(pose.name, layout.titleSize, layout.width);
  return group({ 'data-layer': 'title' }, [
    textEl(
      'text',
      {
        x: layout.width / 2,
        y: size * 1.15,
        'text-anchor': 'middle',
        fill: style.text.color,
        'font-family': style.text.fontFamily,
        'font-size': size,
        'font-weight': 600,
      },
      pose.name,
    ),
    ...(pose.sanskrit === undefined
      ? []
      : [
          textEl(
            'text',
            {
              x: layout.width / 2,
              y: layout.titleSize * 2,
              'text-anchor': 'middle',
              fill: style.text.muted,
              'font-family': style.text.fontFamily,
              'font-size': fitText(pose.sanskrit, layout.titleSize * 0.55, layout.width),
              'font-style': 'italic',
            },
            pose.sanskrit,
          ),
        ]),
  ]);
};

const captionBlock = (layout: Layout, style: Style): SvgNode => {
  const size = layout.captionSize;
  const top = layout.height - layout.captionBand;
  return group(
    { 'data-layer': 'caption' },
    layout.cues.map((cue, i) =>
      textEl(
        'text',
        {
          x: layout.width / 2,
          y: top + size * (1 + i * CAPTION_LINE),
          'text-anchor': 'middle',
          fill: style.text.muted,
          'font-family': style.text.fontFamily,
          'font-size': size,
        },
        cue,
      ),
    ),
  );
};

const compact = (nodes: readonly (SvgNode | null)[]): SvgNode[] => nodes.filter((n): n is SvgNode => n !== null);

const layers = (pose: PoseSpec, ctx: RenderContext): SvgNode[] =>
  compact([
    renderProps(ctx, pose.props),
    renderMuscles(ctx, pose.muscles.engaged, pose.muscles.stretched),
    renderFigure(ctx),
    renderAnnotations(ctx, pose.annotations),
  ]);

export const renderSvgNode = (pose: PoseSpec, options: RenderOptions = {}): SvgNode => {
  const style = styleFor(options);
  const layout = layoutFor(pose, options, style);
  const { width, height } = layout;

  const solved = options.skeleton ?? solveSkeleton(resolveFigure(pose.figure), options.rig ?? DEFAULT_RIG);
  const camera = resolveCamera(options.camera ?? pose.camera);
  const skeleton = viewSkeleton(solved, camera);
  const content = contentBounds(pose, skeleton, style);
  const stage = Math.max(height - layout.titleBand - layout.captionBand, 1);

  const ctx: RenderContext = {
    skeleton,
    content,
    style,
    proj: shiftProjection(fitProjection(content, width, stage), layout.titleBand),
  };

  const background = options.background ?? style.background;

  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      'data-pose': pose.id,
      'data-style': style.id,
      role: 'img',
      'aria-label': `${pose.name}${pose.sanskrit === undefined ? '' : ` (${pose.sanskrit})`}`,
    },
    [
      arrowMarker(style.annotation.accent),
      ...(background === 'none'
        ? []
        : [el('rect', { 'data-layer': 'background', x: 0, y: 0, width, height, fill: background })]),
      ...(options.title === true ? [titleBlock(pose, layout, style)] : []),
      ...layers(pose, ctx),
      ...(layout.cues.length === 0 ? [] : [captionBlock(layout, style)]),
    ],
  );
};

/** Render a pose to a standalone, deterministic SVG document. */
export const renderSvg = (pose: PoseSpec, options: RenderOptions = {}): string =>
  serialize(renderSvgNode(pose, options));
