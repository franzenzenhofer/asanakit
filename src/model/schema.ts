import { z } from 'zod';
import { MUSCLE_IDS } from '../anatomy/muscles.js';
import { CAMERA_PRESET_IDS, type CameraPresetId } from '../core/camera.js';
import { BONE_IDS, LANDMARK_IDS, type BoneId } from '../core/types.js';

/** Current version of the .pose file format. Bumped only on breaking changes. */
export const POSE_FORMAT_VERSION = 2;

const VERSION_MESSAGE = `Unsupported "asanakit" format version (expected ${POSE_FORMAT_VERSION}). Format 1 was the retired 2D era; re-author the figure in 3D (see docs/AUTHORING.md).`;

const MAX_JOINT_DEG = 360;

const point = z.tuple([z.number(), z.number()]);

const point3 = z.tuple([z.number(), z.number(), z.number()]);

/** Anything an annotation or prop can be pinned to: a named landmark or a raw picture-plane point. */
const anchor = z.union([z.enum(LANDMARK_IDS), point]);

const jointAngle = z.number().min(-MAX_JOINT_DEG).max(MAX_JOINT_DEG);

const ANTONYMS = [
  ['flex', 'extend'],
  ['abduct', 'adduct'],
  ['twist', 'externalRotation'],
  ['twist', 'internalRotation'],
  ['externalRotation', 'internalRotation'],
] as const;

/**
 * A joint rotation. A bare number is pure flexion - "forearmL: 90" bends the
 * elbow 90 degrees, the way anatomy says it. The object form speaks full
 * anatomical vocabulary: flex/extend, abduct/adduct, twist (positive =
 * external rotation) or internalRotation/externalRotation by name. Naming
 * both directions of the same axis is a contradiction and fails loudly.
 */
const jointValue = z.union([
  jointAngle,
  z
    .object({
      flex: jointAngle.optional(),
      extend: jointAngle.optional().describe('Extension: negative flexion, by its anatomical name.'),
      abduct: jointAngle.optional(),
      adduct: jointAngle.optional().describe('Adduction: toward the midline.'),
      twist: jointAngle.optional().describe('About the bone; positive = external rotation.'),
      externalRotation: jointAngle.optional(),
      internalRotation: jointAngle.optional(),
    })
    .superRefine((joint, ctx) => {
      for (const [a, b] of ANTONYMS) {
        if (joint[a] !== undefined && joint[b] !== undefined) {
          ctx.addIssue({ code: 'custom', message: `"${a}" and "${b}" name the same axis; give one or the other` });
        }
      }
    })
    .describe('Rotation in degrees about the bone\'s anatomical axes.'),
]);

export const jointsSchema = z
  .partialRecord(z.enum(BONE_IDS), jointValue)
  .describe('Joint rotations in degrees, relative to anatomical neutral (standing, arms down, facing +z).');

const worldDirection = z
  .object({
    azimuth: z.number().min(-360).max(360).default(0).describe('Turn from +z (facing direction) toward +x (the figure\'s left).'),
    elevation: z.number().min(-90).max(90).default(0).describe('Rise from horizontal; 90 = straight up, -90 = straight down.'),
    twist: jointAngle.optional().describe('Rotation about the bone\'s own axis, after aiming it.'),
  })
  .describe('An absolute direction for this bone in world space, overriding its parent chain.');

export const cameraSchema = z
  .union([
    z.enum(CAMERA_PRESET_IDS as [CameraPresetId, ...CameraPresetId[]]),
    z.object({
      azimuth: z.number().min(-360).max(360).default(0),
      elevation: z.number().min(-90).max(90).default(0),
      roll: z.number().min(-180).max(180).default(0),
    }),
  ])
  .describe('Default viewpoint: a preset name, or orbit angles in degrees. The CLI --camera flag overrides it.');

/**
 * A bone aimed EXACTLY straight up or straight down has no azimuth: `rotationTo`
 * takes the shortest arc from the bone's rest direction, and when the target is
 * (anti)parallel to it there is no arc to take - the azimuth is silently
 * discarded, and the facing that results is whatever the maths falls back to,
 * not what the author wrote. (One degree off, at elevation 89, the azimuth is
 * real again and does exactly what it says; only the pole is degenerate.)
 * Authors must say what they mean with `twist`, not with an azimuth that does
 * nothing.
 */
const DEGENERATE_ELEVATION = 90;

