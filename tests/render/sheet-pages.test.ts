import { describe, expect, it } from 'vitest';
import { expandSequence, loadLibrary } from '../../src/library/index.js';
import { sheetSchema, type SheetSpec } from '../../src/model/index.js';
import { paperFor } from '../../src/render/paper.js';
import { buildPrintableHtml } from '../../src/render/printable.js';
import { layoutSheet } from '../../src/render/sheet-layout.js';
import { renderSheetPages } from '../../src/render/sheet-page.js';

const primarySheet = async (): Promise<{ sheet: SheetSpec; resolve: (id: string) => ReturnType<Awaited<ReturnType<typeof loadLibrary>>['poses']['get']> }> => {
  const library = await loadLibrary();
  const primary = library.sequences.get('ashtanga-primary');
  if (primary === undefined) throw new Error('missing ashtanga-primary');
  const sheet = sheetSchema.parse({
    asanakit: 2,
    id: 'primary-a4',
    name: 'Ashtanga Primary Series',
    footer: 'asanakit',
    sections: primary.sections,
  });
  return { sheet, resolve: (id: string) => library.poses.get(id) };
};

describe('layoutSheet', () => {
  it('paginates the Ashtanga primary onto a stable set of A4 pages', async () => {
    const { sheet, resolve } = await primarySheet();
    const layout = layoutSheet(sheet, resolve);

    const paper = paperFor(sheet);
    expect(paper.widthMm).toBe(210);
    expect(layout.pages.length).toBeGreaterThan(1);

    const steps = expandSequence(
      { asanakit: 2, id: 'x', name: 'x', sections: [...sheet.sections] },
      { poses: new Map([...sheet.sections.flatMap((s) => s.steps.map((st) => [st.pose, resolve(st.pose)] as const))].filter((e): e is [string, NonNullable<ReturnType<typeof resolve>>] => e[1] !== undefined)), sequences: new Map(), root: '' },
    );
    const placed = layout.pages.flatMap((p) => p.cells.filter((c) => c.kind === 'pose'));
    expect(placed).toHaveLength(steps.length);

    // Every cell stays inside the printable area.
    for (const page of layout.pages) {
      for (const cell of page.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(layout.margin - 1e-9);
        expect(cell.x + cell.width).toBeLessThanOrEqual(paper.widthMm - layout.margin + 1e-9);
        expect(cell.y + cell.height).toBeLessThanOrEqual(paper.heightMm - layout.margin - layout.footerBand + 1e-9);
      }
    }

    // A section band never sits orphaned at the bottom of a page.
    for (const page of layout.pages) {
      const last = page.cells.at(-1);
      expect(last?.kind).toBe('pose');
    }
  });
});

describe('renderSheetPages', () => {
  it('renders byte-deterministic paper-sized page SVGs', async () => {
    const { sheet, resolve } = await primarySheet();
    const layout = layoutSheet(sheet, resolve);

    const first = renderSheetPages(layout);
    const second = renderSheetPages(layout);
    expect(first).toEqual(second);
    expect(first.length).toBe(layout.pages.length);
    expect(first[0]).toContain('width="210mm"');
    expect(first[0]).toContain('viewBox="0 0 210 297"');
    expect(first[0]).toContain('Ashtanga Primary Series');
    expect(first[0]).toContain(`1 / ${layout.pages.length}`);
  });

  it('wraps pages into a printable html carrier', async () => {
    const { sheet, resolve } = await primarySheet();
    const layout = layoutSheet(sheet, resolve);
    const html = buildPrintableHtml(renderSheetPages(layout), layout.paper, sheet.name);

    expect(html).toContain('@page { size: 210mm 297mm; margin: 0; }');
    expect(html).toContain('break-after: page');
    expect(html.match(/class="page"/g)).toHaveLength(layout.pages.length);
  });
});
