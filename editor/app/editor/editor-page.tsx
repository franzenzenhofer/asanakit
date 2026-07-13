import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { CAMERA_PRESETS, CAMERA_PRESET_IDS, resolveCamera } from '@asanakit/core/camera.js';
import { history, pose, redoEdit, selectedBone, undoEdit, view } from '../state/doc.js';
import { Canvas2d } from './canvas2d.js';
import { Canvas3d } from './canvas3d.js';
import { ExportMenu } from './export-menu.js';
import { JointPanel } from './joint-panel.js';
import { LintChips } from './lint-chips.js';
import { MetaPanel } from './meta-panel.js';
import { MusclesPanel } from './muscles-panel.js';
import { PosePanel } from './pose-panel.js';
import { PropsPanel } from './props-panel.js';
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

const ViewToggle = (): JSX.Element => {
  const flat = view.value === '2d';
  return (
    <div class="canvas-fab">
      <button
        class="iconbtn labeled"
        onClick={() => (view.value = flat ? '3d' : '2d')}
        aria-label={flat ? 'Switch to 3D posing view' : 'Switch to 2D drawing'}
      >
        {flat ? <CubeIcon /> : <FlatIcon />}
        <span>{flat ? '3D' : '2D'}</span>
      </button>
    </div>
  );
};

/**
 * Where the camera is - the same camera in both views, so it is worth saying
 * out loud. Tap it to open the camera controls.
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
 * The editing surface. Space is the scarcest resource on a phone: the canvas
 * takes everything the collapsible tool panel does not currently claim, and
 * selecting a bone opens the Joints tab so the controls are always one tap away.
 */
export const EditorPage = (): JSX.Element => {
  const [tab, setTab] = useState<Tab>('joints');
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const bone = selectedBone.value;

  useEffect(() => {
    if (bone === null) return;
    setTab('joints');
    setPanelOpen(true);
  }, [bone]);

  const pick = (next: Tab): void => {
    setPanelOpen(tab === next ? !panelOpen : true);
    setTab(next);
  };

  return (
    <div class="editor">
      <div style="display:flex;flex-direction:column;flex:1;min-width:0;">
        <EditorTopbar onMenu={() => setMenuOpen(true)} />
        <div class="canvas-wrap">
          {view.value === '2d' ? <Canvas2d /> : <Canvas3d />}
          <LintChips />
          <ViewToggle />
          <CameraReadout
            onOpen={() => {
              setTab('pose');
              setPanelOpen(true);
            }}
          />
        </div>
      </div>

      <section class={`panel ${panelOpen ? '' : 'collapsed'}`} aria-label="Editing tools">
        <div class="panel-tabs">
          <button
            class="panel-grabber"
            onClick={() => setPanelOpen(!panelOpen)}
            aria-expanded={panelOpen}
            aria-label={panelOpen ? 'Collapse tool panel' : 'Expand tool panel'}
          >
            <span class="grabber" />
          </button>
          <div class="chips tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                class={`chip ${tab === t.id && panelOpen ? 'active' : ''}`}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => pick(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {panelOpen && (
          <div class="panel-body">
            {tab === 'joints' && <JointPanel />}
            {tab === 'pose' && <PosePanel />}
            {tab === 'props' && <PropsPanel />}
            {tab === 'body' && <MusclesPanel />}
            {tab === 'info' && <MetaPanel />}
          </div>
        )}
      </section>

      {menuOpen && <ExportMenu onClose={() => setMenuOpen(false)} />}
    </div>
  );
};
