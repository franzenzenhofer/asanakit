import type { Skeleton } from '../core/types.js';
import type { PoseSpec } from '../model/index.js';
import { renderSvgNode, type RenderOptions } from './scene.js';
import { resolveStyle } from './styles.js';
import { el, group, serialize, textEl, type SvgNode } from './svg.js';

export interface SheetOptions extends RenderOptions {
  readonly columns?: number;
  readonly cellWidth?: number;
  readonly cellHeight?: number;
  readonly sheetTitle?: string;
  /** Print the sequence position on each cell - what a practice sheet needs. */
  readonly numbered?: boolean;
  readonly gutter?: number;
  /** Pre-solved (e.g. physics-settled) skeletons, aligned by index with the poses. */
  readonly skeletons?: readonly (Skeleton | undefined)[];
}

const DEFAULTS = { columns: 6, cellWidth: 260, cellHeight: 340, gutter: 0 };

/**
 * A contact sheet is just nested <svg> elements: each pose already renders into
 * its own viewBox, so laying out a whole series is a translate per cell. No
 * packing library needed while the cells are a uniform size.
 */
export const renderSheetNode = (poses: readonly PoseSpec[], options: SheetOptions = {}): SvgNode => {
  const columns = Math.max(1, options.columns ?? DEFAULTS.columns);
  const cw = options.cellWidth ?? DEFAULTS.cellWidth;
  const ch = options.cellHeight ?? DEFAULTS.cellHeight;
  const gutter = options.gutter ?? DEFAULTS.gutter;
  const style = resolveStyle(options.style ?? 'stick', options.styleOverride ?? {});

  const rows = Math.max(1, Math.ceil(poses.length / columns));
  const titleSize = options.sheetTitle === undefined ? 0 : Math.round(ch * 0.11);
  const titleBand = titleSize === 0 ? 0 : titleSize * 2.2;

  const width = columns * cw + (columns - 1) * gutter;
  const height = rows * ch + (rows - 1) * gutter + titleBand;

  const cells = poses.map((pose, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * (cw + gutter);
    const y = titleBand + row * (ch + gutter);

    const skeleton = options.skeletons?.[i];
    const inner = renderSvgNode(pose, {
      ...options,
      ...(skeleton === undefined ? {} : { skeleton }),
      width: cw,
      height: ch,
      background: options.background ?? 'none',
      title: options.title ?? true,
    });

    return group({ transform: `translate(${x} ${y})`, 'data-cell': String(i + 1) }, [
      inner,
      ...(options.numbered === true
        ? [
            textEl(
              'text',
              {
                x: cw * 0.04,
                y: ch * 0.06,
                fill: style.text.muted,
                'font-family': style.text.fontFamily,
                'font-size': ch * 0.038,
                'font-weight': 600,
              },
              String(i + 1),
            ),
          ]
        : []),
    ]);
  });

  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      'data-sheet': poses.length,
    },
    [
      el('rect', { x: 0, y: 0, width, height, fill: options.background ?? style.background }),
      ...(options.sheetTitle === undefined
        ? []
        : [
            textEl(
              'text',
              {
                x: width / 2,
                y: titleSize * 1.4,
                'text-anchor': 'middle',
                fill: style.text.color,
                'font-family': style.text.fontFamily,
                'font-size': titleSize,
                'font-weight': 700,
              },
              options.sheetTitle,
            ),
          ]),
      ...cells,
    ],
  );
};

export const renderSheet = (poses: readonly PoseSpec[], options: SheetOptions = {}): string =>
  serialize(renderSheetNode(poses, options));
