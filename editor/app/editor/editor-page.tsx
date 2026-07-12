import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { history, pose, redoEdit, undoEdit, view } from '../state/doc.js';
import { Canvas2d } from './canvas2d.js';
import { Canvas3d } from './canvas3d.js';
import { ExportMenu } from './export-menu.js';
import { JointPanel } from './joint-panel.js';
import { LintChips } from './lint-chips.js';
import { MetaPanel } from './meta-panel.js';
import { MusclesPanel } from './muscles-panel.js';
import { PosePanel } from './pose-panel.js';
import { CubeIcon, FlatIcon, MoreIcon, RedoIcon, UndoIcon } from '../ui/icons.js';

type Tab = 'joints' | 'pose' | 'body' | 'info';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'joints', label: 'Joints' },
  { id: 'pose', label: 'Figure & view' },
  { id: 'body', label: 'Muscles & contact' },
  { id: 'info', label: 'Info' },
];

/** The editing surface: canvas on top, tool panel below (beside, on desktop). */
export const EditorPage = (): JSX.Element => {
  const [tab, setTab] = useState<Tab>('joints');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div class="editor">
      <div style="display:flex;flex-direction:column;flex:1;min-width:0;">
        <header class="topbar">
          <h1>{pose.value.name ?? 'My Asana'}</h1>
          <button class="iconbtn" onClick={undoEdit} disabled={history.value.past.length === 0} aria-label="Undo">
            <UndoIcon />
          </button>
          <button class="iconbtn" onClick={redoEdit} disabled={history.value.future.length === 0} aria-label="Redo">
            <RedoIcon />
          </button>
          <button class="iconbtn" onClick={() => setMenuOpen(true)} aria-label="Save and export">
            <MoreIcon />
          </button>
        </header>

        <div class="canvas-wrap">
          {view.value === '2d' ? <Canvas2d /> : <Canvas3d />}
          <LintChips />
          <div class="canvas-fab">
            <button
              class={`iconbtn ${view.value === '3d' ? 'active' : ''}`}
              onClick={() => (view.value = view.value === '2d' ? '3d' : '2d')}
              aria-label={view.value === '2d' ? 'Switch to 3D orbit view' : 'Switch to 2D drawing'}
            >
              {view.value === '2d' ? <CubeIcon /> : <FlatIcon />}
            </button>
          </div>
        </div>
      </div>

      <section class="panel" aria-label="Editing tools">
        <div class="panel-tabs">
          <div class="chips" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} class={`chip ${tab === t.id ? 'active' : ''}`} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div class="panel-body">
          {tab === 'joints' && <JointPanel />}
          {tab === 'pose' && <PosePanel />}
          {tab === 'body' && <MusclesPanel />}
          {tab === 'info' && <MetaPanel />}
        </div>
      </section>

      {menuOpen && <ExportMenu onClose={() => setMenuOpen(false)} />}
    </div>
  );
};
