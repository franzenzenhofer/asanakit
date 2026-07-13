import { useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import { resolveCamera } from '@asanakit/core/camera.js';
import { commitGesture, dispatch, pose, selectedBone } from '../state/doc.js';
import { previewSvg } from '../state/preview.js';
import { attachHitTargets, boneAtPoint, markSelected } from './hit-targets.js';

/** Degrees of orbit per pixel dragged. A comfortable half-turn across a phone. */
const DEG_PER_PX = 0.5;
const DRAG_THRESHOLD_PX = 6;

const clampElevation = (value: number): number => Math.max(-90, Math.min(90, value));

interface Orbit {
  readonly startX: number;
  readonly startY: number;
  readonly azimuth: number;
  readonly elevation: number;
  moved: boolean;
}

/**
 * The live 2D projection. Tap a bone to select it; drag the empty space around
 * it to turn the camera - the same camera the 3D view orbits, and the same one
 * every export is drawn through. The two views differ in projection, never in
 * viewpoint.
 */
export const Canvas2d = (): JSX.Element => {
  const host = useRef<HTMLDivElement>(null);
  const orbit = useRef<Orbit | null>(null);
  const svg = previewSvg.value;
  const bone = selectedBone.value;

  useEffect(() => {
    const el = host.current;
    if (el === null) return;
    el.innerHTML = svg;
    const root = el.querySelector('svg');
    if (root === null) return;
    root.removeAttribute('width');
    root.removeAttribute('height');
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    attachHitTargets(root);
    markSelected(root, selectedBone.value);
  }, [svg]);

  useEffect(() => {
    const root = host.current?.querySelector('svg');
    if (root instanceof SVGSVGElement) markSelected(root, bone);
  }, [bone, svg]);

  const onPointerDown = (event: JSX.TargetedPointerEvent<HTMLDivElement>): void => {
    const root = host.current?.querySelector('svg');
    if (!(root instanceof SVGSVGElement)) return;

    const hit = boneAtPoint(selectedBone.value, event.clientX, event.clientY, root);
    if (hit !== null) {
      // A hit selects (repeat taps cycle stacked bones).
      selectedBone.value = hit;
      return;
    }

    // A miss starts an orbit; if the finger never moves, it clears the selection.
    const camera = resolveCamera(pose.peek().camera ?? 'front');
    orbit.current = {
      startX: event.clientX,
      startY: event.clientY,
      azimuth: camera.azimuth,
      elevation: camera.elevation,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: JSX.TargetedPointerEvent<HTMLDivElement>): void => {
    const start = orbit.current;
    if (start === null) return;
    const dx = event.clientX - start.startX;
    const dy = event.clientY - start.startY;
    if (!start.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    start.moved = true;

    // Drag right, the figure turns to follow your hand - the same way the orbit
    // reads in 3D, because it is the same camera.
    dispatch(
      {
        type: 'set-camera',
        camera: {
          azimuth: Math.round(start.azimuth - dx * DEG_PER_PX),
          elevation: Math.round(clampElevation(start.elevation + dy * DEG_PER_PX)),
          roll: resolveCamera(pose.peek().camera ?? 'front').roll,
        },
      },
      { transient: true },
    );
  };

  const onPointerUp = (): void => {
    const start = orbit.current;
    orbit.current = null;
    if (start === null) return;
    if (start.moved) commitGesture();
    else selectedBone.value = null;
  };

  return (
    <div
      class="canvas2d"
      ref={host}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
};
