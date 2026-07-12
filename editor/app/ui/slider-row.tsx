import type { JSX } from 'preact';

export interface SliderRowProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  /** Live change; transient=true while the finger is still down. */
  readonly onChange: (value: number, transient: boolean) => void;
  readonly onCommit?: () => void;
}

/** A goniometer row: ruler-ticked slider, steppers, and exact numeric entry. */
export const SliderRow = ({ label, value, min, max, onChange, onCommit }: SliderRowProps): JSX.Element => {
  const commit = (): void => onCommit?.();

  const nudge = (delta: number): void => {
    onChange(Math.max(min, Math.min(max, Math.round(value) + delta)), false);
    commit();
  };

  return (
    <div class="slider-row">
      <span class="label">{label}</span>
      <div class="slider-track">
        <span class="slider-ticks" />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={Math.round(value)}
          aria-label={label}
          onInput={(e) => onChange(Number((e.target as HTMLInputElement).value), true)}
          onPointerUp={commit}
          onKeyUp={commit}
        />
      </div>
      <div class="slider-value">
        <input
          class="num"
          type="number"
          min={min}
          max={max}
          value={Math.round(value)}
          aria-label={`${label} in degrees`}
          onChange={(e) => {
            const next = Number((e.target as HTMLInputElement).value);
            if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)), false);
            commit();
          }}
        />
        <span class="deg">°</span>
        <div class="stepper">
          <button aria-label={`${label} +1°`} onClick={() => nudge(1)}>▲</button>
          <button aria-label={`${label} -1°`} onClick={() => nudge(-1)}>▼</button>
        </div>
      </div>
    </div>
  );
};
