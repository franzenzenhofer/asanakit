import type { JSX } from 'preact';
import { PAPER_IDS } from '@asanakit/model/index.js';
import { STYLE_IDS, STYLES } from '@asanakit/render/styles.js';
import { patchSheet, sheet } from '../state/sheet-doc.js';

const SHOW_FLAGS = [
  { key: 'sanskrit', label: 'Sanskrit names' },
  { key: 'breath', label: 'Breath & count' },
  { key: 'numbers', label: 'Numbers' },
] as const;

/** Paper, density and what prints - the sheet's presentation half. */
export const SheetOptions = (): JSX.Element => {
  const doc = sheet.value;
  const show = { sanskrit: true, breath: true, numbers: true, cues: false, ...doc.show };

  return (
    <div>
      <div class="field-row">
        <div class="field">
          <label>Paper</label>
          <div class="segmented">
            {PAPER_IDS.map((p) => (
              <button key={p} class={(doc.paper ?? 'a4') === p ? 'active' : ''} onClick={() => patchSheet({ paper: p })}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div class="field">
          <label>Orientation</label>
          <div class="segmented">
            {(['portrait', 'landscape'] as const).map((o) => (
              <button key={o} class={(doc.orientation ?? 'portrait') === o ? 'active' : ''} onClick={() => patchSheet({ orientation: o })}>
                {o}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div class="field">
        <label>Poses per row</label>
        <div class="segmented">
          {[2, 3, 4, 5, 6].map((c) => (
            <button key={c} class={(doc.columns ?? 4) === c ? 'active' : ''} onClick={() => patchSheet({ columns: c })}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div class="field">
        <label>Style</label>
        <div class="segmented">
          {STYLE_IDS.map((s) => (
            <button key={s} class={(doc.style ?? 'stick') === s ? 'active' : ''} onClick={() => patchSheet({ style: s })}>
              {STYLES[s].label}
            </button>
          ))}
        </div>
      </div>

      <div class="field">
        <label>Print</label>
        {SHOW_FLAGS.map((flag) => (
          <label key={flag.key} style="display:flex;gap:8px;align-items:center;font-weight:400;font-size:14px;color:var(--ink)">
            <input
              type="checkbox"
              checked={show[flag.key]}
              onChange={(e) => patchSheet({ show: { ...show, [flag.key]: (e.target as HTMLInputElement).checked } })}
            />
            {flag.label}
          </label>
        ))}
      </div>

      <div class="field">
        <label>Footer</label>
        <input
          value={doc.footer ?? ''}
          placeholder="Studio name, date…"
          onChange={(e) => patchSheet({ footer: (e.target as HTMLInputElement).value || undefined })}
        />
      </div>
    </div>
  );
};
