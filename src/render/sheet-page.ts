import type { Skeleton } from '../core/types.js';
import type { PoseSpec } from '../model/index.js';
import type { ExpandedStep } from '../model/steps.js';
import { renderSvgNode } from './scene.js';
import type { PlacedPose, PlacedSection, SheetLayout, SheetPageLayout } from './sheet-layout.js';
import { resolveStyle, type Style } from './styles.js';
import { el, group, serialize, textEl, type SvgNode } from './svg.js';

export interface SheetPageRenderOptions {
  /** Pre-solved skeletons keyed by `skeletonKey(pose)` - required for physics poses. */
  readonly skeletons?: ReadonlyMap<string, Skeleton>;
}

/** The cache key one figure solves under: mirrored sides solve differently. */
export const skeletonKey = (pose: PoseSpec): string => (pose.figure.mirror ? `${pose.id}|mirror` : pose.id);

const BREATH_GLYPH = { inhale: '▲', exhale: '▼', hold: '■', free: '∼' } as const;

const captionText = (step: ExpandedStep): string => {
  const parts: string[] = [];
  if (step.breath !== undefined) parts.push(BREATH_GLYPH[step.breath]);
  if (step.count > 1) parts.push(`×${step.count}`);
  if (step.side !== 'none') parts.push(step.side === 'left' ? 'L' : 'R');
  return parts.join('  ');
};

interface TextSpec {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly fill: string;
  readonly extra?: Record<string, string | number>;
}

const text = (spec: TextSpec, style: Style, content: string): SvgNode =>
  textEl(
    'text',
    { x: spec.x, y: spec.y, fill: spec.fill, 'font-family': style.text.fontFamily, 'font-size': spec.size, ...spec.extra },
    content,
  );

const poseCell = (cell: PlacedPose, layout: SheetLayout, style: Style, options: SheetPageRenderOptions): SvgNode => {
  const { sheet, captionBand } = layout;
  const { sanskrit, ...bare } = cell.step.pose;
  const pose: PoseSpec = {
    ...bare,
    name: cell.step.label,
    cues: [],
    ...(sheet.show.sanskrit && sanskrit !== undefined ? { sanskrit } : {}),
  };
  const skeleton = options.skeletons?.get(skeletonKey(cell.step.pose));

  const figure = renderSvgNode(pose, {
    style: sheet.style,
    width: cell.width,
    height: cell.height - captionBand,
    title: true,
    background: 'none',
    ...(skeleton === undefined ? {} : { skeleton }),
  });

  const caption = sheet.show.breath ? captionText(cell.step) : '';

  return group({ transform: `translate(${cell.x} ${cell.y})`, 'data-cell': String(cell.index) }, [
    figure,
    ...(sheet.show.numbers
      ? [text({ x: 1.2, y: 3.2, size: 3, fill: style.text.muted, extra: { 'font-weight': 600 } }, style, String(cell.index))]
      : []),
    ...(caption === ''
      ? []
      : [
          text(
            { x: cell.width / 2, y: cell.height - 1.4, size: 2.8, fill: style.text.muted, extra: { 'text-anchor': 'middle' } },
            style,
            caption,
          ),
        ]),
  ]);
};

const sectionCell = (cell: PlacedSection, style: Style): SvgNode =>
  group({ 'data-section': cell.name }, [
    text(
      { x: cell.x, y: cell.y + cell.height * 0.72, size: 4.2, fill: style.text.color, extra: { 'font-weight': 700 } },
      style,
      cell.name,
    ),
    el('line', {
      x1: cell.x,
      y1: cell.y + cell.height,
      x2: cell.x + cell.width,
      y2: cell.y + cell.height,
      stroke: style.text.muted,
      'stroke-width': 0.25,
    }),
  ]);

const header = (layout: SheetLayout, style: Style): SvgNode => {
  const { sheet, margin } = layout;
  return group({ 'data-layer': 'header' }, [
    text(
      { x: margin, y: margin + 6, size: 6.5, fill: style.text.color, extra: { 'font-weight': 700 } },
      style,
      sheet.header ?? sheet.name,
    ),
    ...(sheet.description === undefined
      ? []
      : [text({ x: margin, y: margin + 11.5, size: 3, fill: style.text.muted }, style, sheet.description)]),
  ]);
};

const footer = (layout: SheetLayout, page: number, style: Style): SvgNode => {
  const { sheet, paper, margin } = layout;
  const y = paper.heightMm - margin * 0.5;
  return group({ 'data-layer': 'footer' }, [
    ...(sheet.footer === undefined ? [] : [text({ x: margin, y, size: 2.8, fill: style.text.muted }, style, sheet.footer)]),
    text(
      { x: paper.widthMm - margin, y, size: 2.8, fill: style.text.muted, extra: { 'text-anchor': 'end' } },
      style,
      `${page} / ${layout.pages.length}`,
    ),
  ]);
};

/** One paper-sized page: viewBox in mm, so the preview IS the printout. */
export const renderSheetPageNode = (
  layout: SheetLayout,
  page: SheetPageLayout,
  options: SheetPageRenderOptions = {},
): SvgNode => {
  const style = resolveStyle(layout.sheet.style);
  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${layout.paper.widthMm} ${layout.paper.heightMm}`,
      width: `${layout.paper.widthMm}mm`,
      height: `${layout.paper.heightMm}mm`,
      'data-sheet-page': page.page,
    },
    [
      el('rect', { x: 0, y: 0, width: layout.paper.widthMm, height: layout.paper.heightMm, fill: style.background }),
      ...(page.page === 1 ? [header(layout, style)] : []),
      ...page.cells.map((cell) => (cell.kind === 'pose' ? poseCell(cell, layout, style, options) : sectionCell(cell, style))),
      footer(layout, page.page, style),
    ],
  );
};

/** Every page of a sheet as standalone SVG documents, ready to print or rasterize. */
export const renderSheetPages = (layout: SheetLayout, options: SheetPageRenderOptions = {}): string[] =>
  layout.pages.map((page) => serialize(renderSheetPageNode(layout, page, options)));
