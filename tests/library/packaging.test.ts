import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { bundledLibraryPath, loadLibrary } from '../../src/library/index.js';

const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { files: string[]; bin: Record<string, string> };

describe('published package', () => {
  test('ships the pose library, or every installed user gets an empty one', () => {
    expect(pkg.files).toContain('poses');
  });

  test('ships the compiled CLI the bin entry points at', () => {
    expect(pkg.files.some((f) => pkg.bin.posekit?.startsWith(f))).toBe(true);
  });

  test('the bundled library path resolves to a directory that actually has poses in it', async () => {
    const lib = await loadLibrary(bundledLibraryPath());
    expect(lib.poses.size).toBeGreaterThan(40);
    expect(lib.sequences.has('ashtanga-primary')).toBe(true);
  });
});
