import type { JSX } from 'preact';
import { MUSCLES, MUSCLE_IDS } from '@asanakit/anatomy/muscles.js';
import { LANDMARK_IDS } from '@asanakit/core/types.js';
import { dispatch, pose, styleId } from '../state/doc.js';

/** Mark what works and what lengthens; visible in the anatomy style. */
export const MusclesPanel = (): JSX.Element => {
  const muscles = pose.value.muscles ?? {};
  const contact = new Set(pose.value.contact ?? []);

  const list = (kind: 'engaged' | 'stretched', hint: string): JSX.Element => {
    const active = new Set(muscles[kind] ?? []);
    return (
      <div class="field">
        <label>
          {kind === 'engaged' ? 'Engaged' : 'Stretched'} <span style={`color:var(--${kind === 'engaged' ? 'engaged' : 'stretched'})`}>●</span> {hint}
        </label>
        <div class="chips" style="flex-wrap:wrap">
          {MUSCLE_IDS.map((id) => (
            <button
              key={id}
              class={`chip ${active.has(id) ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'set-muscle', list: kind, muscle: id, on: !active.has(id) })}
            >
              {MUSCLES[id].label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {styleId.value !== 'anatomy' && (
        <p style="font-size:12.5px;color:var(--ink-faint);margin:0 0 10px">
          Muscles draw in the <button class="btn subtle" style="padding:0" onClick={() => (styleId.value = 'anatomy')}>anatomy style</button>.
        </p>
      )}
      {list('engaged', 'working')}
      {list('stretched', 'lengthening')}

      <div class="field">
        <label>Floor contact - the pose&apos;s honest claim, checked by lint</label>
        <div class="chips" style="flex-wrap:wrap">
          {LANDMARK_IDS.map((id) => (
            <button
              key={id}
              class={`chip ${contact.has(id) ? 'active' : ''}`}
              onClick={() => dispatch({ type: 'set-contact', landmark: id, on: !contact.has(id) })}
            >
              {id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
