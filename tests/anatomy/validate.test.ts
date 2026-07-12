import { describe, expect, test } from 'vitest';
import { validatePose } from '../../src/anatomy/validate.js';
import { parsePose } from '../../src/model/index.js';

const pose = (body: string) => parsePose(`asanakit: 1\nid: t\nname: T\ndiscipline: yoga\n${body}`, 't.pose.yaml');

const codes = (body: string): string[] => validatePose(pose(body)).map((i) => i.code);

describe('validatePose - joint limits', () => {
  test('a neutral standing figure is anatomically clean', () => {
    expect(validatePose(pose(''))).toEqual([]);
  });

  test('accepts a knee bent the way a knee bends', () => {
    expect(codes('figure:\n  joints:\n    shinL: 90\n')).not.toContain('knee-hyperextension');
  });

  test('rejects a knee bent backwards', () => {
    expect(codes('figure:\n  joints:\n    shinL: -40\n')).toContain('knee-hyperextension');
  });

  test('rejects an elbow bent backwards, on the mirrored side too', () => {
    expect(codes('figure:\n  joints:\n    forearmR: -40\n')).toContain('elbow-hyperextension');
  });

  test('rejects a knee flexed past the physical limit', () => {
    expect(codes('figure:\n  joints:\n    shinL: 175\n')).toContain('knee-overflexion');
  });

  test('names the offending joint in the message', () => {
    const issues = validatePose(pose('figure:\n  joints:\n    shinL: -40\n'));
    expect(issues[0]?.message).toContain('shinL');
  });

  test('checks limits on world-angled bones too, not just relative joints', () => {
    // Shin pinned forward of a vertical thigh: a knee bending the wrong way.
    expect(codes('figure:\n  world:\n    thighL: -90\n    shinL: -50\n')).toContain('knee-hyperextension');
  });
});

describe('validatePose - ground contact', () => {
  test('a figure floating above the ground is caught', () => {
    expect(codes('figure:\n  grounded: false\n  root:\n    position: [0, 0.9]\n')).toContain('no-ground-contact');
  });

  test('a figure sunk through the ground is caught', () => {
    expect(codes('figure:\n  grounded: false\n  root:\n    position: [0, -0.2]\n')).toContain('below-ground');
  });

  test('a grounded standing figure passes both checks', () => {
    const clean = codes('figure:\n  grounded: true\n');
    expect(clean).not.toContain('below-ground');
    expect(clean).not.toContain('no-ground-contact');
  });
});

describe('validatePose - declared contact points', () => {
  test('accepts a pose whose declared contact points really are on the floor', () => {
    expect(codes('contact: [toeL, toeR]\n')).toEqual([]);
  });

  test('catches a limb that was meant to reach the floor but does not', () => {
    // The classic authoring mistake: tilt the pelvis, forget to pin the legs.
    // The hands were supposed to be on the mat; they are nowhere near it.
    const issues = validatePose(pose('contact: [handTipL, handTipR]\nfigure:\n  root:\n    rotation: -20\n'));
    expect(issues.map((i) => i.code)).toContain('contact-off-ground');
    expect(issues.find((i) => i.code === 'contact-off-ground')?.message).toContain('handTipL');
  });
});
