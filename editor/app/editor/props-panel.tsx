import type { JSX } from 'preact';
import { LANDMARK_IDS } from '@asanakit/core/types.js';
import { propSchema, type PoseSpecInput } from '@asanakit/model/index.js';
import { commitGesture, dispatch, pose } from '../state/doc.js';
import { SliderRow } from '../ui/slider-row.js';

type PropInput = NonNullable<PoseSpecInput['props']>[number];
type PropType = PropInput['type'];

interface Field {
  readonly key: string;
  readonly label: string;
  readonly kind: 'number' | 'landmark' | 'boolean' | 'choice' | 'point';
  readonly choices?: readonly string[];
  readonly min?: number;
  readonly max?: number;
  readonly unit?: string;
}

/** A stature unit is the figure's height, so these read as fractions of a body. */
const M = { unit: '' } as const;
const DEG = { unit: '°', min: -180, max: 180 } as const;

/**
 * Which knobs each prop exposes, and how far each one may travel - data, not
 * code branches. Every number gets a slider; nothing is left to a bare box.
 */
const PROP_FIELDS: Record<PropType, readonly Field[]> = {
  ground: [{ key: 'width', label: 'Width', kind: 'number', min: 0.2, max: 4, ...M }],
  mat: [
    { key: 'at', label: 'Position', kind: 'point' },
    { key: 'yaw', label: 'Yaw', kind: 'number', ...DEG },
    { key: 'length', label: 'Length', kind: 'number', min: 0.6, max: 2, ...M },
    { key: 'width', label: 'Width', kind: 'number', min: 0.15, max: 0.9, ...M },
    { key: 'thickness', label: 'Thickness', kind: 'number', min: 0.001, max: 0.05, ...M },
    { key: 'y', label: 'Height', kind: 'number', min: -0.2, max: 0.5, ...M },
  ],
  block: [
    { key: 'at', label: 'Under', kind: 'landmark' },
    { key: 'height', label: 'Height', kind: 'number', min: 0.04, max: 0.3, ...M },
    { key: 'width', label: 'Width', kind: 'number', min: 0.05, max: 0.4, ...M },
    { key: 'rotation', label: 'Rotation', kind: 'number', ...DEG },
  ],
  strap: [
    { key: 'from', label: 'From', kind: 'landmark' },
    { key: 'to', label: 'To', kind: 'landmark' },
    { key: 'sag', label: 'Sag', kind: 'number', min: 0, max: 0.2, ...M },
  ],
  wall: [
    { key: 'x', label: 'Distance', kind: 'number', min: -2, max: 2, ...M },
    { key: 'facing', label: 'Facing', kind: 'choice', choices: ['left', 'right'] },
  ],
  surfboard: [
    { key: 'rotation', label: 'Nose pitch', kind: 'number', min: -45, max: 45, unit: '°' },
    { key: 'length', label: 'Length', kind: 'number', min: 0.6, max: 2.2, ...M },
    { key: 'thickness', label: 'Thickness', kind: 'number', min: 0.005, max: 0.08, ...M },
  ],
  wave: [
    { key: 'amplitude', label: 'Height', kind: 'number', min: 0.05, max: 1.5, ...M },
    { key: 'length', label: 'Length', kind: 'number', min: 0.5, max: 8, ...M },
    { key: 'y', label: 'Level', kind: 'number', min: -1, max: 1, ...M },
    { key: 'facing', label: 'Facing', kind: 'choice', choices: ['left', 'right'] },
    { key: 'breaking', label: 'Breaking', kind: 'boolean' },
  ],
};

/**
 * A new prop arrives fully specified, with every number filled in - because the
 * schema already knows what a yoga mat is, and there is no reason to make
 * someone invent its width. These ARE the schema's defaults, read straight out
 * of it: one source of truth, so a default can never be right in the parser and
 * wrong in the editor.
 */
const ANCHORS: Partial<Record<PropType, Record<string, unknown>>> = {
  block: { at: 'handTipL' },
  strap: { from: 'handTipL', to: 'toeL' },
  surfboard: { under: ['ankleL', 'ankleR'] },
};

