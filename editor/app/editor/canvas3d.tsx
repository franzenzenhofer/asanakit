import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { resolveCamera } from '@asanakit/core/camera.js';
import { DEFAULT_RIG } from '@asanakit/core/rig.js';
import { solveSkeleton } from '@asanakit/core/skeleton.js';
import { resolveFigure } from '@asanakit/model/index.js';
import { commitGesture, dispatch, pose, selectedBone } from '../state/doc.js';
import { parsed } from '../state/preview.js';
import type { ViewerHandle } from '../three/viewer.js';

/**
 * The 3D posing surface. There is ONE camera in this app: orbiting here writes
 * the pose's own camera, which is the camera every 2D drawing and every export
 * is projected through. Turn the figure in 3D, flip to 2D, and you are looking
 * at it from exactly where you left off - the viewpoint is never lost in the
 * switch, and a pose can be presented from three-quarters, or slightly from
 * above, simply by putting the camera there.
 */
export const Canvas3d = (): JSX.Element => {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<ViewerHandle | null>(null);
  const [ready, setReady] = useState(false);
  const spec = parsed.value.spec;
  const camera = resolveCamera(pose.value.camera ?? 'front');

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
          onOrbit: (angles) =>
            dispatch(
              { type: 'set-camera', camera: { ...angles, roll: resolveCamera(pose.peek().camera ?? 'front').roll } },
              { transient: true },
            ),
          onOrbitEnd: commitGesture,
        },
        resolveCamera(pose.peek().camera ?? 'front'),
      );
      handle.current.setSelected(selectedBone.value);
      handle.current.setRoll(resolveCamera(pose.peek().camera ?? 'front').roll);
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

  // The other direction: a camera edited in 2D (a slider, a preset) moves the
  // orbit. Only when it actually differs, so the orbit never fights the finger.
  useEffect(() => {
    const viewer = handle.current;
    if (!ready || viewer === null) return;
    const now = viewer.getAngles();
    if (now.azimuth !== camera.azimuth || now.elevation !== camera.elevation) {
      viewer.setAngles(camera);
    }
    viewer.setRoll(camera.roll);
  }, [ready, camera.azimuth, camera.elevation, camera.roll]);

  const bone = selectedBone.value;
  useEffect(() => {
    handle.current?.setSelected(bone);
  }, [bone, ready]);

  return <div class="canvas3d" ref={host} aria-label="3D view - drag a limb to pose it, drag empty space to turn the camera" />;
};
