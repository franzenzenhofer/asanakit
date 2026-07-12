import type { JSX } from 'preact';
import { navigate, route } from '../router.js';
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

export const AppShell = (): JSX.Element => {
  const current = route.value;
  const active = current.page === 'pose' ? 'library' : current.page;

  return (
    <div class="shell">
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
      <main class="shell-main">
        {(current.page === 'library' || current.page === 'pose') && <LibraryPage />}
        {current.page === 'editor' && <EditorPage />}
        {current.page === 'sheet' && <SheetBuilderPage />}
        {current.page === 'pose' && <PoseDetail id={current.id} />}
      </main>
    </div>
  );
};
