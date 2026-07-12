import { curveCatmullRomClosed, line } from 'd3-shape';
import type { BoneId, BoneSegment, Skeleton, ViewId } from '../core/types.js';
import type { Vec2 } from '../core/vec2.js';
import type { RenderContext } from './context.js';
import { el, group, type SvgNode } from './svg.js';

const LIMB_BONES: readonly BoneId[] = [
  'upperArmL',
  'forearmL',
  'handL',
  'thighL',
  'shinL',
  'footL',
  'upperArmR',
  'forearmR',
  'handR',
  'thighR',
  'shinR',
  'footR',
];

const TORSO_BONES: readonly BoneId[] = ['pelvis', 'spine', 'neck', 'clavicleL', 'clavicleR', 'hipL', 'hipR'];

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

/** In a profile view the far-side limbs sit behind the body and read as lighter. */
const FAR_SIDE_VIEWS: readonly ViewId[] = ['side', 'three-quarter'];

const isFar = (bone: BoneSegment, view: ViewId): boolean => FAR_SIDE_VIEWS.includes(view) && bone.side === 'right';

const boneLine = (bone: BoneSegment, ctx: RenderContext): SvgNode => {
  const { proj, style } = ctx;
  const view = ctx.skeleton.view;
  const [x1, y1] = proj.p(bone.start);
  const [x2, y2] = proj.p(bone.end);
  return el('line', {
    'data-bone': bone.id,
    x1,
    y1,
    x2,
    y2,
    stroke: style.figure.stroke,
    'stroke-width': style.figure.strokeWidth * proj.s,
    'stroke-linecap': style.figure.lineCap,
    opacity: isFar(bone, view) ? style.figure.farOpacity : undefined,
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

const head = ({ skeleton, proj, style }: RenderContext): SvgNode | null => {
  if (style.head.shape === 'none') return null;
  const bone = skeleton.bones.head;
  const [cx, cy] = proj.p(skeleton.landmarks.headCenter);
  const rx = style.head.rx * proj.s * skeleton.scale;
  const ry = (style.head.shape === 'circle' ? style.head.rx : style.head.ry) * proj.s * skeleton.scale;
  // SVG rotates clockwise because y points down, so the sign flips against the world angle.
  const rotation = 90 - bone.worldAngle;

  return el('ellipse', {
    'data-part': 'head',
    cx,
    cy,
    rx,
    ry,
    transform: rotation === 0 ? undefined : `rotate(${rotation.toFixed(3)} ${cx.toFixed(3)} ${cy.toFixed(3)})`,
    fill: style.head.fill,
    stroke: style.head.stroke,
    'stroke-width': style.head.strokeWidth * proj.s,
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
        fill: style.figure.stroke,
      });
    }),
  );
};

const bonesOf = (skeleton: Skeleton, ids: readonly BoneId[], side: 'far' | 'near' | 'all'): BoneSegment[] =>
  ids
    .map((id) => skeleton.bones[id])
    .filter((bone) => {
      if (side === 'all') return true;
      const far = isFar(bone, skeleton.view);
      return side === 'far' ? far : !far;
    });

/**
 * Draw the figure back-to-front: far limbs, trunk, head, near limbs. That single
 * ordering is what makes a profile pose read as a body rather than a tangle.
 */
export const renderFigure = (ctx: RenderContext): SvgNode => {
  const { skeleton } = ctx;
  const draw = (bones: BoneSegment[]): SvgNode[] => bones.map((b) => boneLine(b, ctx));
  const optional = (node: SvgNode | null): SvgNode[] => (node === null ? [] : [node]);

  return group({ 'data-layer': 'figure' }, [
    group({ 'data-layer': 'limbs-far' }, draw(bonesOf(skeleton, LIMB_BONES, 'far'))),
    group({ 'data-layer': 'torso' }, [
      ...optional(torsoShape(ctx)),
      ...draw(bonesOf(skeleton, TORSO_BONES, 'all')),
    ]),
    ...optional(head(ctx)),
    group({ 'data-layer': 'limbs-near' }, draw(bonesOf(skeleton, LIMB_BONES, 'near'))),
    ...optional(joints(ctx)),
  ]);
};
