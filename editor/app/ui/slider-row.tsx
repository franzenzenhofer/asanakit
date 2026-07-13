import type { JSX } from 'preact';
import { adjusting } from '../state/layout.js';

/** Nothing sane lives outside this, whatever a typed value claims. */
const ABSOLUTE = 360;

export interface SliderRowProps {
  readonly label: string;
  readonly value: number;
  /** The range a real joint has. The slider spans it; the number field may exceed it. */
  readonly min: number;
  readonly max: number;
  readonly unit?: string;
  /** Live change; transient=true while the finger is still down. */
  readonly onChange: (value: number, transient: boolean) => void;
  readonly onCommit?: () => void;
}

const round = (value: number, unit: string): number =>
  unit === '°' ? Math.round(value) : Math.round(value * 1000) / 1000;

/**
 * A goniometer row: ruler-ticked slider, steppers, and exact numeric entry.
 *
 * The slider spans what the joint can actually do, so you cannot drag your way
 * into an impossible body - but the number field still takes anything, because
 * the author is allowed to mean it, and lint will have its say. The label sits
 * on its own line: "Internal rotation" does not fit beside a slider on a phone,
 * least of all at 200% text size.
 */
export const SliderRow = ({ label, value, min, max, unit = '°', onChange, onCommit }: SliderRowProps): JSX.Element => {
  const step = unit === '°' ? 1 : 0.005;
  const clamp = (v: number): number => Math.max(-ABSOLUTE, Math.min(ABSOLUTE, v));

  // While the finger is on the slider the sheet fades, so you watch the body
  // move under your own thumb instead of guessing behind a wall of controls.
  const commit = (): void => {
    adjusting.value = false;
    onCommit?.();
  };

  const nudge = (delta: number): void => {
    onChange(clamp(round(value + delta * step, unit)), false);
    commit();
  };

  const outside = value < min || value > max;

  return (
    <div class="slider-row">
      <div class="slider-head">
        <span class="label">{label}</span>
        <span class={`slider-value ${outside ? 'outside' : ''}`}>
          <input
            class="num"
            type="number"
            step={step}
            value={round(value, unit)}
            aria-label={`${label}${unit === '°' ? ' in degrees' : ''}`}
            onChange={(e) => {
              const next = Number((e.target as HTMLInputElement).value);
              if (Number.isFinite(next)) onChange(clamp(next), false);
              commit();
            }}
          />
          <span class="deg">{unit}</span>
          <span class="stepper">
            <button aria-label={`${label} up`} onClick={() => nudge(1)}>▲</button>
            <button aria-label={`${label} down`} onClick={() => nudge(-1)}>▼</button>
          </span>
        </span>
      </div>
      <div class="slider-track">
        <span class="slider-ticks" />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.max(min, Math.min(max, value))}
          aria-label={label}
          onPointerDown={() => (adjusting.value = true)}
          onInput={(e) => onChange(Number((e.target as HTMLInputElement).value), true)}
          onPointerUp={commit}
          onPointerCancel={commit}
          onBlur={commit}
          onKeyUp={commit}
        />
      </div>
    </div>
  );
};
