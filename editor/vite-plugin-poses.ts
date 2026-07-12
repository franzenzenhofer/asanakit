import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const POSES_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../poses');
const VIRTUAL_ID = 'virtual:asanakit-poses';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

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
 * Ships the bundled pose library to the browser as raw YAML - the single
 * source of truth. Parsing, metadata and thumbnails are all derived
 * client-side by the same engine that renders them everywhere else.
 */
export const posesPlugin = (): Plugin => ({
  name: 'asanakit-poses',
  resolveId(source): string | null {
    return source === VIRTUAL_ID ? RESOLVED_ID : null;
  },
  async load(id): Promise<string | null> {
    if (id !== RESOLVED_ID) return null;

    const files = (await walk(POSES_ROOT)).sort();
    const poses: { file: string; yaml: string }[] = [];
    const sequences: { file: string; yaml: string }[] = [];

    for (const file of files) {
      const relative = file.slice(POSES_ROOT.length + 1);
      if (POSE_EXT.test(file)) poses.push({ file: relative, yaml: await readFile(file, 'utf8') });
      else if (SEQUENCE_EXT.test(file)) sequences.push({ file: relative, yaml: await readFile(file, 'utf8') });
    }

    return `export const bundledPoses = ${JSON.stringify(poses)};\nexport const bundledSequences = ${JSON.stringify(sequences)};\n`;
  },
  configureServer(server): void {
    server.watcher.add(POSES_ROOT);
    server.watcher.on('all', (_event, path) => {
      if (!path.startsWith(POSES_ROOT)) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod !== undefined) void server.reloadModule(mod);
    });
  },
});
