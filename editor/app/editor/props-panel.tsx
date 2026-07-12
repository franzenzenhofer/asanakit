import type { JSX } from 'preact';
import { LANDMARK_IDS } from '@asanakit/core/types.js';
import type { PoseSpecInput } from '@asanakit/model/index.js';
import { dispatch, pose } from '../state/doc.js';

type PropInput = NonNullable<PoseSpecInput['props']>[number];
type PropType = PropInput['type'];

interface Field {
  readonly key: string;
  readonly label: string;
  readonly kind: 'number' | 'landmark' | 'boolean' | 'choice';
  readonly choices?: readonly string[];
  readonly step?: number;
}

/** Which knobs each prop exposes - data, not code branches. */
const PROP_FIELDS: Record<PropType, readonly Field[]> = {
  ground: [{ key: 'width', label: 'Width', kind: 'number', step: 0.1 }],
  mat: [
    { key: 'yaw', label: 'Yaw°', kind: 'number', step: 15 },
    { key: 'length', label: 'Length', kind: 'number', step: 0.05 },
    { key: 'width', label: 'Width', kind: 'number', step: 0.02 },
  ],
  block: [
    { key: 'at', label: 'Under', kind: 'landmark' },
    { key: 'height', label: 'Height', kind: 'number', step: 0.02 },
    { key: 'rotation', label: 'Rotation°', kind: 'number', step: 5 },
  ],
  strap: [
    { key: 'from', label: 'From', kind: 'landmark' },
    { key: 'to', label: 'To', kind: 'landmark' },
  ],
  wall: [
    { key: 'x', label: 'X', kind: 'number', step: 0.05 },
    { key: 'facing', label: 'Facing', kind: 'choice', choices: ['left', 'right'] },
  ],
  surfboard: [
    { key: 'rotation', label: 'Pitch°', kind: 'number', step: 1 },
    { key: 'length', label: 'Length', kind: 'number', step: 0.05 },
  ],
  wave: [
    { key: 'amplitude', label: 'Height', kind: 'number', step: 0.05 },
    { key: 'length', label: 'Length', kind: 'number', step: 0.2 },
    { key: 'y', label: 'Level', kind: 'number', step: 0.05 },
    { key: 'breaking', label: 'Breaking', kind: 'boolean' },
  ],
};

/** Sensible starting shape per prop type; the schema fills the rest. */
const NEW_PROP: Record<PropType, PropInput> = {
  ground: { type: 'ground' },
  mat: { type: 'mat' },
  block: { type: 'block', at: 'handTipL' },
  strap: { type: 'strap', from: 'handTipL', to: 'toeL' },
  wall: { type: 'wall' },
  surfboard: { type: 'surfboard', under: ['ankleL', 'ankleR'] },
  wave: { type: 'wave' },
};

const FieldControl = ({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }): JSX.Element => {
  if (field.kind === 'boolean') {
    return (
      <label style="display:flex;align-items:center;gap:6px;font-size:13px">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
        {field.label}
      </label>
    );
  }
  if (field.kind === 'landmark' || field.kind === 'choice') {
    const options = field.kind === 'landmark' ? LANDMARK_IDS : (field.choices ?? []);
    return (
      <div class="field" style="margin-bottom:0">
        <label>{field.label}</label>
        <select value={typeof value === 'string' ? value : ''} onChange={(e) => onChange((e.target as HTMLSelectElement).value)}>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div class="field" style="margin-bottom:0">
      <label>{field.label}</label>
      <input
        class="num"
        type="number"
        step={field.step ?? 0.05}
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => {
          const raw = (e.target as HTMLInputElement).value;
          onChange(raw === '' ? undefined : Number(raw));
        }}
      />
    </div>
  );
};

/** Mats, blocks, straps, walls, boards and waves around the figure. */
export const PropsPanel = (): JSX.Element => {
  const props = pose.value.props ?? [];

  const update = (index: number, patch: Record<string, unknown>): void => {
    const next = props.map((p, i) => (i === index ? ({ ...p, ...patch }) : p));
    dispatch({ type: 'set-props', props: next });
  };

  const remove = (index: number): void => {
    dispatch({ type: 'set-props', props: props.filter((_, i) => i !== index) });
  };

  const add = (type: PropType): void => {
    dispatch({ type: 'set-props', props: [...props, { ...NEW_PROP[type] }] });
  };

  return (
    <div>
      {props.length === 0 && (
        <p style="font-size:13px;color:var(--ink-faint);margin:0 0 10px">No props yet. A mat grounds a yoga pose; a board and a wave make a surf one.</p>
      )}
      {props.map((prop, i) => (
        <div key={`${prop.type}-${i}`} class="field" style="border:1px solid var(--line);border-radius:var(--radius);padding:10px">
          <div style="display:flex;align-items:center">
            <label style="flex:1;text-transform:capitalize">{prop.type}</label>
            <button class="btn subtle" style="color:var(--error);padding:2px 6px;min-height:0" onClick={() => remove(i)}>
              Remove
            </button>
          </div>
          <div class="field-row" style="flex-wrap:wrap;gap:8px">
            {PROP_FIELDS[prop.type].map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                value={(prop as unknown as Record<string, unknown>)[field.key]}
                onChange={(v) => update(i, { [field.key]: v })}
              />
            ))}
          </div>
        </div>
      ))}
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
