import { describe, expect, test } from 'vitest';
import { channelsOf, isHinge, ROM, termFor, ELBOW_MAX_FLEXION, KNEE_MAX_FLEXION } from '../../src/anatomy/rom.js';
import { validatePose } from '../../src/anatomy/validate.js';
import { BONE_IDS } from '../../src/core/types.js';
import { parsePose } from '../../src/model/index.js';
import { propSchema } from '../../src/model/schema.js';

const poseWith = (joints: string): ReturnType<typeof parsePose> =>
  parsePose(`asanakit: 2\nid: t\nname: T\ndiscipline: yoga\nfigure:\n  joints:\n${joints}\n`, 't.pose.yaml');

describe('the range of motion table is the one source of truth', () => {
  test('every bone in the rig has a range of motion', () => {
    for (const bone of BONE_IDS) expect(Object.keys(ROM[bone]).length).toBeGreaterThan(0);
  });

  test('a hinge has exactly one bending channel - a knee does not abduct', () => {
    expect(isHinge('shinL')).toBe(true);
    expect(isHinge('shinR')).toBe(true);
    expect(channelsOf('shinL')).toEqual(['flex']);
    expect(ROM.shinL.abduct).toBeUndefined();
    expect(ROM.shinL.twist).toBeUndefined();
  });

  test('the elbow is a hinge, but the forearm still pronates and supinates', () => {
    expect(isHinge('forearmL')).toBe(true);
    expect(ROM.forearmL.abduct).toBeUndefined();
    expect(termFor('forearmL', 'twist', 40)).toBe('Supination');
    expect(termFor('forearmL', 'twist', -40)).toBe('Pronation');
  });

  test('the words are the clinical ones, and they follow the direction of travel', () => {
    expect(termFor('thighL', 'flex', 90)).toBe('Flexion');
    expect(termFor('thighL', 'flex', -20)).toBe('Extension');
    expect(termFor('upperArmL', 'abduct', 90)).toBe('Abduction');
    expect(termFor('upperArmL', 'abduct', -10)).toBe('Adduction');
    expect(termFor('upperArmL', 'twist', 30)).toBe('External rotation');
    expect(termFor('upperArmL', 'twist', -30)).toBe('Internal rotation');
    expect(termFor('spine', 'twist', 20)).toBe('Left axial rotation');
    // Verified against the solver: positive flex on the foot lifts the toes.
    expect(termFor('footL', 'flex', 15)).toBe('Dorsiflexion');
    expect(termFor('footL', 'flex', -30)).toBe('Plantarflexion');
  });

  test('lint and the sliders cannot disagree: they read the same limits', () => {
    expect(ROM.shinL.flex?.max).toBe(KNEE_MAX_FLEXION);
    expect(ROM.forearmL.flex?.max).toBe(ELBOW_MAX_FLEXION);

    // The top of the knee's slider is sound; a degree past it is not.
    expect(validatePose(poseWith(`    shinL: { flex: ${KNEE_MAX_FLEXION} }`))).toEqual([]);
    const over = validatePose(poseWith(`    shinL: { flex: ${KNEE_MAX_FLEXION + 15} }`));
    expect(over.map((i) => i.code)).toContain('knee-overflexion');
  });

  test('a slider cannot reach a body lint would reject', () => {
    // Both ends of every hinge slider must pass lint - that is the whole point.
    for (const bone of ['shinL', 'shinR', 'forearmL', 'forearmR'] as const) {
      const { min, max } = ROM[bone].flex as { min: number; max: number };
      for (const value of [min, 0, max]) {
        const issues = validatePose(poseWith(`    ${bone}: { flex: ${value} }`));
        expect(issues.filter((i) => i.code.includes(bone.startsWith('shin') ? 'knee' : 'elbow'))).toEqual([]);
      }
    }
  });
});

describe('a new prop arrives fully specified', () => {
  const ANCHORS: Record<string, Record<string, unknown>> = {
    block: { at: 'handTipL' },
    strap: { from: 'handTipL', to: 'toeL' },
  };

  test('every prop type parses with no undefined number left behind', () => {
    for (const type of ['ground', 'mat', 'block', 'strap', 'wall', 'surfboard', 'wave'] as const) {
      const prop = propSchema.parse({ type, ...(ANCHORS[type] ?? {}) }) as Record<string, unknown>;
      for (const [key, value] of Object.entries(prop)) {
        expect(value, `${type}.${key} must not be undefined`).not.toBeUndefined();
      }
    }
  });

  test('the mat a beginner gets is a real mat, not an empty form', () => {
    const mat = propSchema.parse({ type: 'mat' });
    if (mat.type !== 'mat') throw new Error('the mat schema stopped producing a mat');
    expect(mat.width).toBeGreaterThan(0);
    expect(mat.length).toBeGreaterThan(0);
    expect(mat.thickness).toBeGreaterThan(0);
    expect(mat.at).toEqual([0, 0]);
  });
});
