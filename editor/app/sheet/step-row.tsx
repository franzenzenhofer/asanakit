import { useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import { thumbnail } from '../state/library.js';
import { patchStep, moveStep, removeStep, type StepInput } from '../state/sheet-doc.js';

const SIDES = ['none', 'left', 'right', 'both'] as const;
const BREATHS = ['inhale', 'exhale', 'free'] as const;

export interface StepRowProps {
  readonly section: number;
  readonly index: number;
  readonly step: StepInput;
  readonly name: string;
}

/** One sheet step: thumbnail, name, and tap-to-cycle side / breath / count. */
export const StepRow = ({ section, index, step, name }: StepRowProps): JSX.Element => {
  const thumb = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thumb.current !== null) thumb.current.innerHTML = thumbnail(step.pose);
  }, [step.pose]);

  const cycle = <T extends string>(options: readonly T[], current: T | undefined): T => {
    const at = options.indexOf(current ?? options[0] as T);
    return options[(at + 1) % options.length] as T;
  };

  const side = step.side ?? 'none';
  const count = step.count ?? 1;

  return (
    <div class="step-row">
      <span class="thumb" ref={thumb} aria-hidden="true" />
      <div class="info">
        <div class="name">{name}</div>
        <div class="opts">
          <button class={side !== 'none' ? 'on' : ''} onClick={() => patchStep(section, index, { side: cycle(SIDES, side) })}>
            {side === 'none' ? 'side' : side}
          </button>
          <button class={step.breath !== undefined ? 'on' : ''} onClick={() => patchStep(section, index, { breath: cycle(BREATHS, step.breath) })}>
            {step.breath ?? 'breath'}
          </button>
          <button class={count > 1 ? 'on' : ''} onClick={() => patchStep(section, index, { count: count >= 10 ? 1 : count + 1 })}>
            ×{count}
          </button>
        </div>
      </div>
      <div class="rowactions">
        <button aria-label="Move up" onClick={() => moveStep(section, index, -1)}>▲</button>
        <button aria-label="Move down" onClick={() => moveStep(section, index, 1)}>▼</button>
        <button aria-label="Remove" onClick={() => removeStep(section, index)}>✕</button>
      </div>
    </div>
  );
};
