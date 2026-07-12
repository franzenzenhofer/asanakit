import type { JSX } from 'preact';
import { dispatch, pose } from '../state/doc.js';
import type { MetaPatch } from '../state/actions.js';

const FAMILIES = ['standing', 'seated', 'twist', 'forward-fold', 'backbend', 'inversion', 'arm-balance', 'core', 'restorative', 'transition', 'riding', 'paddling', 'waiting'];

const slugify = (value: string): string =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-asana';

/** Name, lineage and teaching notes - what prints on a sheet. */
export const MetaPanel = (): JSX.Element => {
  const doc = pose.value;
  const patch = (value: MetaPatch): void => dispatch({ type: 'set-meta', patch: value });

  return (
    <div>
      <div class="field-row">
        <div class="field">
          <label>Name</label>
          <input
            value={doc.name}
            onChange={(e) => {
              const name = (e.target as HTMLInputElement).value.trim() || 'My Asana';
              patch({ name, id: slugify(name) });
            }}
          />
        </div>
        <div class="field">
          <label>Sanskrit</label>
          <input value={doc.sanskrit ?? ''} onChange={(e) => patch({ sanskrit: (e.target as HTMLInputElement).value || undefined })} />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Discipline</label>
          <select value={doc.discipline} onChange={(e) => patch({ discipline: (e.target as HTMLSelectElement).value as 'yoga' | 'surf' | 'other' })}>
            <option value="yoga">yoga</option>
            <option value="surf">surf</option>
            <option value="other">other</option>
          </select>
        </div>
        <div class="field">
          <label>Family</label>
          <select value={doc.family ?? ''} onChange={(e) => patch({ family: (e.target as HTMLSelectElement).value || undefined })}>
            <option value="">-</option>
            {FAMILIES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div class="field">
          <label>Difficulty</label>
          <select
            value={doc.difficulty ?? ''}
            onChange={(e) => {
              const raw = (e.target as HTMLSelectElement).value;
              patch({ difficulty: raw === '' ? undefined : Number(raw) });
            }}
          >
            <option value="">-</option>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div class="field">
        <label>Description</label>
        <textarea
          rows={2}
          value={doc.description ?? ''}
          onChange={(e) => patch({ description: (e.target as HTMLTextAreaElement).value || undefined })}
        />
      </div>

      <div class="field">
        <label>Teaching cues - one per line, printed under the figure</label>
        <textarea
          rows={3}
          value={(doc.cues ?? []).join('\n')}
          onChange={(e) => patch({ cues: (e.target as HTMLTextAreaElement).value.split('\n').map((c) => c.trim()).filter((c) => c !== '') })}
        />
      </div>

      <div class="field-row">
        <div class="field">
          <label>Breath</label>
          <select value={doc.breath ?? ''} onChange={(e) => {
            const raw = (e.target as HTMLSelectElement).value;
            patch({ breath: raw === '' ? undefined : (raw as MetaPatch['breath']) });
          }}>
            <option value="">-</option>
            {['inhale', 'exhale', 'hold', 'free'].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div class="field">
          <label>Drishti (gaze)</label>
          <input value={doc.drishti ?? ''} onChange={(e) => patch({ drishti: (e.target as HTMLInputElement).value || undefined })} />
        </div>
        <div class="field">
          <label>Tags</label>
          <input
            value={(doc.tags ?? []).join(', ')}
            onChange={(e) => patch({ tags: (e.target as HTMLInputElement).value.split(',').map((t) => t.trim()).filter((t) => t !== '') })}
          />
        </div>
      </div>
    </div>
  );
};
