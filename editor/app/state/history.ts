import type { PoseSpecInput } from '@asanakit/model/index.js';

const CAP = 100;

export interface History {
  readonly past: readonly PoseSpecInput[];
  readonly future: readonly PoseSpecInput[];
}

export const emptyHistory: History = { past: [], future: [] };

/**
 * Record a snapshot before a change. Transient edits (a slider mid-drag)
 * coalesce: only the first one in a run pushes, so undo steps whole gestures.
 */
export const record = (history: History, snapshot: PoseSpecInput, transient: boolean, wasTransient: boolean): History => {
  if (transient && wasTransient) return history;
  return { past: [...history.past.slice(-(CAP - 1)), snapshot], future: [] };
};

export const undo = (
  history: History,
  current: PoseSpecInput,
): { history: History; pose: PoseSpecInput } | null => {
  const previous = history.past.at(-1);
  if (previous === undefined) return null;
  return {
    history: { past: history.past.slice(0, -1), future: [current, ...history.future] },
    pose: previous,
  };
};

export const redo = (
  history: History,
  current: PoseSpecInput,
): { history: History; pose: PoseSpecInput } | null => {
  const next = history.future[0];
  if (next === undefined) return null;
  return {
    history: { past: [...history.past, current], future: history.future.slice(1) },
    pose: next,
  };
};
