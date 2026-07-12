import { describe, expect, test } from 'vitest';
import { parsePose, poseJsonSchema, resolveFigure } from '../../src/model/index.js';

const MINIMAL = `
posekit: 1
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
    expect(pose.figure.view).toBe('front');
    expect(pose.figure.grounded).toBe(true);
    expect(pose.figure.root.rotation).toBe(90);
    expect(pose.figure.root.scale).toBe(1);
    expect(pose.figure.joints.upperArmL).toBe(5);
    expect(pose.props).toEqual([]);
    expect(pose.annotations).toEqual([]);
  });

  test('parses JSON as well as YAML', () => {
    const pose = parsePose(JSON.stringify({ posekit: 1, id: 'x', name: 'X', discipline: 'surf' }), 'x.pose.json');
    expect(pose.discipline).toBe('surf');
  });

  test('reports the offending field when validation fails', () => {
    expect(() => parsePose('posekit: 1\nid: x\nname: X\ndiscipline: knitting\n', 'x.pose.yaml')).toThrow(
      /discipline/,
    );
  });

  test('rejects an unknown joint name with a helpful message', () => {
    const src = 'posekit: 1\nid: x\nname: X\ndiscipline: yoga\nfigure:\n  joints:\n    kneecapL: 20\n';
    expect(() => parsePose(src, 'x.pose.yaml')).toThrow(/kneecapL/);
  });

  test('rejects an unsupported format version', () => {
    expect(() => parsePose('posekit: 99\nid: x\nname: X\ndiscipline: yoga\n', 'x.pose.yaml')).toThrow(/posekit/);
  });

  test('names the file in the error message', () => {
    expect(() => parsePose('posekit: 1\n', 'broken.pose.yaml')).toThrow(/broken\.pose\.yaml/);
  });
});

describe('resolveFigure', () => {
  test('produces a kinematic pose the solver understands', () => {
    const pose = parsePose(MINIMAL, 'tadasana.pose.yaml');
    const kin = resolveFigure(pose.figure);
    expect(kin.view).toBe('front');
    expect(kin.grounded).toBe(true);
    expect(kin.joints.upperArmL).toBe(5);
  });

  test('mirror swaps left and right joint angles', () => {
    const pose = parsePose(
      'posekit: 1\nid: x\nname: X\ndiscipline: yoga\nfigure:\n  mirror: true\n  joints:\n    thighL: 40\n    thighR: 10\n',
      'x.pose.yaml',
    );
    const kin = resolveFigure(pose.figure);
    expect(kin.joints.thighL).toBe(10);
    expect(kin.joints.thighR).toBe(40);
  });

  test('mirror leaves centre joints untouched', () => {
    const pose = parsePose(
      'posekit: 1\nid: x\nname: X\ndiscipline: yoga\nfigure:\n  mirror: true\n  joints:\n    spine: 25\n',
      'x.pose.yaml',
    );
    expect(resolveFigure(pose.figure).joints.spine).toBe(25);
  });
});

describe('poseJsonSchema', () => {
  test('emits a JSON Schema that documents the pose format', () => {
    const schema = poseJsonSchema();
    expect(schema.$schema).toContain('json-schema.org');
    expect(JSON.stringify(schema)).toContain('discipline');
    expect(JSON.stringify(schema)).toContain('thighL');
  });
});
