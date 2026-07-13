import { Mesh } from 'three';
import { describe, expect, test } from 'vitest';
import { boneOfMesh, jointOfMesh, landmarkOfMesh } from '../../editor/app/three/pick.js';

const named = (name: string): Mesh => {
  const mesh = new Mesh();
  mesh.name = name;
  return mesh;
};

describe('a joint is a handle on the bone that ends there', () => {
  test('grabbing the knee grabs the thigh - and the shin and foot come along, because they hang off it', () => {
    expect(jointOfMesh(named('joint:kneeL'))).toBe('thighL');
    expect(jointOfMesh(named('joint:ankleR'))).toBe('shinR');
    expect(jointOfMesh(named('joint:elbowL'))).toBe('upperArmL');
    expect(jointOfMesh(named('joint:wristR'))).toBe('forearmR');
    expect(jointOfMesh(named('joint:chest'))).toBe('thorax');
  });

  test('a joint that ends no bone is not a handle', () => {
    expect(jointOfMesh(named('joint:hipCenter'))).toBeNull();
  });

  test('bones and joints are told apart, and nothing else is pickable', () => {
    expect(boneOfMesh(named('bone:thighL'))).toBe('thighL');
    expect(boneOfMesh(named('joint:kneeL'))).toBeNull();
    expect(jointOfMesh(named('bone:thighL'))).toBeNull();
    expect(jointOfMesh(named('prop:mat'))).toBeNull();
    expect(landmarkOfMesh(named('joint:kneeL'))).toBe('kneeL');
  });
});
