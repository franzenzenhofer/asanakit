import { describe, expect, it } from 'vitest';
import { expandSheet, parseSheet, sheetSchema } from '../../src/model/index.js';
import { loadLibrary } from '../../src/library/index.js';

const MINIMAL = `
asanakit: 2
id: test-sheet
name: Test Sheet
sections:
  - name: Warmup
    steps:
      - pose: adho-mukha-svanasana
      - pose: utthita-trikonasana
        side: both
        breath: exhale
        count: 5
`;

describe('sheetSchema', () => {
  it('applies presentation defaults', () => {
    const sheet = parseSheet(MINIMAL);
    expect(sheet.paper).toBe('a4');
    expect(sheet.orientation).toBe('portrait');
    expect(sheet.columns).toBe(4);
    expect(sheet.style).toBe('stick');
    expect(sheet.show).toEqual({ sanskrit: true, breath: true, numbers: true, cues: false });
  });

  it('rejects unknown styles and papers', () => {
    expect(() => parseSheet(MINIMAL.replace('name: Test Sheet', 'name: X\nstyle: neon'))).toThrow(/style/);
    expect(() => parseSheet(MINIMAL.replace('name: Test Sheet', 'name: X\npaper: a3'))).toThrow(/paper/);
  });

  it('shares the sequence step shape', () => {
    const sheet = parseSheet(MINIMAL);
    const step = sheet.sections[0]?.steps[1];
    expect(step?.side).toBe('both');
    expect(step?.count).toBe(5);
  });
});

describe('expandSheet', () => {
  it('expands side:both into left plus mirrored right, keeping sections', async () => {
    const library = await loadLibrary();
    const sheet = parseSheet(MINIMAL);
    const steps = expandSheet(sheet, (id) => library.poses.get(id));

    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.side)).toEqual(['none', 'left', 'right']);
    expect(steps[2]?.pose.figure.mirror).toBe(true);
    expect(steps.every((s) => s.section === 'Warmup')).toBe(true);
  });

  it('resolves inline poses before the library', async () => {
    const library = await loadLibrary();
    const base = library.poses.get('adho-mukha-svanasana');
    if (base === undefined) throw new Error('missing seed pose');

    const sheet = sheetSchema.parse({
      asanakit: 2,
      id: 'inline-sheet',
      name: 'Inline',
      sections: [{ name: 'S', steps: [{ pose: 'my-custom' }] }],
      poses: [{ ...base, id: 'my-custom', name: 'My Custom' }],
    });

    const steps = expandSheet(sheet, () => undefined);
    expect(steps[0]?.pose.name).toBe('My Custom');
  });

  it('fails loudly on unknown pose ids', () => {
    const sheet = parseSheet(MINIMAL);
    expect(() => expandSheet(sheet, () => undefined)).toThrow(/unknown pose "adho-mukha-svanasana"/);
  });
});
