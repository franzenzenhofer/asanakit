import type { SheetSpec } from '../model/sheet.js';
import { expandSheet } from '../model/sheet.js';
import type { ExpandedStep, PoseResolver } from '../model/steps.js';
import { paperFor, type PaperSpec } from './paper.js';

/** All lengths in mm - 1 SVG unit on a sheet page is 1 mm on paper. */
const MARGIN = 10;
const GUTTER = 4;
const HEADER_BAND = 16;
const FOOTER_BAND = 8;
const SECTION_BAND = 8;
const CELL_RATIO = 1.32;
const CAPTION_BAND = 5;

export interface PlacedPose {
  readonly kind: 'pose';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly step: ExpandedStep;
  /** 1-based position across the whole sheet. */
  readonly index: number;
}

export interface PlacedSection {
  readonly kind: 'section';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly name: string;
}

export type PlacedCell = PlacedPose | PlacedSection;

export interface SheetPageLayout {
  /** 1-based page number. */
  readonly page: number;
  readonly cells: readonly PlacedCell[];
}

export interface SheetLayout {
  readonly sheet: SheetSpec;
  readonly paper: PaperSpec;
  readonly margin: number;
  readonly footerBand: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly captionBand: number;
  readonly pages: readonly SheetPageLayout[];
}

interface Cursor {
  y: number;
  col: number;
  cells: PlacedCell[];
  pages: PlacedCell[][];
}

/**
 * Paginate a sheet: a fixed grid of pose cells with full-width section bands,
 * broken into paper-sized pages. Pure math - rendering happens elsewhere.
 */
export const layoutSheet = (sheet: SheetSpec, resolve: PoseResolver = () => undefined): SheetLayout => {
  const paper = paperFor(sheet);
  const contentWidth = paper.widthMm - 2 * MARGIN;
  const cellWidth = (contentWidth - (sheet.columns - 1) * GUTTER) / sheet.columns;
  const captionBand = sheet.show.breath || sheet.show.sanskrit ? CAPTION_BAND : 0;
  const cellHeight = cellWidth * CELL_RATIO + captionBand;
  const limit = paper.heightMm - MARGIN - FOOTER_BAND;
  const topOf = (page: number): number => MARGIN + (page === 1 ? HEADER_BAND : 0);

  const cursor: Cursor = { y: topOf(1), col: 0, cells: [], pages: [] };

  const breakPage = (): void => {
    cursor.pages.push(cursor.cells);
    cursor.cells = [];
    cursor.y = topOf(cursor.pages.length + 1);
    cursor.col = 0;
  };

  const endRow = (): void => {
    if (cursor.col === 0) return;
    cursor.y += cellHeight + GUTTER;
    cursor.col = 0;
  };

  const ensureRoom = (height: number): void => {
    if (cursor.y + height > limit) breakPage();
  };

  const steps = expandSheet(sheet, resolve);
  let section = '';
  let index = 0;

  for (const step of steps) {
    if (step.section !== section && step.section !== '') {
      section = step.section;
      endRow();
      // A section band directly at the page bottom would orphan its title.
      ensureRoom(SECTION_BAND + GUTTER + cellHeight);
      cursor.cells.push({
        kind: 'section',
        x: MARGIN,
        y: cursor.y,
        width: contentWidth,
        height: SECTION_BAND,
        name: step.section,
      });
      cursor.y += SECTION_BAND + GUTTER * 0.5;
    }

    if (cursor.col >= sheet.columns) endRow();
    if (cursor.col === 0) ensureRoom(cellHeight);

    index += 1;
    cursor.cells.push({
      kind: 'pose',
      x: MARGIN + cursor.col * (cellWidth + GUTTER),
      y: cursor.y,
      width: cellWidth,
      height: cellHeight,
      step,
      index,
    });
    cursor.col += 1;
  }

  cursor.pages.push(cursor.cells);

  return {
    sheet,
    paper,
    margin: MARGIN,
    footerBand: FOOTER_BAND,
    cellWidth,
    cellHeight,
    captionBand,
    pages: cursor.pages.map((cells, i) => ({ page: i + 1, cells })),
  };
};
