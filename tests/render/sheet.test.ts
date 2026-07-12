import { describe, expect, test } from 'vitest';
import { parsePose, type PoseSpec } from '../../src/model/index.js';
import { renderSheet } from '../../src/render/index.js';

const pose = (id: string): PoseSpec =>
  parsePose(`posekit: 1\nid: ${id}\nname: ${id}\ndiscipline: yoga\n`, `${id}.pose.yaml`);

const POSES = ['a', 'b', 'c', 'd', 'e'].map(pose);

describe('renderSheet', () => {
  test('lays every pose out in a grid inside one SVG', () => {
    const svg = renderSheet(POSES, { columns: 3, cellWidth: 200, cellHeight: 260 });
    for (const p of POSES) expect(svg).toContain(`data-pose="${p.id}"`);
    expect(svg).toMatch(/^<svg /);
  });

  test('sizes the sheet from the column count and the number of poses', () => {
    const svg = renderSheet(POSES, { columns: 3, cellWidth: 200, cellHeight: 260 });
    // 5 poses in 3 columns = 2 rows.
    expect(svg).toContain('width="600"');
    expect(svg).toContain('height="520"');
  });

  test('places each pose in its own translated cell', () => {
    const svg = renderSheet(POSES, { columns: 2, cellWidth: 100, cellHeight: 100 });
    expect(svg).toContain('translate(0 0)');
    expect(svg).toContain('translate(100 0)');
    expect(svg).toContain('translate(0 100)');
  });

  test('renders an empty sheet without throwing', () => {
    expect(renderSheet([], {})).toContain('</svg>');
  });

  test('adds a sheet title when asked', () => {
    expect(renderSheet(POSES, { sheetTitle: 'Ashtanga Primary Series' })).toContain('Ashtanga Primary Series');
  });

  test('numbers the poses when asked', () => {
    const svg = renderSheet(POSES, { numbered: true });
    expect(svg).toContain('>1<');
    expect(svg).toContain('>5<');
  });
});
