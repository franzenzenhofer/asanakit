import { describe, expect, test } from 'vitest';
import { parsePose, poseJsonSchema, resolveFigure } from '../../src/model/index.js';

const MINIMAL = `
asanakit: 2
id: tadasana
name: Mountain Pose
discipline: yoga
figure:
  joints:
    upperArmL: 5
`;

describe('parsePose', () => {
  test('parses YAML and fills in defaults', () => {
    const pose = parsePose(MINIMAL, 'tadasana.pose.yaml');
    expect(pose.id).toBe('tadasana');
    expect(pose.figure.grounded).toBe(true);
    expect(pose.figure.root.yaw).toBe(0);
    expect(pose.figure.root.pitch).toBe(0);
    expect(pose.figure.root.scale).toBe(1);
    expect(pose.figure.joints.upperArmL).toBe(5);
    expect(pose.camera).toBe('front');
    expect(pose.physics).toBe('none');
    expect(pose.props).toEqual([]);
    expect(pose.annotations).toEqual([]);
  });

  test('parses the object form of a joint value', () => {
    const pose = parsePose(
      'asanakit: 2\nid: x\nname: X\ndiscipline: yoga\nfigure:\n  joints:\n    upperArmL: { abduct: 90, twist: -15 }\n',
      'x.pose.yaml',
    );
    expect(pose.figure.joints.upperArmL).toEqual({ abduct: 90, twist: -15 });
  });

  test('speaks anatomical antonyms: extend, adduct, internal and external rotation', () => {
    const pose = parsePose(
      [
        'asanakit: 2',
        'id: x',
        'name: X',
        'discipline: yoga',
        'figure:',
        '  joints:',
        '    upperArmL: { extend: 30, adduct: 10, internalRotation: 20 }',
      ].join('\n'),
      'x.pose.yaml',
    );
    expect(pose.figure.joints.upperArmL).toEqual({ extend: 30, adduct: 10, internalRotation: 20 });
  });

  test('rejects contradictions: both directions of one axis', () => {
    expect(() =>
      parsePose(
        'asanakit: 2\nid: x\nname: X\ndiscipline: yoga\nfigure:\n  joints:\n    upperArmL: { flex: 30, extend: 10 }\n',
        'x.pose.yaml',
      ),
    ).toThrow(/flex.*extend/);
  });

  test('parses a camera preset and camera angles', () => {
    const preset = parsePose('asanakit: 2\nid: x\nname: X\ndiscipline: yoga\ncamera: side\n', 'x.pose.yaml');
    expect(preset.camera).toBe('side');
    const angles = parsePose(
      'asanakit: 2\nid: x\nname: X\ndiscipline: yoga\ncamera: { azimuth: 30, elevation: 15 }\n',
      'x.pose.yaml',
    );
    expect(angles.camera).toEqual({ azimuth: 30, elevation: 15, roll: 0 });
  });

  test('parses JSON as well as YAML', () => {
    const pose = parsePose(JSON.stringify({ asanakit: 2, id: 'x', name: 'X', discipline: 'surf' }), 'x.pose.json');
    expect(pose.discipline).toBe('surf');
  });

  test('reports the offending field when validation fails', () => {
    expect(() => parsePose('asanakit: 2\nid: x\nname: X\ndiscipline: knitting\n', 'x.pose.yaml')).toThrow(
      /discipline/,
    );
  });

  test('rejects an unknown joint name with a helpful message', () => {
    const src = 'asanakit: 2\nid: x\nname: X\ndiscipline: yoga\nfigure:\n  joints:\n    kneecapL: 20\n';
    expect(() => parsePose(src, 'x.pose.yaml')).toThrow(/kneecapL/);
  });

  test('rejects the retired 2D format version, loudly and by name', () => {
    expect(() => parsePose('asanakit: 1\nid: x\nname: X\ndiscipline: yoga\n', 'x.pose.yaml')).toThrow(/asanakit/);
  });

  test('names the file in the error message', () => {
    expect(() => parsePose('asanakit: 2\n', 'broken.pose.yaml')).toThrow(/broken\.pose\.yaml/);
  });
});

describe('resolveFigure', () => {
  test('produces a kinematic pose the solver understands', () => {
    const pose = parsePose(MINIMAL, 'tadasana.pose.yaml');
    const kin = resolveFigure(pose.figure);
    expect(kin.grounded).toBe(true);
    expect(kin.joints.upperArmL).toBe(5);
    expect(kin.root.position).toEqual([0, 0, 0]);
  });

  test('mirror swaps left and right joint values', () => {
    const pose = parsePose(
      'asanakit: 2\nid: x\nname: X\ndiscipline: yoga\nfigure:\n  mirror: true\n  joints:\n    thighL: 40\n    thighR: 10\n',
      'x.pose.yaml',
    );
    const kin = resolveFigure(pose.figure);
    expect(kin.joints.thighL).toBe(10);
    expect(kin.joints.thighR).toBe(40);
  });

  test('mirror leaves centre joints untouched', () => {
    const pose = parsePose(
      'asanakit: 2\nid: x\nname: X\ndiscipline: yoga\nfigure:\n  mirror: true\n  joints:\n    spine: 25\n',
      'x.pose.yaml',
    );
    expect(resolveFigure(pose.figure).joints.spine).toBe(25);
  });

  test('mirror reflects absolute world directions across the sagittal plane', () => {
    const pose = parsePose(
      [
        'asanakit: 2',
        'id: x',
        'name: X',
        'discipline: yoga',
        'figure:',
        '  mirror: true',
        '  root: { yaw: 30 }',
        '  world:',
        '    thighL: { azimuth: 60, elevation: -45, twist: 10 }',
      ].join('\n'),
      'x.pose.yaml',
    );
    const kin = resolveFigure(pose.figure);
    expect(kin.world.thighR).toEqual({ azimuth: -60, elevation: -45, twist: -10 });
    expect(kin.world.thighL).toBeUndefined();
    expect(kin.root.yaw).toBe(-30);
  });
});

describe('poseJsonSchema', () => {
  test('emits a JSON Schema that documents the pose format', () => {
    const schema = poseJsonSchema();
    expect(schema.$schema).toContain('json-schema.org');
    const text = JSON.stringify(schema);
    expect(text).toContain('discipline');
    expect(text).toContain('thighL');
    expect(text).toContain('abduct');
    expect(text).toContain('azimuth');
  });
});
