import { describe, expect, test } from 'vitest';
import { DEFAULT_RIG } from '../../src/core/rig.js';
import { MUSCLES, MUSCLE_IDS, muscleInstances } from '../../src/anatomy/muscles.js';
import { CAMERA_PRESETS } from '../../src/core/camera.js';

const FRONT = CAMERA_PRESETS.front.azimuth;
const SIDE = CAMERA_PRESETS.side.azimuth;

describe('muscle definitions', () => {
  test('every muscle sits on a bone the rig actually has', () => {
    // Derived from the rig itself, so a new bone cannot be forgotten here.
    const bases = new Set(DEFAULT_RIG.bones.map((b) => b.id.replace(/[LR]$/, '')));
    for (const id of MUSCLE_IDS) expect([...bases]).toContain(MUSCLES[id].bone);
  });

  test('every muscle spans a positive length of its bone', () => {
    for (const id of MUSCLE_IDS) expect(MUSCLES[id].t1).toBeGreaterThan(MUSCLES[id].t0);
  });
});

describe('muscleInstances - facing the camera', () => {
  test('draws a paired torso muscle on both sides of the trunk', () => {
    const pecs = muscleInstances(MUSCLES.pectoralis, FRONT);
    expect(pecs).toHaveLength(2);
    // The chest rides the ribcage, which is the thorax - not the lumbar spine under it.
    expect(pecs.map((i) => i.bone)).toEqual(['thorax', 'thorax']);
    expect(pecs[0]?.offset).toBeCloseTo(-(pecs[1]?.offset as number), 8);
  });

  test('draws a limb muscle once on each limb', () => {
    const quads = muscleInstances(MUSCLES.quadriceps, FRONT);
    expect(quads.map((i) => i.bone).sort()).toEqual(['thighL', 'thighR']);
  });

  test('draws a midline muscle exactly once', () => {
    expect(muscleInstances(MUSCLES.rectusAbdominis, FRONT)).toHaveLength(1);
  });
});

describe('muscleInstances - in profile', () => {
  test('puts the chest in front of the spine and the lats behind it', () => {
    // In profile the left/right pair collapses into one belly, placed by its
    // anterior/posterior offset. The figure faces picture-right, and the spine
    // points up, so "in front" is a negative left-normal offset.
    const pec = muscleInstances(MUSCLES.pectoralis, SIDE);
    const lat = muscleInstances(MUSCLES.latissimus, SIDE);

    expect(pec).toHaveLength(1);
    expect(lat).toHaveLength(1);
    expect(pec[0]?.offset).toBeLessThan(0);
    expect(lat[0]?.offset).toBeGreaterThan(0);
  });

  test('puts the abdominals in front of the spinal erectors', () => {
    const abs = muscleInstances(MUSCLES.rectusAbdominis, SIDE)[0];
    const erectors = muscleInstances(MUSCLES.erectorSpinae, SIDE)[0];
    expect(abs?.offset).toBeLessThan(erectors?.offset as number);
  });

  test('puts the biceps in front of the triceps on the upper arm', () => {
    const biceps = muscleInstances(MUSCLES.biceps, SIDE).filter((i) => i.bone === 'upperArmL')[0];
    const triceps = muscleInstances(MUSCLES.triceps, SIDE).filter((i) => i.bone === 'upperArmL')[0];
    // A hanging arm points down, so its left-normal points forward: front is positive here.
    expect(biceps?.offset).toBeGreaterThan(triceps?.offset as number);
  });

  test('puts the quadriceps in front of the hamstrings on the thigh', () => {
    const quad = muscleInstances(MUSCLES.quadriceps, SIDE).filter((i) => i.bone === 'thighL')[0];
    const ham = muscleInstances(MUSCLES.hamstrings, SIDE).filter((i) => i.bone === 'thighL')[0];
    expect(quad?.offset).toBeGreaterThan(ham?.offset as number);
  });

  test('still draws limb muscles on both limbs, since they overlap in profile', () => {
    expect(muscleInstances(MUSCLES.quadriceps, SIDE).map((i) => i.bone).sort()).toEqual(['thighL', 'thighR']);
  });

  test('the two exact profiles place the same muscle on opposite sides of the bone', () => {
    const fromRight = muscleInstances(MUSCLES.quadriceps, CAMERA_PRESETS.right.azimuth)[0];
    const fromLeft = muscleInstances(MUSCLES.quadriceps, CAMERA_PRESETS.left.azimuth)[0];
    expect(fromRight?.offset).toBeCloseTo(-(fromLeft?.offset as number), 8);
  });
});

describe('muscleInstances - between the extremes', () => {
  test('a three-quarter azimuth blends both displacement planes', () => {
    const pecs = muscleInstances(MUSCLES.pectoralis, -45);
    expect(pecs).toHaveLength(2);
    // The pair is still split, but the split has narrowed and both bellies
    // shifted toward the anterior side.
    const mid = ((pecs[0]?.offset as number) + (pecs[1]?.offset as number)) / 2;
    expect(mid).toBeLessThan(0);
  });
});
