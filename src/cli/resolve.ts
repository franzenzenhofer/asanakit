import { stat } from 'node:fs/promises';
import { loadLibrary, type Library } from '../library/index.js';
import { loadPoseFile, type PoseSpec } from '../model/index.js';
import { isStyleId, STYLE_IDS, type StyleId } from '../render/index.js';

let cached: Library | null = null;

export const library = async (root?: string): Promise<Library> => {
  if (root !== undefined) return loadLibrary(root);
  cached ??= await loadLibrary();
  return cached;
};

const isFile = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

/**
 * A pose reference is either a path to a .pose.yaml file or an id in the bundled
 * library. Files win, so a local override never silently resolves to a built-in.
 */
export const resolvePose = async (ref: string, libRoot?: string): Promise<PoseSpec> => {
  if (await isFile(ref)) return loadPoseFile(ref);

  const lib = await library(libRoot);
  const pose = lib.poses.get(ref);
  if (pose === undefined) {
    const known = [...lib.poses.keys()].slice(0, 8).join(', ');
    throw new Error(`No pose file or library id "${ref}". Try: ${known}... (run "posekit list")`);
  }
  return pose;
};

export const parseStyle = (value: string): StyleId => {
  if (!isStyleId(value)) throw new Error(`Unknown style "${value}". Available: ${STYLE_IDS.join(', ')}`);
  return value;
};

export const parseIntOption = (value: string, name: string): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${name} must be a positive number, got "${value}"`);
  return n;
};
