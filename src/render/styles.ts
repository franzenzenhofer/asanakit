/**
 * Style tokens. Everything the renderer draws reads its geometry and colour
 * from here, so a new look is a data change, never a code change. All sizes are
 * in stature units (1.0 = figure height) and scale with the canvas.
 */
export interface Style {
  readonly id: string;
  readonly label: string;
  readonly background: string;
  readonly padding: number;
  readonly figure: {
    readonly stroke: string;
    readonly strokeWidth: number;
    readonly lineCap: 'round' | 'butt' | 'square';
    readonly joints: 'none' | 'dots';
    readonly jointRadius: number;
    readonly torsoWidth: number;
    readonly fill: string;
    readonly farOpacity: number;
  };
  readonly head: {
    readonly shape: 'ellipse' | 'circle' | 'none';
    readonly rx: number;
    readonly ry: number;
    readonly fill: string;
    readonly stroke: string;
    readonly strokeWidth: number;
  };
  readonly muscles: {
    readonly show: boolean;
    readonly base: string;
    readonly opacity: number;
    readonly engaged: string;
    readonly stretched: string;
    readonly outline: string;
    readonly outlineWidth: number;
  };
  readonly props: {
    readonly stroke: string;
    readonly fill: string;
    readonly strokeWidth: number;
  };
  readonly annotation: {
    readonly stroke: string;
    readonly strokeWidth: number;
    readonly accent: string;
    readonly color: string;
    readonly fontFamily: string;
    readonly fontSize: number;
    readonly dash: string;
  };
  readonly text: {
    readonly color: string;
    readonly muted: string;
    readonly fontFamily: string;
    readonly titleSize: number;
    readonly captionSize: number;
  };
}

export type StyleOverride = {
  readonly [K in keyof Style]?: Style[K] extends object ? Partial<Style[K]> : Style[K];
};

const SANS = 'Helvetica Neue, Helvetica, Arial, sans-serif';

const stick: Style = {
  id: 'stick',
  label: 'Stick figure',
  background: '#ffffff',
  padding: 0.12,
  figure: {
    stroke: '#111111',
    strokeWidth: 0.022,
    lineCap: 'round',
    joints: 'dots',
    jointRadius: 0.014,
    torsoWidth: 0,
    fill: 'none',
    farOpacity: 0.45,
  },
  head: { shape: 'ellipse', rx: 0.046, ry: 0.062, fill: '#ffffff', stroke: '#111111', strokeWidth: 0.02 },
  muscles: {
    show: false,
    base: '#e6ded6',
    opacity: 1,
    engaged: '#d1495b',
    stretched: '#2a7fb8',
    outline: '#00000000',
    outlineWidth: 0,
  },
  props: { stroke: '#111111', fill: '#f0f0f0', strokeWidth: 0.008 },
  annotation: {
    stroke: '#c1121f',
    strokeWidth: 0.005,
    accent: '#c1121f',
    color: '#c1121f',
    fontFamily: SANS,
    fontSize: 0.045,
    dash: '0.03 0.02',
  },
  text: { color: '#111111', muted: '#666666', fontFamily: SANS, titleSize: 0.075, captionSize: 0.042 },
};

const anatomy: Style = {
  ...stick,
  id: 'anatomy',
  label: 'Anatomical infographic',
  figure: { ...stick.figure, stroke: '#3d3d3d', strokeWidth: 0.012, joints: 'dots', jointRadius: 0.009 },
  head: { ...stick.head, fill: '#f5efe8', stroke: '#3d3d3d', strokeWidth: 0.012 },
  muscles: {
    show: true,
    base: '#e0cfc2',
    opacity: 0.95,
    engaged: '#d1495b',
    stretched: '#3d7ea6',
    outline: '#9c8574',
    outlineWidth: 0.003,
  },
};

const silhouette: Style = {
  ...stick,
  id: 'silhouette',
  label: 'Filled silhouette',
  figure: {
    ...stick.figure,
    stroke: '#111111',
    strokeWidth: 0.062,
    joints: 'none',
    jointRadius: 0,
    torsoWidth: 0.075,
    fill: '#111111',
  },
  head: { shape: 'ellipse', rx: 0.05, ry: 0.066, fill: '#111111', stroke: '#111111', strokeWidth: 0.01 },
};

const blueprint: Style = {
  ...stick,
  id: 'blueprint',
  label: 'Blueprint',
  background: '#f3f7fb',
  figure: { ...stick.figure, stroke: '#1b3a5c', strokeWidth: 0.012, jointRadius: 0.01 },
  head: { shape: 'circle', rx: 0.05, ry: 0.05, fill: 'none', stroke: '#1b3a5c', strokeWidth: 0.012 },
  props: { stroke: '#1b3a5c', fill: '#e2ecf5', strokeWidth: 0.006 },
  annotation: { ...stick.annotation, stroke: '#c1121f', accent: '#c1121f', color: '#1b3a5c', strokeWidth: 0.004 },
  text: { ...stick.text, color: '#1b3a5c', muted: '#5c7998' },
};

const ink: Style = {
  ...stick,
  id: 'ink',
  label: 'Brush ink',
  figure: { ...stick.figure, strokeWidth: 0.038, joints: 'none', jointRadius: 0, torsoWidth: 0.03 },
  head: { ...stick.head, rx: 0.05, ry: 0.064, strokeWidth: 0.032 },
};

const poster: Style = {
  ...stick,
  id: 'poster',
  label: 'Poster',
  background: '#fdf6ec',
  figure: { ...stick.figure, stroke: '#1d1d1b', strokeWidth: 0.03, torsoWidth: 0.05, jointRadius: 0.016 },
  head: { ...stick.head, fill: '#f4a259', stroke: '#1d1d1b', strokeWidth: 0.026, rx: 0.05, ry: 0.066 },
  props: { stroke: '#1d1d1b', fill: '#8cb369', strokeWidth: 0.012 },
  annotation: { ...stick.annotation, stroke: '#bc4b51', accent: '#bc4b51', color: '#1d1d1b' },
};

const minimal: Style = {
  ...stick,
  id: 'minimal',
  label: 'Minimal',
  figure: { ...stick.figure, stroke: '#9aa0a6', strokeWidth: 0.01, joints: 'none', jointRadius: 0 },
  head: { ...stick.head, stroke: '#9aa0a6', strokeWidth: 0.01 },
  annotation: { ...stick.annotation, stroke: '#9aa0a6', color: '#9aa0a6', accent: '#9aa0a6' },
};

export const STYLES = { stick, anatomy, silhouette, blueprint, ink, poster, minimal } as const;

export type StyleId = keyof typeof STYLES;

export const STYLE_IDS = Object.keys(STYLES) as StyleId[];

export const isStyleId = (value: string): value is StyleId => value in STYLES;

/** Merge a partial override one level deep - deep enough for the token tree, shallow enough to stay predictable. */
export const resolveStyle = (id: StyleId = 'stick', override: StyleOverride = {}): Style => {
  const base = STYLES[id];
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] =
      typeof value === 'object' && value !== null && typeof current === 'object' && current !== null
        ? { ...current, ...value }
        : value;
  }
  return merged as unknown as Style;
};
