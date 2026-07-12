import { useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import { parse as parseYamlRaw } from 'yaml';
import { parsePose, type PoseSpec, type PoseSpecInput } from '@asanakit/model/index.js';
import { renderSvg } from '@asanakit/render/scene.js';
import { navigate } from '../router.js';
import { collection } from '../state/app.js';
import { loadPose } from '../state/doc.js';
import { library } from '../state/library.js';
import { addStep, sheet } from '../state/sheet-doc.js';
import { downloadText } from '../lib/download.js';
import { CloseIcon } from '../ui/icons.js';

interface Resolved {
  readonly spec: PoseSpec;
  readonly yaml: string;
  readonly mine: boolean;
}

const resolve = (id: string): Resolved | null => {
  const bundled = library().byId.get(id);
  if (bundled !== undefined) return { spec: bundled.pose, yaml: bundled.yaml, mine: false };
  const saved = collection.myPoses.value.find((p) => p.id === id);
  if (saved === undefined) return null;
  try {
    return { spec: parsePose(saved.yaml, saved.id), yaml: saved.yaml, mine: true };
  } catch {
    return null;
  }
};

/** Full pose view: big figure, lineage, cues - and the fork into the editor. */
export const PoseDetail = ({ id }: { id: string }): JSX.Element | null => {
  const figure = useRef<HTMLDivElement>(null);
  const entry = resolve(id);

  useEffect(() => {
    if (entry === null || figure.current === null) return;
    figure.current.innerHTML = renderSvg({ ...entry.spec, physics: 'none' }, { width: 420, height: 480, background: 'none' });
  }, [id]);

  if (entry === null) return null;
  const { spec, yaml, mine } = entry;
  const close = (): void => navigate({ page: 'library' });

  const fork = (): void => {
    const input = parseYamlRaw(yaml) as PoseSpecInput;
    loadPose(mine ? input : { ...input, id: `${spec.id}-variation`, name: `${spec.name} (variation)` });
    navigate({ page: 'editor' });
  };

  const addToSheet = (): void => {
    const sections = sheet.value.sections ?? [];
    addStep(Math.max(0, sections.length - 1), spec.id);
    navigate({ page: 'sheet' });
  };

  return (
    <div class="modal-veil" onClick={close}>
      <div class="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={spec.name}>
        <div class="grabber" />
        <div style="display:flex;align-items:flex-start;gap:8px">
          <div style="flex:1">
            <h2 class="serif" style="font-size:22px">{spec.name}</h2>
            {spec.sanskrit !== undefined && <p style="margin:2px 0 0;color:var(--ink-faint);font-style:italic">{spec.sanskrit}</p>}
          </div>
          <button class="iconbtn" onClick={close} aria-label="Close"><CloseIcon /></button>
        </div>

        <div class="detail-figure" ref={figure} />

        <div class="detail-meta">
          <span class="tag">{spec.discipline}</span>
          {spec.family !== undefined && <span class="tag">{spec.family}</span>}
          {spec.difficulty !== undefined && <span class="tag">{'●'.repeat(spec.difficulty)}</span>}
          {spec.breath !== undefined && <span class="tag">breath: {spec.breath}</span>}
          {spec.drishti !== undefined && <span class="tag">drishti: {spec.drishti}</span>}
        </div>

        {spec.description !== undefined && <p style="margin:4px 0;color:var(--ink-soft);font-size:14px">{spec.description}</p>}
        {spec.cues.length > 0 && (
          <ul class="cue-list">
            {spec.cues.map((cue) => (
              <li key={cue}>{cue}</li>
            ))}
          </ul>
        )}

        <div class="detail-actions">
          <button class="btn primary" onClick={fork}>{mine ? 'Edit' : 'Edit a copy'}</button>
          <button class="btn" onClick={addToSheet}>Add to sheet</button>
          <button class="btn" onClick={() => downloadText(yaml, `${spec.id}.pose.yaml`, 'text/yaml')}>YAML</button>
          {mine && (
            <button
              class="btn"
              style="color:var(--error)"
              onClick={() => {
                collection.removePose(spec.id);
                close();
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
