import { stat } from 'node:fs/promises';
import { CAMERA_PRESET_IDS, isCameraPresetId, type CameraInput } from '../core/camera.js';
import { loadLibrary, type Library } from '../library/index.js';
import { loadPoseFile } from '../model/load.js';
import type { PoseSpec } from '../model/index.js';
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
    throw new Error(`No pose file or library id "${ref}". Try: ${known}... (run "asanakit list")`);
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

const parseCameraPart = (part: string, named: Record<string, number>, bare: number[]): void => {
  const [key, raw] = part.includes('=') ? part.split('=', 2) : [undefined, part];
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`--camera: "${part}" is not a number`);
  if (key === undefined) {
    bare.push(n);
  } else if (key === 'azimuth' || key === 'elevation' || key === 'roll') {
    named[key] = n;
  } else {
    throw new Error(`--camera: unknown key "${key}" (use azimuth, elevation, roll)`);
  }
};

/**
 * A camera flag is either a preset name or comma-separated orbit angles:
 * `--camera back`, `--camera "azimuth=30,elevation=15"`, `--camera 30,15`.
 */
export const parseCamera = (value: string): CameraInput => {
  if (isCameraPresetId(value)) return value;

  const named: Record<string, number> = {};
  const bare: number[] = [];
  const parts = value.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
  for (const part of parts) parseCameraPart(part, named, bare);

  if (bare.length > 3) throw new Error('--camera takes at most three angles: azimuth,elevation,roll');
  if (bare.length === 0 && Object.keys(named).length === 0) {
    throw new Error(`--camera: "${value}" is neither a preset (${CAMERA_PRESET_IDS.join(', ')}) nor angles`);
  }
  const [azimuth, elevation, roll] = bare;
  return {
    azimuth: named.azimuth ?? azimuth ?? 0,
    elevation: named.elevation ?? elevation ?? 0,
    roll: named.roll ?? roll ?? 0,
  };
};
