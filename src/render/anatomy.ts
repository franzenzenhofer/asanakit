import { path } from 'd3-path';
import { MUSCLES, MUSCLE_IDS, muscleBones, type MuscleDef, type MuscleId } from '../anatomy/muscles.js';
import type { BoneSegment } from '../core/types.js';
import { along, sub, type Vec2 } from '../core/vec2.js';
import type { RenderContext } from './context.js';
import type { Style } from './styles.js';
import { el, group, num, type SvgNode } from './svg.js';

export type MuscleState = 'engaged' | 'stretched' | 'resting';

const BULGE = 0.35;

const stateOf = (id: MuscleId, engaged: readonly MuscleId[], stretched: readonly MuscleId[]): MuscleState => {
  if (engaged.includes(id)) return 'engaged';
  if (stretched.includes(id)) return 'stretched';
  return 'resting';
};

const fillFor = (state: MuscleState, style: Style): string => {
  if (state === 'engaged') return style.muscles.engaged;
  if (state === 'stretched') return style.muscles.stretched;
  return style.muscles.base;
};

/**
 * A muscle belly is an arc that bows away from the bone: two endpoints on the
 * bone's offset line plus a quadratic control point pushed out sideways. Drawn
 * as a thick round-capped stroke, that reads as a muscle without needing traced
 * anatomical artwork.
 */
const bellyPath = (bone: BoneSegment, muscle: MuscleDef, offsetSign: number, ctx: RenderContext): string => {
  const { proj } = ctx;
  const scale = ctx.skeleton.scale;
  const offset = muscle.offset * offsetSign * scale;
  const a: Vec2 = along(bone.start, bone.end, muscle.t0, offset);
  const b: Vec2 = along(bone.start, bone.end, muscle.t1, offset);
  const mid: Vec2 = along(bone.start, bone.end, (muscle.t0 + muscle.t1) / 2, offset + muscle.width * BULGE * offsetSign * scale);

  const [ax, ay] = proj.p(a);
  const [bx, by] = proj.p(b);
  const [mx, my] = proj.p(mid);
  const p = path();
  p.moveTo(num(ax), num(ay));
  p.quadraticCurveTo(num(mx), num(my), num(bx), num(by));
  return p.toString();
};

const isDegenerate = (bone: BoneSegment): boolean => {
  const d = sub(bone.end, bone.start);
  return Math.hypot(d[0], d[1]) < 1e-6;
};

/**
 * Muscle layer for the anatomy styles. Rendered under the bone lines, so the
 * skeleton still reads on top of the shading.
 */
export const renderMuscles = (
  ctx: RenderContext,
  engaged: readonly MuscleId[],
  stretched: readonly MuscleId[],
): SvgNode | null => {
  const { skeleton, proj, style } = ctx;
  if (!style.muscles.show) return null;

  const shapes: SvgNode[] = [];
  for (const id of MUSCLE_IDS) {
    const muscle = MUSCLES[id];
    const state = stateOf(id, engaged, stretched);
    for (const { bone: boneId, offsetSign } of muscleBones(muscle)) {
      const bone = skeleton.bones[boneId];
      if (isDegenerate(bone)) continue;
      shapes.push(
        el('path', {
          'data-muscle': id,
          'data-muscle-state': state,
          d: bellyPath(bone, muscle, offsetSign, ctx),
          fill: 'none',
          stroke: fillFor(state, style),
          'stroke-width': muscle.width * proj.s * skeleton.scale,
          'stroke-linecap': 'round',
          opacity: style.muscles.opacity,
        }),
      );
    }
  }

  return group({ 'data-layer': 'muscles' }, shapes);
};
