import { describe, expect, it } from 'vitest';
import { reduce } from '../../editor/app/state/actions.js';
import { blankPose } from '../../editor/app/state/doc.js';
import { emptyHistory, record, redo, undo } from '../../editor/app/state/history.js';
import { counterpart, readJoint, writeJoint } from '../../editor/app/state/joints.js';
import { fromYaml, toYaml, validateInput } from '../../editor/app/state/serialize.js';
import { createCollection } from '../../editor/app/state/collection.js';
import { memoryKV } from '../../editor/app/state/kv.js';
import { can } from '../../editor/app/state/entitlements.js';
import { loadLibrary } from '../../src/library/index.js';

describe('joint channels', () => {
  it('reads bare numbers as flexion and antonym names as negations', () => {
    expect(readJoint(90)).toEqual({ flex: 90, abduct: 0, twist: 0 });
    expect(readJoint({ extend: 30, adduct: 10, internalRotation: 5 })).toEqual({ flex: -30, abduct: -10, twist: -5 });
  });

  it('writes the most compact legal form', () => {
    expect(writeJoint({ flex: 90, abduct: 0, twist: 0 })).toBe(90);
    expect(writeJoint({ flex: 0, abduct: 0, twist: 0 })).toBeUndefined();
    expect(writeJoint({ flex: 0, abduct: 45, twist: -10 })).toEqual({ abduct: 45, twist: -10 });
  });

  it('finds the opposite limb', () => {
    expect(counterpart('thighL')).toBe('thighR');
    expect(counterpart('spine')).toBeNull();
  });
});

describe('reduce', () => {
  it('sets a joint channel and clears the world pin for that bone', () => {
    const withWorld = reduce(blankPose(), { type: 'set-world', bone: 'upperArmL', channel: 'elevation', value: -50 });
    expect(withWorld.figure?.world?.upperArmL).toMatchObject({ elevation: -50 });

    const edited = reduce(withWorld, { type: 'set-joint', bone: 'upperArmL', channel: 'abduct', value: 90 });
    expect(edited.figure?.joints?.upperArmL).toEqual({ abduct: 90 });
    expect(edited.figure?.world?.upperArmL).toBeUndefined();
  });

  it('mirrors edits to the other side when sides are linked', () => {
    const linked = reduce(blankPose(), { type: 'set-joint', bone: 'forearmL', channel: 'flex', value: 90 }, true);
    expect(linked.figure?.joints?.forearmL).toBe(90);
    expect(linked.figure?.joints?.forearmR).toBe(90);

    const world = reduce(blankPose(), { type: 'set-world', bone: 'upperArmL', channel: 'azimuth', value: 40 }, true);
    expect(world.figure?.world?.upperArmL?.azimuth).toBe(40);
    expect(world.figure?.world?.upperArmR?.azimuth).toBe(-40);
  });

  it('switching to world mode keeps the solved direction so the pose never jumps', () => {
    const bent = reduce(blankPose(), { type: 'set-joint', bone: 'upperArmL', channel: 'abduct', value: 90 });
    const world = reduce(bent, { type: 'set-bone-mode', bone: 'upperArmL', mode: 'world' });
    const direction = world.figure?.world?.upperArmL;
    expect(direction?.azimuth).toBe(90);
    expect(direction?.elevation).toBe(0);
    expect(world.figure?.joints?.upperArmL).toBeUndefined();
  });

  it('resets, mirrors, muscles and contact stay schema-legal', () => {
    let doc = reduce(blankPose(), { type: 'set-joint', bone: 'shinL', channel: 'flex', value: 60 });
    doc = reduce(doc, { type: 'reset-bone', bone: 'shinL' });
    expect(doc.figure?.joints?.shinL).toBeUndefined();

    doc = reduce(doc, { type: 'toggle-mirror' });
    expect(doc.figure?.mirror).toBe(true);

    doc = reduce(doc, { type: 'set-muscle', list: 'engaged', muscle: 'quadriceps', on: true });
    doc = reduce(doc, { type: 'set-contact', landmark: 'ankleL', on: true });
    expect(validateInput(doc).errors).toEqual([]);
  });
});

describe('history', () => {
  it('coalesces transient runs into one undo step and supports redo', () => {
    const a = blankPose();
    const b = { ...a, name: 'B' };
    const c = { ...a, name: 'C' };

    let history = record(emptyHistory, a, true, false);
    history = record(history, b, true, true);
    expect(history.past).toHaveLength(1);

    const undone = undo(history, c);
    expect(undone?.pose).toBe(a);
    const redone = redo(undone?.history ?? emptyHistory, undone?.pose ?? a);
    expect(redone?.pose).toBe(c);
  });
});

describe('yaml round-trip', () => {
  it('round-trips every bundled pose through toYaml/fromYaml', async () => {
    const library = await loadLibrary();
    for (const pose of library.poses.values()) {
      const again = fromYaml(toYaml(pose));
      expect(again, pose.id).toEqual(pose);
    }
  });
});

describe('collection', () => {
  it('saves, replaces and removes poses behind the KV seam', () => {
    const kv = memoryKV();
    const collection = createCollection(kv);
    collection.savePose({ id: 'p1', name: 'One', yaml: 'x' });
    collection.savePose({ id: 'p1', name: 'One v2', yaml: 'y' });
    expect(collection.myPoses.value).toHaveLength(1);
    expect(collection.myPoses.value[0]?.yaml).toBe('y');

    const reloaded = createCollection(kv);
    expect(reloaded.myPoses.value).toHaveLength(1);

    collection.removePose('p1');
    expect(collection.myPoses.value).toHaveLength(0);
  });
});

describe('entitlements', () => {
  it('everything is free at launch', () => {
    for (const feature of ['export-png', 'export-yaml', 'sheet-builder', 'unlimited-poses', 'view-3d'] as const) {
      expect(can(feature)).toBe(true);
    }
  });
});
