import { computed, signal } from '@preact/signals';

/**
 * How much of the screen the tool sheet is claiming.
 *
 * On a phone the figure and the controls want the same pixels, and the figure
 * must win: you cannot pose what you cannot see. So the sheet floats OVER the
 * canvas rather than pushing it out of the way, and the canvas is told how far
 * up to draw - never further down than `MAX_STAGE_BITE`, so that even a
 * fully-open sheet leaves the figure somewhere to be.
 */
export type Snap = 'peek' | 'half' | 'full';

/** Fraction of the viewport each snap point claims. */
export const SNAP_FRACTION: Record<Snap, number> = {
  peek: 0,
  half: 0.5,
  full: 0.88,
};

/**
 * The most of the canvas the sheet is allowed to push the figure out of, even
 * when it is open all the way. Past this the sheet is simply see-through and
 * the figure stays where it is - better a figure behind glass than no figure.
 */
const MAX_STAGE_BITE = 0.45;

export const snap = signal<Snap>('half');

/** The sheet's height in pixels, measured, because dvh lies while the keyboard is up. */
export const sheetHeight = signal(0);

/** Viewport height, kept in a signal so the stage recomputes on rotate. */
export const viewportHeight = signal(typeof window === 'undefined' ? 800 : window.innerHeight);

/** True while a control is being dragged: the sheet fades so the figure reads through it. */
export const adjusting = signal(false);

/** How far up from the bottom the figure must be drawn. */
export const stageBottom = computed(() =>
  Math.min(sheetHeight.value, viewportHeight.value * MAX_STAGE_BITE),
);

export const trackViewport = (): (() => void) => {
  const measure = (): void => {
    viewportHeight.value = window.visualViewport?.height ?? window.innerHeight;
  };
  measure();
  window.addEventListener('resize', measure);
  window.visualViewport?.addEventListener('resize', measure);
  return (): void => {
    window.removeEventListener('resize', measure);
    window.visualViewport?.removeEventListener('resize', measure);
  };
};
