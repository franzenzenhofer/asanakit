import { parsePose, parseSequence, type PoseSpec, type SequenceSpec } from '@asanakit/model/index.js';
import { renderSvg } from '@asanakit/render/scene.js';
import { bundledPoses, bundledSequences } from 'virtual:asanakit-poses';

export interface LibraryEntry {
  readonly pose: PoseSpec;
  readonly yaml: string;
}

interface ParsedLibrary {
  readonly entries: readonly LibraryEntry[];
  readonly byId: ReadonlyMap<string, LibraryEntry>;
  readonly sequences: readonly SequenceSpec[];
}

let cache: ParsedLibrary | null = null;

/** Parse the bundled YAML once; the YAML itself is the only shipped truth. */
export const library = (): ParsedLibrary => {
  if (cache !== null) return cache;

  const entries = bundledPoses.map((f) => ({ pose: parsePose(f.yaml, f.file), yaml: f.yaml }));
  entries.sort((a, b) => a.pose.name.localeCompare(b.pose.name));
  cache = {
    entries,
    byId: new Map(entries.map((e) => [e.pose.id, e])),
    sequences: bundledSequences.map((f) => parseSequence(f.yaml, f.file)),
  };
  return cache;
};

export const families = (discipline: string): string[] =>
  [...new Set(library().entries.filter((e) => e.pose.discipline === discipline && e.pose.family !== undefined).map((e) => e.pose.family as string))].sort();

const thumbs = new Map<string, string>();

/** Small figure-only SVG for a library card, rendered on demand and cached. */
export const thumbnail = (id: string): string => {
  const hit = thumbs.get(id);
  if (hit !== undefined) return hit;
  const entry = library().byId.get(id);
  if (entry === undefined) return '';
  const svg = renderSvg(entry.pose, { width: 180, height: 220, style: 'minimal', background: 'none' });
  thumbs.set(id, svg);
  return svg;
};

export interface LibraryFilter {
  readonly query: string;
  readonly discipline: string | null;
  readonly family: string | null;
  readonly difficulty: number | null;
}

export const emptyFilter: LibraryFilter = { query: '', discipline: null, family: null, difficulty: null };

export const matches = (pose: PoseSpec, filter: LibraryFilter): boolean => {
  if (filter.discipline !== null && pose.discipline !== filter.discipline) return false;
  if (filter.family !== null && pose.family !== filter.family) return false;
  if (filter.difficulty !== null && pose.difficulty !== filter.difficulty) return false;
  if (filter.query !== '') {
    const haystack = [pose.id, pose.name, pose.sanskrit ?? '', pose.english ?? '', ...pose.tags].join(' ').toLowerCase();
    if (!haystack.includes(filter.query.toLowerCase())) return false;
  }
  return true;
};
