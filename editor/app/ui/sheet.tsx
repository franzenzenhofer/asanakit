import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren, JSX } from 'preact';
import { adjusting, sheetHeight, snap, SNAP_FRACTION, viewportHeight, type Snap } from '../state/layout.js';

const ORDER: readonly Snap[] = ['peek', 'half', 'full'];

/** Past this much of a drag, snap to the next detent rather than back. */
const SNAP_TRAVEL = 0.12;

const nextSnap = (from: Snap, dragFraction: number): Snap => {
  if (Math.abs(dragFraction) < SNAP_TRAVEL) return from;
  const i = ORDER.indexOf(from);
  // Dragging DOWN grows dragFraction and should close the sheet.
  const step = dragFraction > 0 ? -1 : 1;
  return ORDER[Math.max(0, Math.min(ORDER.length - 1, i + step))] as Snap;
};

interface DragState {
  readonly startY: number;
  readonly from: Snap;
  fraction: number;
}

/**
 * The tool sheet: it floats over the canvas, it is see-through, and you drag
 * its handle between three heights. It never takes the figure away - while a
 * control is being dragged it fades further, so you watch the body move under
 * your own thumb.
 */
export const Sheet = ({ children, label }: { children: ComponentChildren; label: string }): JSX.Element => {
  const host = useRef<HTMLElement>(null);
  const drag = useRef<DragState | null>(null);

  // The stage needs the sheet's REAL height, not the height we asked for.
  useEffect(() => {
    const el = host.current;
    if (el === null) return;
    const observer = new ResizeObserver(() => (sheetHeight.value = el.getBoundingClientRect().height));
    observer.observe(el);
    return (): void => observer.disconnect();
  }, []);

  const onPointerDown = (event: JSX.TargetedPointerEvent<HTMLElement>): void => {
    drag.current = { startY: event.clientY, from: snap.value, fraction: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: JSX.TargetedPointerEvent<HTMLElement>): void => {
    const state = drag.current;
    if (state === null) return;
    state.fraction = (event.clientY - state.startY) / viewportHeight.value;
    const target = SNAP_FRACTION[state.from] - state.fraction;
    // Follow the finger live, between the outer detents.
    host.current?.style.setProperty(
      '--sheet-h',
      `${Math.max(0, Math.min(SNAP_FRACTION.full, target)) * 100}dvh`,
    );
  };

  const onPointerUp = (): void => {
    const state = drag.current;
    drag.current = null;
    host.current?.style.removeProperty('--sheet-h');
    if (state === null) return;
    snap.value = nextSnap(state.from, state.fraction);
  };

  const cycle = (): void => {
    snap.value = snap.value === 'full' ? 'peek' : snap.value === 'peek' ? 'half' : 'full';
  };

  return (
    <section
      ref={host}
      class={`panel snap-${snap.value} ${adjusting.value ? 'adjusting' : ''}`}
      aria-label={label}
    >
      <div
        class="panel-grabber"
        role="button"
        tabIndex={0}
        aria-label={`Tool sheet, ${snap.value}. Drag to resize.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={cycle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') cycle();
        }}
      >
        <span class="grabber" />
      </div>
      {children}
    </section>
  );
};
