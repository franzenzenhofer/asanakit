import type { JSX } from 'preact';
import { CAMERA_PRESET_IDS } from '@asanakit/core/camera.js';
import { STYLE_IDS, STYLES } from '@asanakit/render/styles.js';
import { commitGesture, dispatch, pose, styleId } from '../state/doc.js';
import type { RootField } from '../state/actions.js';
import { SliderRow } from '../ui/slider-row.js';

const ROOT_FIELDS: readonly { field: RootField; label: string }[] = [
  { field: 'yaw', label: 'Yaw' },
  { field: 'pitch', label: 'Pitch' },
  { field: 'roll', label: 'Roll' },
];

/** Whole-figure placement, viewpoint and render style. */
export const PosePanel = (): JSX.Element => {
  const doc = pose.value;
  const root = doc.figure?.root ?? {};
  const camera = typeof doc.camera === 'string' ? doc.camera : 'custom';

  return (
    <div>
      <div class="field">
        <label>Whole figure</label>
        {ROOT_FIELDS.map(({ field, label }) => (
          <SliderRow
            key={field}
            label={label}
            value={root[field] ?? 0}
            min={-180}
            max={180}
            onChange={(value, transient) => dispatch({ type: 'set-root', field, value }, { transient })}
            onCommit={commitGesture}
          />
        ))}
      </div>

      <div class="field">
        <label>Camera</label>
        <div class="segmented" role="tablist" aria-label="Camera">
          {(CAMERA_PRESET_IDS).map((preset) => (
            <button
              key={preset}
              class={camera === preset ? 'active' : ''}
              onClick={() => dispatch({ type: 'set-camera', camera: preset })}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div class="field">
        <label>Style</label>
        <div class="segmented" role="tablist" aria-label="Style">
          {STYLE_IDS.map((id) => (
            <button key={id} class={styleId.value === id ? 'active' : ''} onClick={() => (styleId.value = id)}>
              {STYLES[id].label}
            </button>
          ))}
        </div>
      </div>

      <div class="field">
        <label>Mirror</label>
        <button class="btn" style="align-self:flex-start" onClick={() => dispatch({ type: 'toggle-mirror' })}>
          {doc.figure?.mirror === true ? 'Mirrored - tap to restore' : 'Mirror left ↔ right'}
        </button>
      </div>
    </div>
  );
};
