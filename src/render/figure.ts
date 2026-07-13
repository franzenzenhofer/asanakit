import { curveCatmullRomClosed, line } from 'd3-shape';
import type { BoneId } from '../core/types.js';
import type { Vec2 } from '../core/vec2.js';
import type { ViewBone, ViewSkeleton } from './camera.js';
import type { RenderContext } from './context.js';
import { renderHead } from './head.js';
import { el, group, type SvgNode } from './svg.js';

const JOINT_LANDMARKS = [
  'shoulderL',
  'elbowL',
  'wristL',
  'shoulderR',
  'elbowR',
  'wristR',
  'hipJointL',
  'kneeL',
  'ankleL',
  'hipJointR',
  'kneeR',
  'ankleR',
  'chest',
  'hipCenter',
] as const;

const TORSO_BONES: readonly BoneId[] = ['pelvis', 'spine', 'neck', 'clavicleL', 'clavicleR', 'hipL', 'hipR'];

/** A limb this far behind the torso reads as "the far side" and gets the lighter stroke. */
const FAR_DEPTH = 0.02;

/** Something to paint, at a depth. Farther primitives go down first. */
interface Primitive {
  readonly depth: number;
  /** Stable tiebreak so equal depths never reorder between runs. */
  readonly key: string;
  readonly node: SvgNode;
}

const torsoDepth = (skeleton: ViewSkeleton): number => {
  const depths = TORSO_BONES.map((id) => skeleton.bones[id].depth);
  return depths.reduce((sum, d) => sum + d, 0) / depths.length;
};

const boneLine = (bone: ViewBone, farOpacity: number | undefined, ctx: RenderContext): SvgNode => {
  const { proj, style } = ctx;
  const [x1, y1] = proj.p(bone.start);
  const [x2, y2] = proj.p(bone.end);
  return el('line', {
    'data-bone': bone.id,
    'data-side': bone.side,
    x1,
    y1,
    x2,
    y2,
    stroke: bone.side === 'left' ? style.figure.strokeLeft : style.figure.stroke,
    'stroke-width': style.figure.strokeWidth * proj.s,
    'stroke-linecap': style.figure.lineCap,
    opacity: farOpacity,
  });
};

const closedPath = line<Vec2>()
  .x((p) => p[0])
  .y((p) => p[1])
  .curve(curveCatmullRomClosed);

/** A filled trunk between the shoulders and the hips, for the heavier styles. */
const torsoShape = ({ skeleton, proj, style }: RenderContext): SvgNode | null => {
  if (style.figure.torsoWidth <= 0) return null;
  const l = skeleton.landmarks;
  const outline: Vec2[] = [l.shoulderL, l.chest, l.shoulderR, l.hipJointR, l.hipCenter, l.hipJointL].map((p) =>
    proj.p(p),
  );
  const d = closedPath(outline);
  if (d === null) return null;
  return el('path', {
    'data-part': 'torso',
    d,
    fill: style.figure.fill === 'none' ? style.figure.stroke : style.figure.fill,
    stroke: style.figure.stroke,
    'stroke-width': style.figure.torsoWidth * proj.s,
    'stroke-linejoin': 'round',
  });
};

const joints = ({ skeleton, proj, style }: RenderContext): SvgNode | null => {
  if (style.figure.joints !== 'dots') return null;
  return group(
    { 'data-part': 'joints' },
    JOINT_LANDMARKS.map((id) => {
      const [cx, cy] = proj.p(skeleton.landmarks[id]);
      return el('circle', {
        'data-joint': id,
        cx,
        cy,
        r: style.figure.jointRadius * proj.s * skeleton.scale,
        fill: id.endsWith('L') ? style.figure.strokeLeft : style.figure.stroke,
      });
    }),
  );
};

/**
 * Draw the figure farthest-first: every bone, the trunk and the head are
 * depth-sorted primitives from the camera projection, so any viewpoint reads
 * as a body rather than a tangle. Limbs well behind the torso take the
 * lighter "far" stroke - real depth doing what the old per-view flag faked.
 */
export const renderFigure = (ctx: RenderContext): SvgNode => {
  const { skeleton, style } = ctx;
  const centre = torsoDepth(skeleton);
  const optional = (node: SvgNode | null): SvgNode[] => (node === null ? [] : [node]);

  const boneNodes: Primitive[] = Object.values(skeleton.bones).map((bone) => {
    const far = style.figure.farOpacity < 1 && bone.depth < centre - FAR_DEPTH;
    return {
      depth: bone.depth,
      key: bone.id,
      node: boneLine(bone, far ? style.figure.farOpacity : undefined, ctx),
    };
  });

  const solids: Primitive[] = [
    ...optional(torsoShape(ctx)).map((node) => ({ depth: centre, key: 'torso', node })),
    ...optional(renderHead(ctx)).map((node) => ({ depth: skeleton.bones.head.depth, key: 'head', node })),
  ];

  const painted = [...boneNodes, ...solids].sort(
    (a, b) => a.depth - b.depth || a.key.localeCompare(b.key),
  );

  return group({ 'data-layer': 'figure' }, [...painted.map((p) => p.node), ...optional(joints(ctx))]);
};
