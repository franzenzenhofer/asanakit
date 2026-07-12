/**
 * Regenerate the images used by the README and docs.
 * Run with: npm run gallery
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { expandSequence, loadLibrary } from '../src/library/index.js';
import { renderPng, renderSheet, renderSvg } from '../src/render/index.js';
import type { StyleId } from '../src/render/styles.js';

const OUT = 'examples';
await mkdir(OUT, { recursive: true });

const lib = await loadLibrary();

const pose = (id: string) => {
  const p = lib.poses.get(id);
  if (p === undefined) throw new Error(`No pose "${id}"`);
  return p;
};

const write = async (name: string, svg: string, width: number): Promise<void> => {
  await writeFile(`${OUT}/${name}.svg`, svg);
  await writeFile(`${OUT}/${name}.png`, renderPng(svg, { width }));
  process.stdout.write(`${OUT}/${name}.svg + .png\n`);
};

// The full Primary Series, in practice order.
const primary = lib.sequences.get('ashtanga-primary');
if (primary !== undefined) {
  const steps = expandSequence(primary, lib).map((s) => ({ ...s.pose, name: s.label }));
  await write(
    'ashtanga-primary-series',
    renderSheet(steps, {
      columns: 7,
      cellWidth: 250,
      cellHeight: 300,
      numbered: true,
      title: true,
      sheetTitle: 'Ashtanga Primary Series - Yoga Chikitsa',
    }),
    1750,
  );
}

// One pose in every style.
const STYLES: StyleId[] = ['stick', 'anatomy', 'silhouette', 'blueprint', 'ink', 'poster', 'minimal'];
await write(
  'styles',
  renderSheet(
    STYLES.map((s) => ({ ...pose('adho-mukha-svanasana'), id: s, name: s })),
    { columns: 7, cellWidth: 300, cellHeight: 260, title: true, styleOverride: {}, style: 'stick' },
  ),
  1400,
);
for (const style of STYLES) {
  await write(`style-${style}`, renderSvg(pose('adho-mukha-svanasana'), { style, width: 400, height: 320 }), 400);
}

// The anatomy style doing what it is for.
await write(
  'anatomy',
  renderSvg(pose('adho-mukha-svanasana'), { style: 'anatomy', width: 620, height: 460, title: true, caption: true }),
  900,
);

// Surf.
await write(
  'surf',
  renderSheet(
    ['paddling', 'pop-up', 'takeoff', 'bottom-turn', 'cutback', 'tube-stance', 'noseride', 'duck-dive'].map(pose),
    { columns: 4, cellWidth: 320, cellHeight: 260, title: true, style: 'silhouette', numbered: false },
  ),
  1280,
);

// Annotated infographic.
const triangle = pose('utthita-trikonasana');
await write(
  'annotated',
  renderSvg(
    {
      ...triangle,
      annotations: [
        ...triangle.annotations,
        { type: 'plumb', at: 'shoulderL', dashed: true, label: 'stack the shoulders' },
        { type: 'line', from: 'handTipL', to: 'handTipR', dashed: true, extend: 0.05, label: 'one straight line' },
      ],
    },
    { style: 'blueprint', width: 700, height: 520, title: true },
  ),
  1000,
);
