import { z } from 'zod';
import { MUSCLE_IDS } from '../anatomy/muscles.js';
import { BONE_IDS, LANDMARK_IDS } from '../core/types.js';

/** Current version of the .pose file format. Bumped only on breaking changes. */
export const POSE_FORMAT_VERSION = 1;

const MAX_JOINT_DEG = 360;

const point = z.tuple([z.number(), z.number()]);

/** Anything an annotation or prop can be pinned to: a named landmark or a raw point. */
const anchor = z.union([z.enum(LANDMARK_IDS), point]);

export const jointsSchema = z
  .partialRecord(z.enum(BONE_IDS), z.number().min(-MAX_JOINT_DEG).max(MAX_JOINT_DEG))
  .describe('Joint rotations in degrees, relative to anatomical neutral (standing, arms down).');

export const figureSchema = z.object({
  view: z.enum(['front', 'back', 'side', 'three-quarter']).default('front'),
  /** Mirror the figure left-to-right, so a side-view figure faces the other way. */
  flip: z.boolean().default(false),
  /** Swap all left and right joint angles: the "other side" of an asymmetric asana. */
  mirror: z.boolean().default(false),
  /** Drop the figure so its lowest point rests on the ground line. */
  grounded: z.boolean().default(true),
  root: z
    .object({
      position: point.default([0, 0]),
      rotation: z.number().default(90).describe('Pelvis angle in degrees; 90 = upright, 0 = lying head-first.'),
      scale: z.number().positive().default(1),
    })
    .prefault({}),
  joints: jointsSchema.default({}),
});

const annotationBase = { label: z.string().optional(), color: z.string().optional() };

export const annotationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('angle'),
    at: z.enum(LANDMARK_IDS),
    from: z.enum(LANDMARK_IDS),
    to: z.enum(LANDMARK_IDS),
    radius: z.number().positive().default(0.06),
    ...annotationBase,
  }),
  z.object({
    type: z.literal('line'),
    from: anchor,
    to: anchor,
    dashed: z.boolean().default(true),
    extend: z.number().min(0).default(0).describe('Extend the line past both ends, in stature units.'),
    ...annotationBase,
  }),
  z.object({
    type: z.literal('plumb'),
    at: anchor,
    dashed: z.boolean().default(true),
    ...annotationBase,
  }),
  z.object({
    type: z.literal('arrow'),
    from: anchor,
    to: anchor,
    curve: z.number().default(0).describe('Bow the arrow sideways; negative curves the other way.'),
    ...annotationBase,
  }),
  z.object({
    type: z.literal('label'),
    at: anchor,
    text: z.string(),
    offset: point.default([0.08, 0.04]),
    ...annotationBase,
  }),
  z.object({
    type: z.literal('point'),
    at: anchor,
    ...annotationBase,
  }),
]);

export const propSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ground'), y: z.number().default(0), width: z.number().positive().default(2.4) }),
  z.object({
    type: z.literal('mat'),
    y: z.number().default(0),
    width: z.number().positive().default(1.9),
    thickness: z.number().positive().default(0.022),
    rolled: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('block'),
    at: anchor,
    rotation: z.number().default(0),
    width: z.number().positive().default(0.22),
    height: z.number().positive().default(0.12),
  }),
  z.object({ type: z.literal('strap'), from: anchor, to: anchor, sag: z.number().default(0.02) }),
  z.object({ type: z.literal('wall'), x: z.number().default(-0.9), facing: z.enum(['left', 'right']).default('left') }),
  z.object({
    type: z.literal('surfboard'),
    /** Position the board under these landmarks (usually both feet), or pin it explicitly. */
    under: z.array(z.enum(LANDMARK_IDS)).default([]),
    at: point.optional(),
    rotation: z.number().default(0),
    length: z.number().positive().default(1.15),
    offset: point.default([0, -0.03]),
  }),
  z.object({
    type: z.literal('wave'),
    amplitude: z.number().positive().default(0.35),
    length: z.number().positive().default(3),
    y: z.number().default(-0.15),
    breaking: z.boolean().default(true),
    facing: z.enum(['left', 'right']).default('right'),
  }),
]);

export const poseSchema = z.object({
  posekit: z.literal(POSE_FORMAT_VERSION, `Unsupported "posekit" format version (expected ${POSE_FORMAT_VERSION}).`),
  id: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be a lowercase kebab-case slug')
    .describe('Stable slug, unique within a library.'),
  name: z.string().min(1),
  sanskrit: z.string().optional(),
  english: z.string().optional(),
  discipline: z.enum(['yoga', 'surf', 'other']),
  family: z.string().optional().describe('Grouping inside a discipline, e.g. "standing" or "seated".'),
  difficulty: z.number().int().min(1).max(5).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  cues: z.array(z.string()).default([]).describe('Teaching cues, rendered as a caption block.'),
  drishti: z.string().optional().describe('Gaze point (Ashtanga).'),
  breath: z.enum(['inhale', 'exhale', 'hold', 'free']).optional(),
  figure: figureSchema.prefault({}),
  props: z.array(propSchema).default([]),
  annotations: z.array(annotationSchema).default([]),
  muscles: z
    .object({
      engaged: z.array(z.enum(MUSCLE_IDS)).default([]),
      stretched: z.array(z.enum(MUSCLE_IDS)).default([]),
    })
    .prefault({}),
  source: z.string().optional().describe('Where the posture data came from, for attribution.'),
});

export type PoseSpec = z.output<typeof poseSchema>;
export type PoseSpecInput = z.input<typeof poseSchema>;
export type FigureSpec = z.output<typeof figureSchema>;
export type Annotation = z.output<typeof annotationSchema>;
export type Prop = z.output<typeof propSchema>;
export type Anchor = z.output<typeof anchor>;

export const sequenceSchema = z.object({
  posekit: z.literal(POSE_FORMAT_VERSION),
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),
  tradition: z.string().optional(),
  description: z.string().optional(),
  sections: z
    .array(
      z.object({
        name: z.string(),
        steps: z.array(
          z.object({
            pose: z.string().describe('Pose id, resolved against the loaded pose library.'),
            label: z.string().optional(),
            breath: z.enum(['inhale', 'exhale', 'hold', 'free']).optional(),
            count: z.number().int().positive().default(1).describe('Breaths held.'),
            side: z.enum(['left', 'right', 'both', 'none']).default('none'),
            note: z.string().optional(),
          }),
        ),
      }),
    )
    .default([]),
});

export type SequenceSpec = z.output<typeof sequenceSchema>;

export const poseJsonSchema = (): Record<string, unknown> => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://posekit.dev/schema/pose-v1.json',
  title: 'posekit pose',
  ...z.toJSONSchema(poseSchema, { io: 'input' }),
});

export const sequenceJsonSchema = (): Record<string, unknown> => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://posekit.dev/schema/sequence-v1.json',
  title: 'posekit sequence',
  ...z.toJSONSchema(sequenceSchema, { io: 'input' }),
});
