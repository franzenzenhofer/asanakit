import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { parsePose } from '@asanakit/model/index.js';
import { renderSvg } from '@asanakit/render/scene.js';
import { navigate } from '../router.js';
import { collection } from '../state/app.js';
import { emptyFilter, families, library, matches, thumbnail, type LibraryFilter } from '../state/library.js';
import { PoseCard } from './pose-card.js';

const DISCIPLINES = ['yoga', 'surf'] as const;

const myThumb = (yaml: string): string => {
  try {
    return renderSvg(parsePose(yaml), { width: 180, height: 220, style: 'minimal', background: 'none' });
  } catch {
    return '';
  }
};

/** Browse the whole library; every card forks into the editor. */
export const LibraryPage = (): JSX.Element => {
  const [filter, setFilter] = useState<LibraryFilter>(emptyFilter);
  const patch = (value: Partial<LibraryFilter>): void => setFilter({ ...filter, ...value });

  const entries = library().entries.filter((e) => matches(e.pose, filter));
  const mine = collection.myPoses.value;
  const familyOptions = filter.discipline === null ? [] : families(filter.discipline);

  return (
    <div class="library">
      <input
        class="search"
        type="search"
        placeholder={`Search ${library().entries.length} poses - name, sanskrit, tag…`}
        value={filter.query}
        onInput={(e) => patch({ query: (e.target as HTMLInputElement).value })}
      />

      <div class="chips">
        <button class={`chip ${filter.discipline === null ? 'active' : ''}`} onClick={() => patch({ discipline: null, family: null })}>
          All
        </button>
        {DISCIPLINES.map((d) => (
          <button key={d} class={`chip ${filter.discipline === d ? 'active' : ''}`} onClick={() => patch({ discipline: d, family: null })}>
            {d}
          </button>
        ))}
        {[1, 2, 3, 4, 5].map((d) => (
          <button
            key={d}
            class={`chip ${filter.difficulty === d ? 'active' : ''}`}
            onClick={() => patch({ difficulty: filter.difficulty === d ? null : d })}
            aria-label={`Difficulty ${d}`}
          >
            {'●'.repeat(d)}
          </button>
        ))}
      </div>

      {familyOptions.length > 0 && (
        <div class="chips" style="margin-top:6px">
          {familyOptions.map((f) => (
            <button key={f} class={`chip ${filter.family === f ? 'active' : ''}`} onClick={() => patch({ family: filter.family === f ? null : f })}>
              {f}
            </button>
          ))}
        </div>
      )}

      {mine.length > 0 && filter.query === '' && filter.discipline === null && (
        <>
          <div class="section-h">
            <h2>My poses</h2>
            <span class="count">{mine.length}</span>
          </div>
          <div class="pose-grid">
            {mine.map((p) => (
              <PoseCard key={p.id} name={p.name} sub="saved on this device" svg={myThumb(p.yaml)} onOpen={() => navigate({ page: 'pose', id: p.id })} />
            ))}
          </div>
        </>
      )}

      <div class="section-h">
        <h2>Library</h2>
        <span class="count">{entries.length} poses</span>
      </div>
      {entries.length === 0 ? (
        <div class="empty">
          <span class="serif">Nothing matches</span>
          Try a different spelling, or clear the filters.
        </div>
      ) : (
        <div class="pose-grid">
          {entries.map((e) => (
            <PoseCard
              key={e.pose.id}
              name={e.pose.name}
              sub={e.pose.sanskrit ?? e.pose.english ?? ''}
              svg={thumbnail(e.pose.id)}
              onOpen={() => navigate({ page: 'pose', id: e.pose.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
};
