import { parsePose, poseSchema, type PoseSpec, type PoseSpecInput } from '@asanakit/model/index.js';
import { stringify } from 'yaml';

/** Canonical key order for a .pose.yaml, matching docs/AUTHORING.md conventions. */
const POSE_KEYS = [
  'asanakit', 'id', 'name', 'sanskrit', 'english', 'discipline', 'family', 'difficulty',
  'description', 'tags', 'cues', 'drishti', 'breath', 'contact', 'camera', 'physics',
  'figure', 'props', 'annotations', 'muscles', 'source',
] as const;

const FIGURE_KEYS = ['mirror', 'grounded', 'root', 'joints', 'world'] as const;

const ordered = (value: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (value[key] !== undefined) out[key] = value[key];
  for (const key of Object.keys(value)) if (!(key in out) && value[key] !== undefined) out[key] = value[key];
  return out;
};

const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' && value !== null && Object.keys(value).length === 0);

/**
 * Serialize a pose to YAML in canonical key order, dropping empty collections
 * so a saved file reads like a hand-authored one.
 */
const tidyFigure = (raw: Record<string, unknown>): void => {
  if (typeof raw['figure'] !== 'object' || raw['figure'] === null) return;
  const figure = ordered(raw['figure'] as Record<string, unknown>, FIGURE_KEYS);
  if (figure['mirror'] === false) delete figure['mirror'];
  if (figure['grounded'] === true) delete figure['grounded'];
  for (const key of ['root', 'joints', 'world']) if (isEmpty(figure[key])) delete figure[key];
  raw['figure'] = figure;
};

export const toYaml = (pose: PoseSpecInput): string => {
  const raw = ordered({ ...pose }, POSE_KEYS);
  tidyFigure(raw);

  const muscles = raw['muscles'] as { engaged?: unknown[]; stretched?: unknown[] } | undefined;
  if (muscles !== undefined && isEmpty(muscles.engaged) && isEmpty(muscles.stretched)) delete raw['muscles'];
  for (const key of ['tags', 'cues', 'contact', 'props', 'annotations']) if (isEmpty(raw[key])) delete raw[key];
  if (raw['physics'] === 'none') delete raw['physics'];

  return stringify(raw, { lineWidth: 100 });
};

export const fromYaml = (text: string): PoseSpec => parsePose(text);

/** Validate an editable pose against the schema; the one gate before render. */
export const validateInput = (pose: PoseSpecInput): { spec?: PoseSpec; errors: string[] } => {
  const result = poseSchema.safeParse(pose);
  if (result.success) return { spec: result.data, errors: [] };
  return { errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
};
