import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parsePose, parseSequence, parseSheet } from './parse.js';
import type { PoseSpec, SequenceSpec } from './schema.js';
import type { SheetSpec } from './sheet.js';

/**
 * File loading lives apart from parsing so every parser stays browser-safe:
 * importing the model barrel must never touch node:fs.
 */
export const loadPoseFile = async (path: string): Promise<PoseSpec> =>
  parsePose(await readFile(path, 'utf8'), basename(path));

export const loadSequenceFile = async (path: string): Promise<SequenceSpec> =>
  parseSequence(await readFile(path, 'utf8'), basename(path));

export const loadSheetFile = async (path: string): Promise<SheetSpec> =>
  parseSheet(await readFile(path, 'utf8'), basename(path));
