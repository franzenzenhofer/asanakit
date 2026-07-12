import { describe, expect, test } from 'vitest';
import { DEFAULT_RIG } from '../../src/core/rig.js';
import { solveSkeleton } from '../../src/core/skeleton.js';
import { expandSequence, type Library } from '../../src/library/index.js';
import { parsePose, parseSequence, resolveFigure } from '../../src/model/index.js';

const pose = parsePose(
  [
    'asanakit: 1',
    'id: lunge',
    'name: Lunge',
    'discipline: yoga',
    'figure:',
    '  view: side',
    '  world:',
    '    thighL: -55',
    '    thighR: -125',
    '    shinL: -90',
    '    shinR: -125',
  ].join('\n'),
  'lunge.pose.yaml',
);

const sequence = parseSequence(
  [
    'asanakit: 1',
    'id: s',
    'name: S',
    'sections:',
    '  - name: Standing',
    '    steps:',
    '      - { pose: lunge, side: both }',
  ].join('\n'),
  's.seq.yaml',
);

const library: Library = { poses: new Map([['lunge', pose]]), sequences: new Map(), root: '.' };

const kneeX = (index: number): number => {
  const steps = expandSequence(sequence, library);
  const step = steps[index];
  if (step === undefined) throw new Error('missing step');
  return solveSkeleton(resolveFigure(step.pose.figure), DEFAULT_RIG).landmarks.kneeL[0];
};

describe('expandSequence', () => {
  test('expands a "both sides" step into two steps', () => {
    const steps = expandSequence(sequence, library);
    expect(steps).toHaveLength(2);
    expect(steps.map((s) => s.side)).toEqual(['left', 'right']);
  });

  test('the second side is the mirror image of the first, not a copy of it', () => {
    // The bug this guards: mirroring the joints AND reflecting the picture is a
    // double reflection, so both sides came out identical.
    expect(kneeX(1)).toBeCloseTo(-kneeX(0), 8);
    expect(kneeX(1)).not.toBeCloseTo(kneeX(0), 3);
  });
});
