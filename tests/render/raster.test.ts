import { describe, expect, test } from 'vitest';
import { parsePose } from '../../src/model/index.js';
import { optimizeSvg, renderPng, renderSvg } from '../../src/render/index.js';

const POSE = parsePose('asanakit: 1\nid: t\nname: Tadasana\nsanskrit: Tāḍāsana\ndiscipline: yoga\n', 't.pose.yaml');

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe('renderPng', () => {
  test('rasterises an SVG to a real PNG buffer', () => {
    const png = renderPng(renderSvg(POSE, { width: 300, height: 400 }));
    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
    expect(png.byteLength).toBeGreaterThan(500);
  });

  test('renders at a requested pixel width, independent of the SVG canvas', () => {
    const png = renderPng(renderSvg(POSE, { width: 300, height: 400 }), { width: 900 });
    // PNG width is a big-endian uint32 at byte offset 16.
    expect(png.readUInt32BE(16)).toBe(900);
  });

  test('is deterministic: the same SVG rasterises to the same bytes', () => {
    const svg = renderSvg(POSE, { width: 200, height: 200 });
    expect(renderPng(svg).equals(renderPng(svg))).toBe(true);
  });
});

describe('optimizeSvg', () => {
  test('shrinks the document but keeps it a valid SVG', () => {
    const svg = renderSvg(POSE, { width: 600, height: 800, style: 'anatomy' });
    const optimized = optimizeSvg(svg);
    expect(optimized.length).toBeLessThan(svg.length);
    expect(optimized).toContain('<svg');
    expect(optimized).toContain('</svg>');
  });

  test('keeps the data attributes that make the output machine-readable', () => {
    const optimized = optimizeSvg(renderSvg(POSE, { style: 'anatomy' }));
    expect(optimized).toContain('data-bone="thighL"');
    expect(optimized).toContain('data-muscle="quadriceps"');
    expect(optimized).toContain('data-pose="t"');
  });

  test('still rasterises after optimisation', () => {
    const png = renderPng(optimizeSvg(renderSvg(POSE)));
    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
  });
});
