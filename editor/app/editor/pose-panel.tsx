import type { JSX } from 'preact';
import { CAMERA_PRESETS, CAMERA_PRESET_IDS, resolveCamera, type CameraAngles } from '@asanakit/core/camera.js';
import { STYLE_IDS, STYLES } from '@asanakit/render/styles.js';
import { commitGesture, dispatch, pose, styleId } from '../state/doc.js';
import type { RootField } from '../state/actions.js';
import { SliderRow } from '../ui/slider-row.js';

const ROOT_FIELDS: readonly { field: RootField; label: string }[] = [
  { field: 'yaw', label: 'Yaw' },
  { field: 'pitch', label: 'Pitch' },
  { field: 'roll', label: 'Roll' },
];

const CAMERA_FIELDS = [
  { field: 'azimuth', label: 'Azimuth', min: -180, max: 180 },
  { field: 'elevation', label: 'Elevation', min: -90, max: 90 },
  { field: 'roll', label: 'Roll', min: -180, max: 180 },
] as const;

const sameAngles = (a: CameraAngles, b: CameraAngles): boolean =>
  a.azimuth === b.azimuth && a.elevation === b.elevation && a.roll === b.roll;

/** Whole-figure placement, viewpoint and render style. */
export const PosePanel = (): JSX.Element => {
  const doc = pose.value;
  const root = doc.figure?.root ?? {};
  const camera = resolveCamera(doc.camera ?? 'front');
  const activePreset = CAMERA_PRESET_IDS.find((id) => sameAngles(CAMERA_PRESETS[id], camera));

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
        <label>Camera - any angle, used by 2D and every export</label>
        <div class="segmented" role="tablist" aria-label="Camera preset">
          {CAMERA_PRESET_IDS.map((preset) => (
            <button
              key={preset}
              class={activePreset === preset ? 'active' : ''}
              onClick={() => dispatch({ type: 'set-camera', camera: preset })}
            >
              {preset}
            </button>
          ))}
        </div>
        {CAMERA_FIELDS.map(({ field, label, min, max }) => (
          <SliderRow
            key={field}
            label={label}
            value={camera[field]}
            min={min}
            max={max}
            onChange={(value, transient) =>
              dispatch({ type: 'set-camera', camera: { ...camera, [field]: value } }, { transient })
            }
            onCommit={commitGesture}
          />
        ))}
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
