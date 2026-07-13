import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { resolveCamera } from '@asanakit/core/camera.js';
import { DEFAULT_RIG } from '@asanakit/core/rig.js';
import { solveSkeleton } from '@asanakit/core/skeleton.js';
import { resolveFigure } from '@asanakit/model/index.js';
import { commitGesture, dispatch, pose, selectedBone, view } from '../state/doc.js';
import { parsed } from '../state/preview.js';
import type { ViewerHandle } from '../three/viewer.js';
import { AngleIcon } from '../ui/icons.js';

/**
 * The 3D posing surface: three.js loads lazily, the orbit starts at the pose's
 * own camera, touching a bone selects it, dragging a bone aims the limb.
 */
export const Canvas3d = (): JSX.Element => {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<ViewerHandle | null>(null);
  const [ready, setReady] = useState(false);
  const spec = parsed.value.spec;

  useEffect(() => {
    let cancelled = false;
    void import('../three/viewer.js').then(({ createViewer }): void => {
      if (cancelled || host.current === null) return;
      handle.current = createViewer(
        host.current,
        {
          onSelect: (bone) => (selectedBone.value = bone),
          onAim: (bone, angles) => dispatch({ type: 'aim-bone', bone, ...angles }, { transient: true }),
          onAimEnd: commitGesture,
        },
        resolveCamera(pose.value.camera ?? 'front'),
      );
      handle.current.setSelected(selectedBone.value);
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

  const bone = selectedBone.value;
  useEffect(() => {
    handle.current?.setSelected(bone);
  }, [bone, ready]);

  const captureAngle = (): void => {
    if (handle.current === null) return;
    dispatch({ type: 'set-camera', camera: { ...handle.current.getAngles(), roll: 0 } });
    view.value = '2d'; // show the flat render this exact angle produces
  };

  return (
    <div class="canvas3d" ref={host} aria-label="3D view - drag a limb to pose it, drag empty space to orbit">
      <button class="angle-pill" onClick={captureAngle}>
        <AngleIcon /> Use this angle
      </button>
    </div>
  );
};
