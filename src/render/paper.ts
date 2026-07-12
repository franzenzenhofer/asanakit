import type { PaperId, SheetSpec } from '../model/sheet.js';

/** Physical page in millimetres; sheet-page SVGs use 1 unit = 1 mm. */
export interface PaperSpec {
  readonly id: PaperId;
  readonly widthMm: number;
  readonly heightMm: number;
}

export const PAPERS: Record<PaperId, PaperSpec> = {
  a4: { id: 'a4', widthMm: 210, heightMm: 297 },
  letter: { id: 'letter', widthMm: 215.9, heightMm: 279.4 },
};

/** The paper a sheet prints on, orientation applied. */
export const paperFor = (sheet: Pick<SheetSpec, 'paper' | 'orientation'>): PaperSpec => {
  const base = PAPERS[sheet.paper];
  return sheet.orientation === 'landscape'
    ? { ...base, widthMm: base.heightMm, heightMm: base.widthMm }
    : base;
};
