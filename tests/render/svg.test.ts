import { describe, expect, test } from 'vitest';
import { parsePose } from '../../src/model/index.js';
import { renderSvg } from '../../src/render/index.js';
import { STYLES } from '../../src/render/styles.js';

const pose = (body: string) => parsePose(`posekit: 1\nid: t\nname: T\ndiscipline: yoga\n${body}`, 't.pose.yaml');

const PLAIN = pose('');

describe('renderSvg', () => {
  test('produces a standalone SVG document', () => {
    const svg = renderSvg(PLAIN);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0');
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  test('is deterministic: the same pose renders byte-identical SVG', () => {
    expect(renderSvg(PLAIN)).toBe(renderSvg(PLAIN));
  });

  test('honours the requested canvas size', () => {
    const svg = renderSvg(PLAIN, { width: 800, height: 600 });
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
  });

  test('escapes text so a pose name cannot inject markup', () => {
    const nasty = parsePose('posekit: 1\nid: t\nname: "</svg><script>x</script>"\ndiscipline: yoga\n', 't.yaml');
    const svg = renderSvg(nasty, { title: true });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;/svg&gt;');
  });

  test('draws one path or line per limb in stick style', () => {
    const svg = renderSvg(PLAIN, { style: 'stick' });
    expect(svg).toContain('data-bone="thighL"');
    expect(svg).toContain('data-bone="forearmR"');
    expect(svg).toContain('data-part="head"');
  });

  test('every named style renders without throwing', () => {
    for (const name of Object.keys(STYLES)) {
      expect(renderSvg(PLAIN, { style: name as keyof typeof STYLES })).toContain('</svg>');
    }
  });

  test('anatomy style adds muscle shapes with stable ids', () => {
    const svg = renderSvg(PLAIN, { style: 'anatomy' });
    expect(svg).toContain('data-muscle="quadriceps"');
    expect(svg).toContain('data-muscle="deltoid"');
  });

  test('highlights engaged and stretched muscles distinctly', () => {
    const p = pose('muscles:\n  engaged: [quadriceps]\n  stretched: [hamstrings]\n');
    const svg = renderSvg(p, { style: 'anatomy' });
    expect(svg).toContain('data-muscle-state="engaged"');
    expect(svg).toContain('data-muscle-state="stretched"');
  });
});

describe('renderSvg - props and annotations', () => {
  test('renders a mat under the figure', () => {
    const svg = renderSvg(pose('props:\n  - type: mat\n'));
    expect(svg).toContain('data-prop="mat"');
  });

  test('renders a surfboard placed under the feet', () => {
    const svg = renderSvg(pose('props:\n  - type: surfboard\n    under: [ankleL, ankleR]\n'));
    expect(svg).toContain('data-prop="surfboard"');
  });

  test('renders a wave', () => {
    const svg = renderSvg(pose('props:\n  - type: wave\n'));
    expect(svg).toContain('data-prop="wave"');
  });

  test('labels an angle annotation with the measured degrees when no label is given', () => {
    const svg = renderSvg(pose('annotations:\n  - type: angle\n    at: kneeL\n    from: hipJointL\n    to: ankleL\n'));
    expect(svg).toContain('data-annotation="angle"');
    // A straight leg in the rest pose measures 180 degrees.
    expect(svg).toContain('180°');
  });

  test('renders alignment lines, plumb lines, arrows and labels', () => {
    const svg = renderSvg(
      pose(
        [
          'annotations:',
          '  - type: line',
          '    from: wristL',
          '    to: wristR',
          '  - type: plumb',
          '    at: shoulderL',
          '  - type: arrow',
          '    from: hipCenter',
          '    to: headTop',
          '  - type: label',
          '    at: kneeL',
          '    text: knee over ankle',
        ].join('\n'),
      ),
    );
    expect(svg).toContain('data-annotation="line"');
    expect(svg).toContain('data-annotation="plumb"');
    expect(svg).toContain('data-annotation="arrow"');
    expect(svg).toContain('knee over ankle');
  });
});

describe('renderSvg - framing', () => {
  test('fits a wide pose inside the canvas without clipping', () => {
    const wide = pose('figure:\n  joints:\n    upperArmL: 90\n    upperArmR: 90\n');
    const svg = renderSvg(wide, { width: 400, height: 400 });
    const box = /viewBox="([-\d. ]+)"/.exec(svg)?.[1]?.split(' ').map(Number);
    expect(box).toBeDefined();
    const xs = [...svg.matchAll(/ x1="([-\d.]+)"/g)].map((m) => Number(m[1]));
    const [minX, , w] = box as number[];
    expect(Math.min(...xs)).toBeGreaterThanOrEqual((minX as number) - 1);
    expect(Math.max(...xs)).toBeLessThanOrEqual((minX as number) + (w as number) + 1);
  });
});
