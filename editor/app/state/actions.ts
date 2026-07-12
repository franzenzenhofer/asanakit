import type { BoneId, LandmarkId } from '@asanakit/core/types.js';
import type { MuscleId } from '@asanakit/anatomy/muscles.js';
import type { PoseSpecInput } from '@asanakit/model/index.js';
import { counterpart, readJoint, solvedWorldDirection, writeJoint, type JointChannels } from './joints.js';

export type JointChannel = keyof JointChannels;
export type WorldChannel = 'azimuth' | 'elevation' | 'twist';
export type RootField = 'yaw' | 'pitch' | 'roll';

export type MetaPatch = Partial<
  Pick<
    PoseSpecInput,
    'id' | 'name' | 'sanskrit' | 'english' | 'discipline' | 'family' | 'difficulty' | 'description' | 'tags' | 'cues' | 'drishti' | 'breath'
  >
>;

export type EditorAction =
  | { type: 'set-joint'; bone: BoneId; channel: JointChannel; value: number }
  | { type: 'set-world'; bone: BoneId; channel: WorldChannel; value: number }
  | { type: 'set-bone-mode'; bone: BoneId; mode: 'joint' | 'world' }
  | { type: 'reset-bone'; bone: BoneId }
  | { type: 'set-root'; field: RootField; value: number }
  | { type: 'set-camera'; camera: PoseSpecInput['camera'] }
  | { type: 'toggle-mirror' }
  | { type: 'set-meta'; patch: MetaPatch }
  | { type: 'set-muscle'; list: 'engaged' | 'stretched'; muscle: MuscleId; on: boolean }
  | { type: 'set-contact'; landmark: LandmarkId; on: boolean }
  | { type: 'set-props'; props: PoseSpecInput['props'] };

type Figure = NonNullable<PoseSpecInput['figure']>;

const figureOf = (pose: PoseSpecInput): Figure => pose.figure ?? {};

const withFigure = (pose: PoseSpecInput, figure: Figure): PoseSpecInput => ({ ...pose, figure });

const without = <T extends object>(record: T, key: string): T => {
  const copy = { ...record } as Record<string, unknown>;
  delete copy[key];
  return copy as T;
};

const setJoint = (pose: PoseSpecInput, bone: BoneId, channel: JointChannel, value: number): PoseSpecInput => {
  const figure = figureOf(pose);
  const joints = { ...figure.joints };
  const next = writeJoint({ ...readJoint(joints[bone]), [channel]: value });
  if (next === undefined) delete joints[bone];
  else joints[bone] = next;
  // A world pin overrides joints for this bone; editing joints implies leaving world mode.
  const world = figure.world?.[bone] === undefined ? figure.world : without(figure.world, bone);
  return withFigure(pose, { ...figure, joints, ...(world === undefined ? {} : { world }) });
};

const setWorld = (pose: PoseSpecInput, bone: BoneId, channel: WorldChannel, value: number): PoseSpecInput => {
  const figure = figureOf(pose);
  const current = figure.world?.[bone] ?? solvedWorldDirection(pose, bone);
  return withFigure(pose, { ...figure, world: { ...figure.world, [bone]: { ...current, [channel]: value } } });
};

const mirroredValue = (channel: JointChannel | WorldChannel, value: number): number =>
  channel === 'azimuth' || channel === 'twist' ? -value : value;

const setBoneMode = (pose: PoseSpecInput, bone: BoneId, mode: 'joint' | 'world'): PoseSpecInput => {
  const figure = figureOf(pose);
  if (mode === 'joint') {
    if (figure.world?.[bone] === undefined) return pose;
    return withFigure(pose, { ...figure, world: without(figure.world, bone) });
  }
  if (figure.world?.[bone] !== undefined) return pose;
  const direction = solvedWorldDirection(pose, bone);
  const joints = figure.joints?.[bone] === undefined ? figure.joints : without(figure.joints, bone);
  return withFigure(pose, { ...figure, ...(joints === undefined ? {} : { joints }), world: { ...figure.world, [bone]: direction } });
};

const resetBone = (pose: PoseSpecInput, bone: BoneId): PoseSpecInput => {
  const figure = figureOf(pose);
  return withFigure(pose, {
    ...figure,
    ...(figure.joints === undefined ? {} : { joints: without(figure.joints, bone) }),
    ...(figure.world === undefined ? {} : { world: without(figure.world, bone) }),
  });
};

const toggled = (list: readonly string[] | undefined, value: string, on: boolean): string[] => {
  const set = new Set(list ?? []);
  if (on) set.add(value);
  else set.delete(value);
  return [...set];
};

type Handler<K extends EditorAction['type']> = (
  pose: PoseSpecInput,
  action: Extract<EditorAction, { type: K }>,
  linked: boolean,
) => PoseSpecInput;

/** Apply a per-bone edit, and the mirrored edit to the opposite limb when linked. */
const onBothSides = (
  pose: PoseSpecInput,
  bone: BoneId,
  linked: boolean,
  apply: (pose: PoseSpecInput, bone: BoneId, mirrored: boolean) => PoseSpecInput,
): PoseSpecInput => {
  const one = apply(pose, bone, false);
  const other = linked ? counterpart(bone) : null;
  return other === null ? one : apply(one, other, true);
};

const HANDLERS: { [K in EditorAction['type']]: Handler<K> } = {
  'set-joint': (pose, a, linked) =>
    onBothSides(pose, a.bone, linked, (p, bone) => setJoint(p, bone, a.channel, a.value)),
  'set-world': (pose, a, linked) =>
    onBothSides(pose, a.bone, linked, (p, bone, mirrored) =>
      setWorld(p, bone, a.channel, mirrored ? mirroredValue(a.channel, a.value) : a.value),
    ),
  'set-bone-mode': (pose, a, linked) => onBothSides(pose, a.bone, linked, (p, bone) => setBoneMode(p, bone, a.mode)),
  'reset-bone': (pose, a, linked) => onBothSides(pose, a.bone, linked, (p, bone) => resetBone(p, bone)),
  'set-root': (pose, a) => {
    const figure = figureOf(pose);
    return withFigure(pose, { ...figure, root: { ...figure.root, [a.field]: a.value } });
  },
  'set-camera': (pose, a) => ({ ...pose, camera: a.camera }),
  'toggle-mirror': (pose) => {
    const figure = figureOf(pose);
    return withFigure(pose, { ...figure, mirror: figure.mirror !== true });
  },
  'set-meta': (pose, a) => ({ ...pose, ...a.patch }),
  'set-muscle': (pose, a) => {
    const muscles = pose.muscles ?? {};
    return { ...pose, muscles: { ...muscles, [a.list]: toggled(muscles[a.list], a.muscle, a.on) } };
  },
  'set-contact': (pose, a) => ({ ...pose, contact: toggled(pose.contact, a.landmark, a.on) as LandmarkId[] }),
  'set-props': (pose, a) => ({ ...pose, props: a.props ?? [] }),
};

/**
 * The single pure reducer behind every edit. `linkSides` applies the same
 * anatomical change to the opposite limb (reflected across the sagittal plane).
 */
export const reduce = (pose: PoseSpecInput, action: EditorAction, linkSides = false): PoseSpecInput =>
  (HANDLERS[action.type] as Handler<EditorAction['type']>)(pose, action, linkSides);
