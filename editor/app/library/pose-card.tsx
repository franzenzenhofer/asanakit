import { useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';

export interface PoseCardProps {
  readonly name: string;
  readonly sub?: string;
  readonly svg: string;
  readonly onOpen: () => void;
}

/** A library card: figure, name, sanskrit. The figure sells the pose. */
export const PoseCard = ({ name, sub, svg, onOpen }: PoseCardProps): JSX.Element => {
  const thumb = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thumb.current !== null) thumb.current.innerHTML = svg;
  }, [svg]);

  return (
    <button class="pose-card" onClick={onOpen}>
      <span class="thumb" ref={thumb} aria-hidden="true" />
      <span class="name serif">{name}</span>
      <span class="sub">{sub ?? ''}</span>
    </button>
  );
};
