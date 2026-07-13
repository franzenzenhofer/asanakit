import { describe, expect, test } from 'vitest';
import { parsePose } from '../../src/model/index.js';
import { renderSvg } from '../../src/render/index.js';
import { drawnLine } from '../../src/render/hand.js';

const POSE = parsePose('asanakit: 2\nid: t\nname: T\ndiscipline: yoga\n', 't.pose.yaml');

describe('the 2D view is a DRAWING, not a projection of the model', () => {
  test('bones are pen marks, not ruled lines', () => {
    const svg = renderSvg(POSE);
    // A pen mark is a filled SHAPE - the outline of the ink the pen left - not a
    // path with a width. If this ever goes back to <line>, the 2D view has quietly
    // turned into a CAD plot, which is the one thing it must not be.
    expect(svg).toMatch(/<path data-bone="thighL"[^>]*fill="#/);
    expect(svg).not.toMatch(/<line data-bone=/);
  });

  test('the skull is drawn round, not struck with a compass', () => {
    expect(renderSvg(POSE)).toContain('data-part="head-rim"');
    expect(renderSvg(POSE)).not.toMatch(/<ellipse data-part="head"/);
  });

  test('a blueprint is RULED - that is what a blueprint is', () => {
    const svg = renderSvg(POSE, { style: 'blueprint' });
    expect(svg).toMatch(/<path data-bone="thighL"[^>]*fill="none"/);
    expect(svg).not.toContain('data-part="head-rim"');
  });

  test('a hand of 0 is a ruler: the line goes exactly where it was told', () => {
    expect(drawnLine([0, 0], [10, 0], { hand: 0, width: 4 })).toBe('M0,0L10,0');
  });

  test('a hand bows off the straight line - but not by much', () => {
    // The line runs along y = 0, so every y in the outline is the pen's own width
    // plus however far the hand strayed. It must be a line, not a scribble.
    const d = drawnLine([0, 0], [100, 0], { hand: 1, width: 6 });
    const nums = [...d.matchAll(/-?[\d.]+/g)].map((m) => Number(m[0]));
    const ys = nums.filter((_, i) => i % 2 === 1);
    const strayed = Math.max(...ys.map(Math.abs));
    expect(strayed).toBeGreaterThan(0);
    expect(strayed).toBeLessThan(10);
  });

  test('the same pose draws the same picture, forever', () => {
    // The wobble is a hash of the line's own endpoints, never a random number:
    // a drawing that changed on every render could not be a golden output.
    expect(renderSvg(POSE)).toBe(renderSvg(POSE));
    expect(renderSvg(POSE, { camera: 'right' })).not.toBe(renderSvg(POSE, { camera: 'front' }));
  });

  test('two different bones do not get the same wander', () => {
    const a = drawnLine([0, 0], [50, 0], { hand: 1, width: 4 });
    const b = drawnLine([0, 20], [50, 20], { hand: 1, width: 4 });
    expect(a).not.toBe(b.replaceAll('20', '0'));
  });
});
