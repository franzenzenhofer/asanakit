import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { CAMERA_PRESETS, CAMERA_PRESET_IDS, resolveCamera } from '@asanakit/core/camera.js';
import { history, pose, redoEdit, selectedBone, undoEdit, view } from '../state/doc.js';
import { snap, stageBottom, trackViewport } from '../state/layout.js';
import { Canvas2d } from './canvas2d.js';
import { Canvas3d } from './canvas3d.js';
import { ExportMenu } from './export-menu.js';
import { JointPanel } from './joint-panel.js';
import { LintChips } from './lint-chips.js';
import { MetaPanel } from './meta-panel.js';
import { MusclesPanel } from './muscles-panel.js';
import { PosePanel } from './pose-panel.js';
import { PropsPanel } from './props-panel.js';
import { Sheet } from '../ui/sheet.js';
import { CubeIcon, FlatIcon, MoreIcon, RedoIcon, UndoIcon } from '../ui/icons.js';

type Tab = 'joints' | 'pose' | 'props' | 'body' | 'info';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'joints', label: 'Joints' },
  { id: 'pose', label: 'Figure' },
  { id: 'props', label: 'Props' },
  { id: 'body', label: 'Body' },
  { id: 'info', label: 'Info' },
];

const EditorTopbar = ({ onMenu }: { onMenu: () => void }): JSX.Element => (
  <header class="topbar">
    <h1>{pose.value.name ?? 'My Asana'}</h1>
    <button class="iconbtn" onClick={undoEdit} disabled={history.value.past.length === 0} aria-label="Undo">
      <UndoIcon />
    </button>
    <button class="iconbtn" onClick={redoEdit} disabled={history.value.future.length === 0} aria-label="Redo">
      <RedoIcon />
    </button>
    <button class="iconbtn" onClick={onMenu} aria-label="Save and export">
      <MoreIcon />
    </button>
  </header>
);

/**
 * Two views, and you can see which one you are in. 2D is the print - the drawing
 * that comes out of the printer, held still at whatever angle you composed it.
 * 3D is where you go to find that angle.
 */
const ViewToggle = (): JSX.Element => (
  <div class="canvas-fab">
    <div class="segmented view-toggle" role="tablist" aria-label="View">
      <button
        role="tab"
        aria-selected={view.value === '2d'}
        class={view.value === '2d' ? 'active' : ''}
        onClick={() => (view.value = '2d')}
      >
        <FlatIcon />
        <span>2D</span>
      </button>
      <button
        role="tab"
        aria-selected={view.value === '3d'}
        class={view.value === '3d' ? 'active' : ''}
        onClick={() => (view.value = '3d')}
      >
        <CubeIcon />
        <span>3D</span>
      </button>
    </div>
  </div>
);

/**
 * Where the camera is. It is the same camera in both views, so it is worth
 * saying out loud. Tap it to open the camera controls.
 */
const CameraReadout = ({ onOpen }: { onOpen: () => void }): JSX.Element => {
  const camera = resolveCamera(pose.value.camera ?? 'front');
  const preset = CAMERA_PRESET_IDS.find((id) => {
    const p = CAMERA_PRESETS[id];
    return p.azimuth === camera.azimuth && p.elevation === camera.elevation && p.roll === camera.roll;
  });
  return (
    <button class="angle-readout" onClick={onOpen} aria-label="Camera angle - tap to change">
      {preset ?? `${camera.azimuth}° / ${camera.elevation}°`}
    </button>
  );
};

/**
 * The editing surface, built around one rule: you can always see the figure you
 * are editing. The canvas owns the screen; the tool sheet floats over it,
 * see-through, and the figure is drawn into the space the sheet is not using.
 */
export const EditorPage = (): JSX.Element => {
  const [tab, setTab] = useState<Tab>('joints');
  const [menuOpen, setMenuOpen] = useState(false);
  const bone = selectedBone.value;

  useEffect(trackViewport, []);

  useEffect(() => {
    if (bone === null) return;
    setTab('joints');
    if (snap.value === 'peek') snap.value = 'half';
  }, [bone]);

  const pick = (next: Tab): void => {
    if (tab === next && snap.value !== 'peek') snap.value = 'peek';
    else if (snap.value === 'peek') snap.value = 'half';
    setTab(next);
  };

  return (
    <div class="editor">
      <EditorTopbar onMenu={() => setMenuOpen(true)} />

      <div class="canvas-wrap" style={`--stage-bottom:${stageBottom.value}px`}>
        {/* The chrome lives on the STAGE, not the wrapper, so it follows the figure
            into whatever room the sheet has left it - and never hides beneath it. */}
        <div class="canvas-stage">
          {view.value === '2d' ? <Canvas2d /> : <Canvas3d />}
          <LintChips />
          <ViewToggle />
          <CameraReadout
            onOpen={() => {
              setTab('pose');
              if (snap.value === 'peek') snap.value = 'half';
            }}
          />
        </div>

        <Sheet label="Editing tools">
          <div class="panel-tabs">
            <div class="chips tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  class={`chip ${tab === t.id && snap.value !== 'peek' ? 'active' : ''}`}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => pick(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div class="panel-body">
            {tab === 'joints' && <JointPanel />}
            {tab === 'pose' && <PosePanel />}
            {tab === 'props' && <PropsPanel />}
            {tab === 'body' && <MusclesPanel />}
            {tab === 'info' && <MetaPanel />}
          </div>
        </Sheet>
      </div>

      {menuOpen && <ExportMenu onClose={() => setMenuOpen(false)} />}
    </div>
  );
};
