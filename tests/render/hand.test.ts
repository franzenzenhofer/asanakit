import { describe, expect, test } from 'vitest';
import { parsePose } from '../../src/model/index.js';
import { renderSvg } from '../../src/render/index.js';
import { drawnLine } from '../../src/render/hand.js';

const POSE = parsePose('asanakit: 2\nid: t\nname: T\ndiscipline: yoga\n', 't.pose.yaml');

describe('the 2D view is a DRAWING, not a projection of the model', () => {
  test('bones are drawn strokes, not ruled lines', () => {
    const svg = renderSvg(POSE);
    // A drawn stroke is a curve. If this ever goes back to <line>, the 2D view
    // has quietly turned into a CAD plot, which is the one thing it must not be.
    expect(svg).toMatch(/<path data-bone="thighL"[^>]*d="M[^"]*C/);
    expect(svg).not.toMatch(/<line data-bone=/);
  });

  test('the skull is drawn round, not struck with a compass', () => {
    expect(renderSvg(POSE)).toMatch(/<path data-part="head"[^>]*d="M[^"]*C/);
    expect(renderSvg(POSE)).not.toMatch(/<ellipse data-part="head"/);
  });

  test('a hand of 0 is a ruler: the line goes exactly where it was told', () => {
    expect(drawnLine([0, 0], [10, 0], 0)).toBe('M0,0L10,0');
  });

  test('a hand bows off the straight line - but not by much', () => {
    // The line runs along y = 0, so every y in the path is how far the hand strayed.
    const d = drawnLine([0, 0], [100, 0], 1);
    const nums = [...d.matchAll(/-?[\d.]+/g)].map((m) => Number(m[0]));
    const ys = nums.filter((_, i) => i % 2 === 1);
    const strayed = Math.max(...ys.map(Math.abs));
    expect(strayed).toBeGreaterThan(0); // it is not a ruler...
    expect(strayed).toBeLessThan(4); // ...but it is not a scribble either
  });

  test('the same pose draws the same picture, forever', () => {
    // The wobble is a hash of the line's own endpoints, never a random number:
    // a drawing that changed on every render could not be a golden output.
    expect(renderSvg(POSE)).toBe(renderSvg(POSE));
    expect(renderSvg(POSE, { camera: 'right' })).not.toBe(renderSvg(POSE, { camera: 'front' }));
  });

  test('two different bones do not get the same wobble', () => {
    const a = drawnLine([0, 0], [50, 0], 1);
    const b = drawnLine([0, 20], [50, 20], 1);
    expect(a).not.toBe(b.replaceAll('20', '0'));
  });
});
