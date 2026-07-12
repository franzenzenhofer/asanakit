import type { PoseSpec, StepSpec } from './schema.js';

/** A step flattened to one concrete rendering: one pose, one side. */
export interface ExpandedStep {
  readonly pose: PoseSpec;
  readonly label: string;
  readonly section: string;
  readonly breath?: 'inhale' | 'exhale' | 'hold' | 'free';
  readonly count: number;
  readonly side: 'left' | 'right' | 'none';
  readonly note?: string;
}

/** The true mirror of an asana: L/R joints swap and absolute directions reflect. */
export const mirrorPose = (pose: PoseSpec): PoseSpec => ({
  ...pose,
  figure: { ...pose.figure, mirror: !pose.figure.mirror },
});

/**
 * Expand one step into the poses it actually renders: `side: both` becomes a
 * left and a mirrored right repetition - which is how the practice runs.
 * The single source of truth for side expansion; sequences and sheets share it.
 */
export const expandStep = (step: StepSpec, pose: PoseSpec, section: string): ExpandedStep[] => {
  const sides = step.side === 'both' ? (['left', 'right'] as const) : ([step.side] as const);
  return sides.map((side) => ({
    pose: side === 'right' ? mirrorPose(pose) : pose,
    label: step.label ?? pose.name,
    section,
    ...(step.breath === undefined ? {} : { breath: step.breath }),
    count: step.count,
    side,
    ...(step.note === undefined ? {} : { note: step.note }),
  }));
};

export type PoseResolver = (id: string) => PoseSpec | undefined;