export const newProp = (type: PropType): PropInput => propSchema.parse({ type, ...(ANCHORS[type] ?? {}) });

/**
 * What to SHOW for a prop. A pose file leaves out anything it is happy to take
 * the default for - `- type: mat` is a whole, valid, 1.35-long yoga mat - so the
 * panel displays the prop as the schema resolves it, not as the YAML spells it.
 * Otherwise every unwritten field would read 0, which is not a default: it is a
 * lie about the object on the floor.
 */
const resolved = (prop: PropInput): Record<string, unknown> => {
  const parsed = propSchema.safeParse(prop);
  return { ...prop, ...(parsed.success ? parsed.data : {}) };
};

/** Every control reports whether the finger is still down, so a drag is ONE undo step. */
type Change = (value: unknown, transient: boolean) => void;

const PointControl = ({ value, onChange }: { value: unknown; onChange: Change }): JSX.Element => {
  const point = Array.isArray(value) ? (value as number[]) : [0, 0];
  const axis = (i: number, label: string): JSX.Element => (
    <SliderRow
      label={label}
      value={point[i] ?? 0}
      min={-1}
      max={1}
      unit=""
      onChange={(v, transient) => onChange(point.map((p, j) => (j === i ? v : p)), transient)}
      onCommit={commitGesture}
    />
  );
  return (
    <>
      {axis(0, 'Across (x)')}
      {axis(1, 'Along (z)')}
    </>
  );
};

const FieldControl = ({ field, value, onChange }: { field: Field; value: unknown; onChange: Change }): JSX.Element => {
  if (field.kind === 'point') return <PointControl value={value} onChange={onChange} />;

  if (field.kind === 'boolean') {
    return (
      <label class="check-row">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange((e.target as HTMLInputElement).checked, false)}
        />
        {field.label}
      </label>
    );
  }

  if (field.kind === 'landmark' || field.kind === 'choice') {
    const options = field.kind === 'landmark' ? LANDMARK_IDS : (field.choices ?? []);
    return (
      <div class="field">
        <label>{field.label}</label>
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange((e.target as HTMLSelectElement).value, false)}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <SliderRow
      label={field.label}
      value={typeof value === 'number' ? value : 0}
      min={field.min ?? 0}
      max={field.max ?? 1}
      unit={field.unit ?? ''}
      onChange={onChange}
      onCommit={commitGesture}
    />
  );
};

/** Mats, blocks, straps, walls, boards and waves around the figure. */
export const PropsPanel = (): JSX.Element => {
  const props = pose.value.props ?? [];

  const update = (index: number, patch: Record<string, unknown>, transient: boolean): void => {
    dispatch(
      { type: 'set-props', props: props.map((p, i) => (i === index ? { ...p, ...patch } : p)) },
      { transient },
    );
  };

  const remove = (index: number): void => {
    dispatch({ type: 'set-props', props: props.filter((_, i) => i !== index) });
  };

  const add = (type: PropType): void => {
    dispatch({ type: 'set-props', props: [...props, newProp(type)] });
  };

  return (
    <div>
      {props.length === 0 && (
        <p class="panel-hint">No props yet. A mat grounds a yoga pose; a board and a wave make a surf one.</p>
      )}
      {props.map((prop, i) => {
        const shown = resolved(prop);
        return (
          <div key={`${prop.type}-${i}`} class="prop-card">
            <div class="prop-head">
              <label>{prop.type}</label>
              <button class="btn subtle danger" onClick={() => remove(i)}>
                Remove
              </button>
            </div>
            {PROP_FIELDS[prop.type].map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                value={shown[field.key]}
                onChange={(v, transient) => update(i, { [field.key]: v }, transient)}
              />
            ))}
          </div>
        );
      })}
      <div class="field">
        <label>Add a prop</label>
        <div class="chips" style="flex-wrap:wrap">
          {(Object.keys(PROP_FIELDS) as PropType[]).map((type) => (
            <button key={type} class="chip" onClick={() => add(type)}>
              + {type}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
