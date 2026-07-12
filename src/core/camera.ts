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

export const CAMERA_PRESETS = {
  front: { azimuth: 0, elevation: 0, roll: 0 },
  back: { azimuth: 180, elevation: 0, roll: 0 },
  left: { azimuth: 90, elevation: 0, roll: 0 },
  right: { azimuth: -90, elevation: 0, roll: 0 },
  /** The classic profile of a yoga diagram: the figure faces picture-right. */
  side: { azimuth: -90, elevation: 0, roll: 0 },
  'three-quarter': { azimuth: -45, elevation: 10, roll: 0 },
  top: { azimuth: 0, elevation: 90, roll: 0 },
} as const satisfies Record<string, CameraAngles>;

export type CameraPresetId = keyof typeof CAMERA_PRESETS;

export const CAMERA_PRESET_IDS = Object.keys(CAMERA_PRESETS) as readonly CameraPresetId[];

/** What a pose file or a CLI flag may say about the camera. */
export type CameraInput = CameraPresetId | Partial<CameraAngles>;

export const isCameraPresetId = (value: string): value is CameraPresetId => value in CAMERA_PRESETS;

export const resolveCamera = (input?: CameraInput): CameraAngles => {
  if (input === undefined) return CAMERA_PRESETS.front;
  if (typeof input === 'string') return CAMERA_PRESETS[input];
  return { azimuth: input.azimuth ?? 0, elevation: input.elevation ?? 0, roll: input.roll ?? 0 };
};
