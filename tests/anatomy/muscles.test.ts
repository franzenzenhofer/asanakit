import { describe, expect, test } from 'vitest';
import { MUSCLES, MUSCLE_IDS, muscleInstances } from '../../src/anatomy/muscles.js';

describe('muscle definitions', () => {
  test('every muscle sits on a bone the rig actually has', () => {
    const bases = ['pelvis', 'spine', 'neck', 'head', 'clavicle', 'upperArm', 'forearm', 'hand', 'hip', 'thigh', 'shin', 'foot'];
    for (const id of MUSCLE_IDS) expect(bases).toContain(MUSCLES[id].bone);
  });

  test('every muscle spans a positive length of its bone', () => {
    for (const id of MUSCLE_IDS) expect(MUSCLES[id].t1).toBeGreaterThan(MUSCLES[id].t0);
  });
});

describe('muscleInstances - front view', () => {
  test('draws a paired torso muscle on both sides of the spine', () => {
    const pecs = muscleInstances(MUSCLES.pectoralis, 'front');
    expect(pecs).toHaveLength(2);
    expect(pecs.map((i) => i.bone)).toEqual(['spine', 'spine']);
    expect(pecs[0]?.offset).toBeCloseTo(-(pecs[1]?.offset as number), 8);
  });

  test('draws a limb muscle once on each limb', () => {
    const quads = muscleInstances(MUSCLES.quadriceps, 'front');
    expect(quads.map((i) => i.bone).sort()).toEqual(['thighL', 'thighR']);
  });

  test('draws a midline muscle exactly once', () => {
    expect(muscleInstances(MUSCLES.rectusAbdominis, 'front')).toHaveLength(1);
  });
});

describe('muscleInstances - side view', () => {
  test('puts the chest in front of the spine and the lats behind it', () => {
    // In profile the left/right pair collapses into one belly, placed by its
    // anterior/posterior offset. The figure faces +x, and the spine points up, so
    // "in front" is a negative left-normal offset.
    const pec = muscleInstances(MUSCLES.pectoralis, 'side');
    const lat = muscleInstances(MUSCLES.latissimus, 'side');

    expect(pec).toHaveLength(1);
    expect(lat).toHaveLength(1);
    expect(pec[0]?.offset).toBeLessThan(0);
    expect(lat[0]?.offset).toBeGreaterThan(0);
  });

  test('puts the abdominals in front of the spinal erectors', () => {
    const abs = muscleInstances(MUSCLES.rectusAbdominis, 'side')[0];
    const erectors = muscleInstances(MUSCLES.erectorSpinae, 'side')[0];
    expect(abs?.offset).toBeLessThan(erectors?.offset as number);
  });

  test('puts the biceps in front of the triceps on the upper arm', () => {
    const biceps = muscleInstances(MUSCLES.biceps, 'side').filter((i) => i.bone === 'upperArmL')[0];
    const triceps = muscleInstances(MUSCLES.triceps, 'side').filter((i) => i.bone === 'upperArmL')[0];
    // A hanging arm points down, so its left-normal points forward: front is positive here.
    expect(biceps?.offset).toBeGreaterThan(triceps?.offset as number);
  });

  test('puts the quadriceps in front of the hamstrings on the thigh', () => {
    const quad = muscleInstances(MUSCLES.quadriceps, 'side').filter((i) => i.bone === 'thighL')[0];
    const ham = muscleInstances(MUSCLES.hamstrings, 'side').filter((i) => i.bone === 'thighL')[0];
    expect(quad?.offset).toBeGreaterThan(ham?.offset as number);
  });

  test('still draws limb muscles on both limbs, since they overlap in profile', () => {
    expect(muscleInstances(MUSCLES.quadriceps, 'side').map((i) => i.bone).sort()).toEqual(['thighL', 'thighR']);
  });
});
