import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePose, parseSequence, type PoseSpec, type SequenceSpec } from '../model/index.js';

export interface Library {
  readonly poses: ReadonlyMap<string, PoseSpec>;
  readonly sequences: ReadonlyMap<string, SequenceSpec>;
  readonly root: string;
}

/** The pose data shipped with the package lives next to the source, not inside dist. */
export const bundledLibraryPath = (): string => resolve(dirname(fileURLToPath(import.meta.url)), '../../poses');

const POSE_EXT = /\.pose\.(ya?ml|json)$/;
const SEQUENCE_EXT = /\.seq\.(ya?ml|json)$/;

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return extname(entry.name) === '' ? [] : [full];
    }),
  );
  return files.flat();
};

/**
 * Load every pose and sequence under a directory. Duplicate ids are a hard
 * error: a library with two `trikonasana` entries is a library you cannot trust.
 */
export const loadLibrary = async (root: string = bundledLibraryPath()): Promise<Library> => {
  const files = await walk(root);
  const poses = new Map<string, PoseSpec>();
  const sequences = new Map<string, SequenceSpec>();

  for (const file of files.sort()) {
    if (POSE_EXT.test(file)) {
      const pose = parsePose(await readFile(file, 'utf8'), file);
      const existing = poses.get(pose.id);
      if (existing !== undefined) throw new Error(`Duplicate pose id "${pose.id}" in ${file}`);
      poses.set(pose.id, pose);
    } else if (SEQUENCE_EXT.test(file)) {
      const seq = parseSequence(await readFile(file, 'utf8'), file);
      if (sequences.has(seq.id)) throw new Error(`Duplicate sequence id "${seq.id}" in ${file}`);
      sequences.set(seq.id, seq);
    }
  }

  return { poses, sequences, root };
};

export interface SequenceStep {
  readonly pose: PoseSpec;
  readonly label: string;
  readonly section: string;
  readonly breath?: 'inhale' | 'exhale' | 'hold' | 'free';
  readonly count: number;
  readonly side: 'left' | 'right' | 'both' | 'none';
}

/**
 * Flatten a sequence into the poses it actually renders, expanding `side: both`
 * into a left and a mirrored right repetition - which is how the practice runs.
 */
export const expandSequence = (sequence: SequenceSpec, library: Library): SequenceStep[] => {
  const steps: SequenceStep[] = [];

  for (const section of sequence.sections) {
    for (const step of section.steps) {
      const pose = library.poses.get(step.pose);
      if (pose === undefined) {
        throw new Error(`Sequence "${sequence.id}" references unknown pose "${step.pose}"`);
      }

      const sides = step.side === 'both' ? (['left', 'right'] as const) : ([step.side] as const);
      for (const side of sides) {
        const mirrored = side === 'right';
        steps.push({
          pose: mirrored
            ? { ...pose, figure: { ...pose.figure, mirror: !pose.figure.mirror, flip: !pose.figure.flip } }
            : pose,
          label: step.label ?? pose.name,
          section: section.name,
          ...(step.breath === undefined ? {} : { breath: step.breath }),
          count: step.count,
          side,
        });
      }
    }
  }

  return steps;
};
