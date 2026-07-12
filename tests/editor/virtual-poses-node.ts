import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { bundledLibraryPath } from '../../src/library/index.js';

/** Node-side stand-in for the Vite virtual module: the same real pose files. */
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

const root = bundledLibraryPath();
const files = (await walk(root)).sort();

const load = async (pattern: RegExp): Promise<{ file: string; yaml: string }[]> =>
  Promise.all(
    files.filter((f) => pattern.test(f)).map(async (f) => ({ file: f.slice(root.length + 1), yaml: await readFile(f, 'utf8') })),
  );

export const bundledPoses = await load(/\.pose\.(ya?ml|json)$/);
export const bundledSequences = await load(/\.seq\.(ya?ml|json)$/);
