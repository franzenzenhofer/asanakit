import { useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import { selectedBone } from '../state/doc.js';
import { previewSvg } from '../state/preview.js';
import { attachHitTargets, boneAtPoint, markSelected } from './hit-targets.js';

/** The live 2D projection: tap a bone to select it for editing. */
export const Canvas2d = (): JSX.Element => {
  const host = useRef<HTMLDivElement>(null);
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
    // A miss clears the selection; a hit selects (repeat taps cycle stacked bones).
    selectedBone.value = boneAtPoint(selectedBone.value, event.clientX, event.clientY, root);
  };

  return <div class="canvas2d" ref={host} onPointerDown={onPointerDown} />;
};
