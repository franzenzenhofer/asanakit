import { z } from 'zod';
import { STYLE_IDS, type StyleId } from '../render/styles.js';
import { POSE_FORMAT_VERSION, poseSchema, sectionSchema } from './schema.js';
import { expandStep, type ExpandedStep, type PoseResolver } from './steps.js';

const VERSION_MESSAGE = `Unsupported "asanakit" format version (expected ${POSE_FORMAT_VERSION}).`;

export const PAPER_IDS = ['a4', 'letter'] as const;
export type PaperId = (typeof PAPER_IDS)[number];

/**
 * A sheet is a printable document: practice content (the same step shape a
 * sequence uses) plus presentation. Sequences stay pure practice data; sheets
 * carry paper, density and what to print - and may embed user-authored poses.
 */
export const sheetSchema = z.object({
  asanakit: z.literal(POSE_FORMAT_VERSION, VERSION_MESSAGE),
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be a lowercase kebab-case slug'),
  name: z.string().min(1),
  description: z.string().optional(),
  paper: z.enum(PAPER_IDS).default('a4'),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  columns: z.number().int().min(1).max(8).default(4),
  style: z.enum(STYLE_IDS as [StyleId, ...StyleId[]]).default('stick'),
  show: z
    .object({
      sanskrit: z.boolean().default(true),
      breath: z.boolean().default(true),
      numbers: z.boolean().default(true),
      cues: z.boolean().default(false),
    })
    .prefault({}),
  header: z.string().optional().describe('Printed across the top of page 1; defaults to the sheet name.'),
  footer: z.string().optional().describe('Printed at the bottom of every page, next to the page number.'),
  sections: z.array(sectionSchema).default([]),
  poses: z.array(poseSchema).default([]).describe('Inline poses, resolved before the library.'),
});

export type SheetSpec = z.output<typeof sheetSchema>;
export type SheetSpecInput = z.input<typeof sheetSchema>;

/**
 * Flatten a sheet into the cells it renders, in order, keeping section
 * boundaries. Inline poses win over the library resolver.
 */
export const expandSheet = (sheet: SheetSpec, resolve: PoseResolver = () => undefined): ExpandedStep[] => {
  const inline = new Map(sheet.poses.map((pose) => [pose.id, pose]));
  return sheet.sections.flatMap((section) =>
    section.steps.flatMap((step) => {
      const pose = inline.get(step.pose) ?? resolve(step.pose);
      if (pose === undefined) throw new Error(`Sheet "${sheet.id}" references unknown pose "${step.pose}"`);
      return expandStep(step, pose, section.name);
    }),
  );
};
