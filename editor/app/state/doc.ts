import { signal } from '@preact/signals';
import type { BoneId } from '@asanakit/core/types.js';
import { propSchema, type PoseSpecInput } from '@asanakit/model/index.js';
import type { StyleId } from '@asanakit/render/styles.js';
import { reduce, type EditorAction } from './actions.js';
import { emptyHistory, record, redo, undo, type History } from './history.js';

/**
 * A fresh figure standing in anatomical neutral - the blank canvas. Its mat is
 * a real mat, every dimension filled in from the schema's own defaults, because
 * nobody should have to invent the width of a yoga mat before they can draw.
 */
export const blankPose = (): PoseSpecInput => ({
  asanakit: 2,
  id: 'my-asana',
  name: 'My Asana',
  discipline: 'yoga',
  contact: ['toeL', 'toeR'],
  camera: 'front',
  figure: {},
  props: [propSchema.parse({ type: 'mat' })],
});

export const pose = signal<PoseSpecInput>(blankPose());
export const selectedBone = signal<BoneId | null>(null);
export const linkSides = signal(false);
export const view = signal<'2d' | '3d'>('2d');
export const styleId = signal<StyleId>('stick');

/**
 * Joint dots. Off by default: they are scaffolding for an author mid-edit, not
 * part of the drawing, and a finished figure should not be covered in them.
 * Whatever is on screen is what exports - the toggle feeds the same style
 * override both go through.
 */
export const showJoints = signal(false);

export const styleOverride = (): { figure: { joints: 'dots' | 'none' } } => ({
  figure: { joints: showJoints.value ? 'dots' : 'none' },
});
export const history = signal<History>(emptyHistory);

let lastWasTransient = false;

export interface DispatchOptions {
  /** Mid-gesture edits coalesce into one undo step; call commitGesture() when it ends. */
  readonly transient?: boolean;
}

export const dispatch = (action: EditorAction, options: DispatchOptions = {}): void => {
  const transient = options.transient === true;
  const next = reduce(pose.value, action, linkSides.value);
  if (next === pose.value) return;
  history.value = record(history.value, pose.value, transient, lastWasTransient);
  lastWasTransient = transient;
  pose.value = next;
};

export const commitGesture = (): void => {
  lastWasTransient = false;
};

export const undoEdit = (): void => {
  const result = undo(history.value, pose.value);
  if (result === null) return;
  history.value = result.history;
  pose.value = result.pose;
  lastWasTransient = false;
};

export const redoEdit = (): void => {
  const result = redo(history.value, pose.value);
  if (result === null) return;
  history.value = result.history;
  pose.value = result.pose;
  lastWasTransient = false;
};

/** Replace the document wholesale (load, fork, import) and reset undo history. */
export const loadPose = (next: PoseSpecInput): void => {
  pose.value = next;
  history.value = emptyHistory;
  selectedBone.value = null;
  lastWasTransient = false;
};
