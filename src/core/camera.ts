/**
 * A camera is an orbit around the figure: azimuth walks around it, elevation
 * climbs above it, roll tilts the picture. Azimuth 0 looks at the figure's
 * front, positive azimuth walks toward the figure's LEFT (so `left` shows the
 * figure's left side); elevation 90 looks straight down.
 */
export interface CameraAngles {
  readonly azimuth: number;
  readonly elevation: number;
  readonly roll: number;
}

/**
 * A dead-on profile is a trap: the far arm and the far leg hide EXACTLY behind
 * the near ones, and the drawing loses half the body. So the side views are
 * cheated a few degrees off square - the way an aircraft three-view is drawn -
 * and the far side peeks out beside the near side instead of vanishing into it.
 */
const CHEAT = 6;

export const CAMERA_PRESETS = {
  front: { azimuth: 0, elevation: 0, roll: 0 },
  back: { azimuth: 180, elevation: 0, roll: 0 },
  /** The figure's LEFT side toward you - its gray limbs near, its dark ones peeking past. */
  left: { azimuth: 90 - CHEAT, elevation: 0, roll: 0 },
  /** The figure's RIGHT side toward you: the classic profile of a yoga diagram. */
  right: { azimuth: -90 + CHEAT, elevation: 0, roll: 0 },
  /** What most poses ask for, and it is the right-side profile. */
  side: { azimuth: -90 + CHEAT, elevation: 0, roll: 0 },
  'three-quarter': { azimuth: -45, elevation: 10, roll: 0 },
  top: { azimuth: 0, elevation: 90, roll: 0 },
  bottom: { azimuth: 0, elevation: -90, roll: 0 },
} as const satisfies Record<string, CameraAngles>;

export type CameraPresetId = keyof typeof CAMERA_PRESETS;

export const CAMERA_PRESET_IDS = Object.keys(CAMERA_PRESETS) as readonly CameraPresetId[];

/** What a pose file or a CLI flag may say about the camera. */
export type CameraInput = CameraPresetId | { [K in keyof CameraAngles]?: number | undefined };

export const isCameraPresetId = (value: string): value is CameraPresetId => value in CAMERA_PRESETS;

export const resolveCamera = (input?: CameraInput): CameraAngles => {
  if (input === undefined) return CAMERA_PRESETS.front;
  if (typeof input === 'string') return CAMERA_PRESETS[input];
  return { azimuth: input.azimuth ?? 0, elevation: input.elevation ?? 0, roll: input.roll ?? 0 };
};