export const figureSchema = z.object({
  /** Swap all left and right joint values: the "other side" of an asymmetric asana. */
  mirror: z.boolean().default(false),
  /** Drop the figure so its lowest point rests on the ground plane. */
  grounded: z.boolean().default(true),
  root: z
    .object({
      position: point3.default([0, 0, 0]),
      yaw: z.number().default(0).describe('Turn the whole figure in degrees; positive faces it toward its left.'),
      pitch: z.number().default(0).describe('Tip the whole figure forward in degrees; 90 = horizontal, face down.'),
      roll: z.number().default(0).describe('Cartwheel the whole figure in degrees; positive drops its left side.'),
      scale: z.number().positive().default(1),
    })
    .prefault({}),
  joints: jointsSchema.default({}),
  world: z
    .partialRecord(z.enum(BONE_IDS), worldDirection)
    .default({})
    .describe('Absolute bone directions, overriding `joints` for that bone. Children still hang off it.'),
})
  .superRefine((figure, ctx) => {
    const joints: Partial<Record<BoneId, unknown>> = figure.joints ?? {};
    for (const [bone, direction] of Object.entries(figure.world ?? {})) {
      // The solver takes `world` and throws `joints` away. Throwing an author's
      // words away in silence is how a pose ends up meaning something nobody wrote.
      if (joints[bone as BoneId] !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['joints', bone],
          message: `"${bone}" is given in both "joints" and "world". A world direction overrides the joint entirely, so the joint value would be silently ignored - give one or the other.`,
        });
      }

      if (direction === undefined) continue;
      const { azimuth = 0, elevation = 0 } = direction;
      if (Math.abs(elevation) >= DEGENERATE_ELEVATION && azimuth !== 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['world', bone, 'azimuth'],
          message: `"${bone}" points straight ${elevation > 0 ? 'up' : 'down'} (elevation ${elevation}), so its azimuth of ${azimuth} does nothing and is discarded. Set azimuth to 0 and use "twist" to say which way it faces.`,
        });
      }
    }
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
  z.object({ type: z.literal('ground'), y: z.number().default(0), width: z.number().positive().default(1.6) }),
  z.object({
    type: z.literal('mat'),
    at: point
      .default([0, 0])
      .describe('[x, z] world position of the mat centre. Floor furniture: it never follows the body.'),
    y: z.number().default(0),
    width: z.number().positive().default(0.38).describe('Across the practice direction, in stature units.'),
    length: z.number().positive().default(1.35).describe('Along the practice direction.'),
    thickness: z.number().positive().default(0.006).describe('A real mat is about a centimetre thick.'),
    yaw: z.number().default(0).describe('Turn the mat; 90 lays its length along the figure\'s left-right axis.'),
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
    rotation: z.number().default(0).describe('Nose-up pitch in degrees.'),
    length: z.number().positive().default(1.15),
    width: z.number().positive().optional().describe('Defaults to a shortboard plan: length x 0.19.'),
    thickness: z.number().positive().default(0.024),
    offset: point.default([0, -0.03]).describe('[along the board, vertical]'),
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
  asanakit: z.literal(POSE_FORMAT_VERSION, VERSION_MESSAGE),
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
  camera: cameraSchema.default('front'),
  physics: z
    .enum(['none', 'settle'])
    .default('none')
    .describe('"settle" drops the figure onto the ground plane with a physics engine before rendering.'),
  contact: z
    .array(z.enum(LANDMARK_IDS))
    .default([])
    .describe('Landmarks that touch the floor in this posture. Validated against the solved figure.'),
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
export type CameraSpec = z.output<typeof cameraSchema>;
export type Annotation = z.output<typeof annotationSchema>;
export type Prop = z.output<typeof propSchema>;
export type Anchor = z.output<typeof anchor>;

/** One practice step: a pose reference plus how it is practised. Shared by sequences and sheets. */
export const stepSchema = z.object({
  pose: z.string().describe('Pose id, resolved against the loaded pose library.'),
  label: z.string().optional(),
  breath: z.enum(['inhale', 'exhale', 'hold', 'free']).optional(),
  count: z.number().int().positive().default(1).describe('Breaths held.'),
  side: z.enum(['left', 'right', 'both', 'none']).default('none'),
  note: z.string().optional(),
});

export const sectionSchema = z.object({
  name: z.string(),
  steps: z.array(stepSchema),
});

export type StepSpec = z.output<typeof stepSchema>;
export type SectionSpec = z.output<typeof sectionSchema>;

export const sequenceSchema = z.object({
  asanakit: z.literal(POSE_FORMAT_VERSION, VERSION_MESSAGE),
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.string().min(1),
  tradition: z.string().optional(),
  description: z.string().optional(),
  sections: z.array(sectionSchema).default([]),
});

export type SequenceSpec = z.output<typeof sequenceSchema>;

export const poseJsonSchema = (): Record<string, unknown> => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `https://asanakit.dev/schema/pose-v${POSE_FORMAT_VERSION}.json`,
  title: 'asanakit pose',
  ...z.toJSONSchema(poseSchema, { io: 'input' }),
});

export const sequenceJsonSchema = (): Record<string, unknown> => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `https://asanakit.dev/schema/sequence-v${POSE_FORMAT_VERSION}.json`,
  title: 'asanakit sequence',
  ...z.toJSONSchema(sequenceSchema, { io: 'input' }),
});
