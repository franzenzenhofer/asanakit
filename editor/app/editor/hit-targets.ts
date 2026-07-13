import type { BoneId } from '@asanakit/core/types.js';
import { BONE_IDS } from '@asanakit/core/types.js';

const isBoneId = (value: string): value is BoneId => (BONE_IDS as readonly string[]).includes(value);

/**
 * Bone strokes are thin; clone each one as a fat transparent stroke so a
 * fingertip can select it. Repeated taps in the same spot cycle through
 * overlapping bones (a folded pose stacks several under one finger).
 */
export const attachHitTargets = (svg: SVGSVGElement): void => {
  for (const line of [...svg.querySelectorAll<SVGElement>('[data-bone]')]) {
    if (line.classList.contains('bone-hit')) continue;
    const hit = line.cloneNode(false) as SVGElement;
    hit.classList.add('bone-hit');
    hit.removeAttribute('style');
    // Screen-space stroke width: a fingertip-sized target no matter how the viewBox scales down.
    hit.setAttribute('vector-effect', 'non-scaling-stroke');
    line.parentNode?.insertBefore(hit, line.nextSibling);
  }
};

export const markSelected = (svg: SVGSVGElement, bone: BoneId | null): void => {
  for (const line of [...svg.querySelectorAll<SVGElement>('[data-bone]')]) {
    const mine = bone !== null && line.getAttribute('data-bone') === bone && !line.classList.contains('bone-hit');
    line.classList.toggle('bone-selected', mine);
  }
};

export const boneAtPoint = (lastHit: BoneId | null, x: number, y: number, svg: SVGSVGElement): BoneId | null => {
  const candidates = document
    .elementsFromPoint(x, y)
    .filter((el): el is SVGElement => el instanceof SVGElement && el.hasAttribute('data-bone') && svg.contains(el))
    .map((el) => el.getAttribute('data-bone') ?? '')
    .filter(isBoneId);
  const unique = [...new Set(candidates)];
  if (unique.length === 0) return null;
  // Tap again on the same stack: cycle to the next bone underneath.
  const index = lastHit === null ? -1 : unique.indexOf(lastHit);
  return unique[(index + 1) % unique.length] ?? null;
};
