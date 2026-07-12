import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import { poseSchema, sequenceSchema, type PoseSpec, type SequenceSpec } from './schema.js';

/** Every failure posekit raises on bad input, so a CLI can print it without a stack trace. */
export class PoseParseError extends Error {
  constructor(
    readonly file: string,
    readonly problems: readonly string[],
  ) {
    super(`${file}: ${problems.length} problem(s)\n  - ${problems.join('\n  - ')}`);
    this.name = 'PoseParseError';
  }
}

const describeIssue = (issue: z.core.$ZodIssue): string => {
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  return `${path}: ${issue.message}`;
};

/**
 * YAML is a superset of JSON, so one parser handles both `.pose.yaml` and
 * `.pose.json`. Fail loudly, listing every problem at once - an AI or a human
 * editing a pose file wants the whole list, not the first error.
 */
const parseWith = <T>(schema: z.ZodType<T>, text: string, file: string): T => {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (error) {
    throw new PoseParseError(file, [error instanceof Error ? error.message : String(error)]);
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new PoseParseError(file, result.error.issues.map(describeIssue));
  }
  return result.data;
};

export const parsePose = (text: string, file = '<inline>'): PoseSpec => parseWith(poseSchema, text, file);

export const parseSequence = (text: string, file = '<inline>'): SequenceSpec => parseWith(sequenceSchema, text, file);

export const loadPoseFile = async (path: string): Promise<PoseSpec> =>
  parsePose(await readFile(path, 'utf8'), basename(path));

export const loadSequenceFile = async (path: string): Promise<SequenceSpec> =>
  parseSequence(await readFile(path, 'utf8'), basename(path));
