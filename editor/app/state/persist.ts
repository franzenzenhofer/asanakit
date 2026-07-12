import { effect } from '@preact/signals';
import { parsePose, type PoseSpecInput } from '@asanakit/model/index.js';
import { parse as parseYamlRaw } from 'yaml';
import { loadPose, pose } from './doc.js';
import type { KV } from './kv.js';
import { toYaml } from './serialize.js';

const DRAFT_KEY = 'asanakit.draft';
const DEBOUNCE_MS = 400;

/** The draft round-trips as authored input, not schema output with defaults baked in. */
const parsePoseInput = (text: string): PoseSpecInput => parseYamlRaw(text) as PoseSpecInput;

/**
 * Draft autosave: the working pose survives reloads as YAML. Storing YAML
 * (not JSON) means a stale draft fails through the parser's own errors.
 */
export const startPersistence = (kv: KV): void => {
  const draft = kv.get(DRAFT_KEY);
  if (draft !== null) {
    try {
      parsePose(draft, 'draft');
      loadPose(parsePoseInput(draft));
    } catch (error) {
      console.warn('[asanakit] discarding unreadable draft', error);
      kv.remove(DRAFT_KEY);
    }
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  effect(() => {
    const value = pose.value;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => kv.set(DRAFT_KEY, toYaml(value)), DEBOUNCE_MS);
  });
};
