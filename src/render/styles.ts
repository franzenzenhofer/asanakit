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
    /** Left-side bones take this stroke, so a profile tells left from right. */
    readonly strokeLeft: string;
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
    /**
     * Which way is the figure looking? The convention of hand-drawn asana
     * notation: a nose mark - a dot when the face is toward you, sliding to
     * the rim as the head turns - and a shade over the back of the skull that
     * grows as the face turns away. Never a face.
     */
    readonly nose: 'dot' | 'none';
    readonly noseRadius: number;
    readonly shade: string;
    readonly shadeOpacity: number;
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
    /** The front edge of the mat, so a printout says which way the practice faces. */
    readonly accent: string;
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
    strokeLeft: '#6b6b6b',
    strokeWidth: 0.022,
    lineCap: 'round',
    joints: 'dots',
    jointRadius: 0.014,
    torsoWidth: 0,
    fill: 'none',
    farOpacity: 0.45,
  },
  head: {
    shape: 'ellipse',
    rx: 0.046,
    ry: 0.062,
    fill: '#ffffff',
    stroke: '#111111',
    strokeWidth: 0.02,
    nose: 'dot',
    noseRadius: 0.011,
    shade: '#111111',
    shadeOpacity: 0.16,
  },
  muscles: {
    show: false,
    base: '#e6ded6',
    opacity: 1,
    engaged: '#d1495b',
    stretched: '#2a7fb8',
    outline: '#00000000',
    outlineWidth: 0,
  },
  props: { stroke: '#111111', fill: '#f0f0f0', strokeWidth: 0.008, accent: '#c1121f' },
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
  figure: { ...stick.figure, stroke: '#3d3d3d', strokeLeft: '#8f8f8f', strokeWidth: 0.012, joints: 'dots', jointRadius: 0.009 },
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
    strokeLeft: '#4d4d4d',
    strokeWidth: 0.062,
    joints: 'none',
    jointRadius: 0,
    torsoWidth: 0.075,
    fill: '#111111',
  },
  // A filled silhouette cannot shade its own skull: the nose mark carries the facing alone,
  // in the ink of the background, the way a cut-paper figure would.
  head: {
    ...stick.head,
    rx: 0.05,
    ry: 0.066,
    fill: '#111111',
    stroke: '#111111',
    strokeWidth: 0.01,
    shade: '#ffffff',
    shadeOpacity: 0.22,
    noseRadius: 0.012,
  },
};

const blueprint: Style = {
  ...stick,
  id: 'blueprint',
  label: 'Blueprint',
  background: '#f3f7fb',
  figure: { ...stick.figure, stroke: '#1b3a5c', strokeLeft: '#7591b3', strokeWidth: 0.012, jointRadius: 0.01 },
  head: {
    ...stick.head,
    shape: 'circle',
    rx: 0.05,
    ry: 0.05,
    fill: 'none',
    stroke: '#1b3a5c',
    strokeWidth: 0.012,
    shade: '#1b3a5c',
    shadeOpacity: 0.12,
  },
  props: { stroke: '#1b3a5c', fill: '#e2ecf5', strokeWidth: 0.006, accent: '#c1121f' },
  annotation: { ...stick.annotation, stroke: '#c1121f', accent: '#c1121f', color: '#1b3a5c', strokeWidth: 0.004 },
  text: { ...stick.text, color: '#1b3a5c', muted: '#5c7998' },
};

const ink: Style = {
  ...stick,
  id: 'ink',
  label: 'Brush ink',
  figure: { ...stick.figure, strokeLeft: '#5d5d5d', strokeWidth: 0.038, joints: 'none', jointRadius: 0, torsoWidth: 0.03 },
  head: { ...stick.head, rx: 0.05, ry: 0.064, strokeWidth: 0.032 },
};

const poster: Style = {
  ...stick,
  id: 'poster',
  label: 'Poster',
  background: '#fdf6ec',
  figure: { ...stick.figure, stroke: '#1d1d1b', strokeLeft: '#6e6e6a', strokeWidth: 0.03, torsoWidth: 0.05, jointRadius: 0.016 },
  head: { ...stick.head, fill: '#f4a259', stroke: '#1d1d1b', strokeWidth: 0.026, rx: 0.05, ry: 0.066, shadeOpacity: 0.22 },
  props: { stroke: '#1d1d1b', fill: '#8cb369', strokeWidth: 0.012, accent: '#bc4b51' },
  annotation: { ...stick.annotation, stroke: '#bc4b51', accent: '#bc4b51', color: '#1d1d1b' },
};

const minimal: Style = {
  ...stick,
  id: 'minimal',
  label: 'Minimal',
  figure: { ...stick.figure, stroke: '#9aa0a6', strokeLeft: '#c6cbd0', strokeWidth: 0.01, joints: 'none', jointRadius: 0 },
  head: { ...stick.head, stroke: '#9aa0a6', strokeWidth: 0.01, shade: '#9aa0a6', shadeOpacity: 0.18, noseRadius: 0.009 },
  props: { ...stick.props, stroke: '#9aa0a6', accent: '#9aa0a6' },
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
