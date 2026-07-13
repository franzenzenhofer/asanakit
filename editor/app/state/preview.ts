import { computed } from '@preact/signals';
import { validatePose, type Issue } from '@asanakit/anatomy/validate.js';
import type { PoseSpec } from '@asanakit/model/index.js';
import { renderSvg } from '@asanakit/render/scene.js';
import { pose, styleId, styleOverride } from './doc.js';
import { validateInput } from './serialize.js';

export interface Parsed {
  readonly spec?: PoseSpec;
  readonly errors: readonly string[];
}

/** doc -> schema -> svg -> anatomy issues, each layer memoized by signals. */
export const parsed = computed<Parsed>(() => validateInput(pose.value));

export const previewSvg = computed<string>(() => {
  const { spec } = parsed.value;
  if (spec === undefined) return '';
  try {
    return renderSvg(
      { ...spec, physics: 'none' },
      { style: styleId.value, styleOverride: styleOverride(), width: 600, height: 720, background: 'none' },
    );
  } catch (error) {
    console.error('[asanakit] render failed', error);
    return '';
  }
});

export const issues = computed<readonly Issue[]>(() => {
  const { spec } = parsed.value;
  if (spec === undefined) return [];
  try {
    return validatePose({ ...spec, physics: 'none' });
  } catch (error) {
    console.error('[asanakit] validate failed', error);
    return [];
  }
});
