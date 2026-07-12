import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { collection } from '../state/app.js';
import { emptyFilter, library, matches } from '../state/library.js';
import { CloseIcon } from '../ui/icons.js';

export interface PosePickerProps {
  readonly onPick: (id: string) => void;
  readonly onClose: () => void;
}

/** Quick in-place pose search for building a sheet without leaving it. */
export const PosePicker = ({ onPick, onClose }: PosePickerProps): JSX.Element => {
  const [query, setQuery] = useState('');
  const filter = { ...emptyFilter, query };
  const entries = library().entries.filter((e) => matches(e.pose, filter)).slice(0, 40);
  const mine = collection.myPoses.value.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div class="modal-veil" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Add pose">
        <div class="grabber" />
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
          <input
            class="search"
            style="flex:1;margin:0"
            type="search"
            placeholder="Search poses…"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            autofocus
          />
          <button class="iconbtn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>

        {mine.length > 0 && (
          <>
            <div class="section-h"><h2>My poses</h2></div>
            {mine.map((p) => (
              <button key={p.id} class="btn" style="width:100%;justify-content:flex-start;margin-bottom:4px" onClick={() => onPick(p.id)}>
                {p.name}
              </button>
            ))}
          </>
        )}

        <div class="section-h"><h2>Library</h2></div>
        {entries.map((e) => (
          <button key={e.pose.id} class="btn" style="width:100%;justify-content:flex-start;margin-bottom:4px" onClick={() => onPick(e.pose.id)}>
            <span style="flex:1;text-align:left">{e.pose.name}</span>
            <span style="color:var(--ink-faint);font-size:12px;font-style:italic">{e.pose.sanskrit ?? ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
