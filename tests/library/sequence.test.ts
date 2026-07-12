import { describe, expect, test } from 'vitest';
import { DEFAULT_RIG } from '../../src/core/rig.js';
import { solveSkeleton } from '../../src/core/skeleton.js';
import { expandSequence, type Library } from '../../src/library/index.js';
import { parsePose, parseSequence, resolveFigure } from '../../src/model/index.js';
import type { LandmarkId } from '../../src/core/types.js';

const pose = parsePose(
  [
    'asanakit: 2',
    'id: lunge',
    'name: Lunge',
    'discipline: yoga',
    'camera: side',
    'figure:',
    '  world:',
    '    thighL: { azimuth: 0, elevation: -55 }',
    '    thighR: { azimuth: 180, elevation: -55 }',
    '    shinL: { azimuth: 0, elevation: -90 }',
    '    shinR: { azimuth: 180, elevation: -55 }',
  ].join('\n'),
  'lunge.pose.yaml',
);

const sequence = parseSequence(
  [
    'asanakit: 2',
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

const landmark = (index: number, id: LandmarkId): readonly [number, number, number] => {
  const steps = expandSequence(sequence, library);
  const step = steps[index];
  if (step === undefined) throw new Error('missing step');
  return solveSkeleton(resolveFigure(step.pose.figure), DEFAULT_RIG).landmarks[id];
};

describe('expandSequence', () => {
  test('expands a "both sides" step into two steps', () => {
    const steps = expandSequence(sequence, library);
    expect(steps).toHaveLength(2);
    expect(steps.map((s) => s.side)).toEqual(['left', 'right']);
  });

  test('the second side is the true mirror of the first, not a copy of it', () => {
    // In the left-side lunge the LEFT knee is forward; on the other side the
    // roles swap, so the left knee of step two stands where the right knee of
    // step one stood - and nowhere near its own old spot.
    const kneeLFirst = landmark(0, 'kneeL');
    const kneeRFirst = landmark(0, 'kneeR');
    const kneeLSecond = landmark(1, 'kneeL');
    expect(kneeLSecond[2]).toBeCloseTo(kneeRFirst[2], 8);
    expect(kneeLSecond[2]).not.toBeCloseTo(kneeLFirst[2], 3);
  });
});
