import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { DEFAULT_RIG } from '@asanakit/core/rig.js';
import { solveSkeleton } from '@asanakit/core/skeleton.js';
import { resolveFigure } from '@asanakit/model/index.js';
import { parsed } from '../state/preview.js';
import type { ViewerHandle } from '../three/viewer.js';

/** Lazy 3D orbit view: three.js loads only when someone actually opens it. */
export const Canvas3d = (): JSX.Element => {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<ViewerHandle | null>(null);
  const [ready, setReady] = useState(false);
  const spec = parsed.value.spec;

  useEffect(() => {
    let cancelled = false;
    void import('../three/viewer.js').then(({ createViewer }): void => {
      if (cancelled || host.current === null) return;
      handle.current = createViewer(host.current);
      setReady(true);
    });
    return (): void => {
      cancelled = true;
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || handle.current === null || spec === undefined) return;
    try {
      const skeleton = solveSkeleton(resolveFigure(spec.figure), DEFAULT_RIG);
      handle.current.setFigure(skeleton, spec.muscles.engaged, spec.muscles.stretched, spec.props);
    } catch (error) {
      console.error('[asanakit] 3d solve failed', error);
    }
  }, [ready, spec]);

  return <div class="canvas3d" ref={host} aria-label="3D view - drag to orbit, pinch to zoom" />;
};
