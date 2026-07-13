import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { parse as parseYamlRaw } from 'yaml';
import { parsePose, parseSheet, type PoseSpecInput, type SheetSpecInput } from '@asanakit/model/index.js';
import { navigate, route, type Route } from '../router.js';
import { decodeShare } from '../lib/share.js';
import { loadPose } from '../state/doc.js';
import { loadSheet } from '../state/sheet-doc.js';
import { EditorPage } from '../editor/editor-page.js';
import { LibraryPage } from '../library/library-page.js';
import { PoseDetail } from '../library/pose-detail.js';
import { SheetBuilderPage } from '../sheet/sheet-builder-page.js';
import { EditIcon, LibraryIcon, SheetIcon } from './icons.js';

const TABS = [
  { page: 'library', label: 'Library', icon: LibraryIcon },
  { page: 'editor', label: 'Editor', icon: EditIcon },
  { page: 'sheet', label: 'Sheets', icon: SheetIcon },
] as const;

/** Open a shared link: decode the fragment, validate, load, jump to the surface. */
const openShared = async (shared: Extract<Route, { page: 'shared' }>): Promise<void> => {
  try {
    const text = await decodeShare(shared.data);
    if (shared.kind === 'pose') {
      parsePose(text, 'shared link');
      loadPose(parseYamlRaw(text) as PoseSpecInput);
      navigate({ page: 'editor' });
    } else {
      parseSheet(text, 'shared link');
      loadSheet(parseYamlRaw(text) as SheetSpecInput);
      navigate({ page: 'sheet' });
    }
  } catch (error) {
    console.error('[asanakit] unreadable share link', error);
    navigate({ page: 'library' });
  }
};

export const AppShell = (): JSX.Element => {
  const current = route.value;
  const active = current.page === 'pose' || current.page === 'shared' ? 'library' : current.page;

  useEffect(() => {
    if (current.page === 'shared') void openShared(current);
  }, [current]);

  return (
    <div class="shell">
      <main class="shell-main">
        {(current.page === 'library' || current.page === 'pose') && <LibraryPage />}
        {current.page === 'editor' && <EditorPage />}
        {current.page === 'sheet' && <SheetBuilderPage />}
        {current.page === 'pose' && <PoseDetail id={current.id} />}
      </main>
      <nav class="tabbar" aria-label="Main">
        {TABS.map((tab) => (
          <button
            key={tab.page}
            class={active === tab.page ? 'active' : ''}
            onClick={() => navigate({ page: tab.page })}
            aria-current={active === tab.page ? 'page' : undefined}
          >
            <tab.icon />
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};
