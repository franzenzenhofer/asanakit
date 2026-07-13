import type { JSX } from 'preact';

const icon = (path: JSX.Element): JSX.Element => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {path}
  </svg>
);

export const LibraryIcon = (): JSX.Element =>
  icon(<><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="10" rx="1.5" /></>);

export const EditIcon = (): JSX.Element =>
  icon(<><circle cx="12" cy="5" r="2.2" /><path d="M12 7.5v6M12 9.5l-4.5 3M12 9.5l4.5 3M12 13.5l-3.5 6M12 13.5l3.5 6" /></>);

export const SheetIcon = (): JSX.Element =>
  icon(<><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 8h8M8 12h8M8 16h5" /></>);

export const UndoIcon = (): JSX.Element => icon(<path d="M8 5L4 9l4 4M4 9h10a5 5 0 0 1 0 10h-3" />);
export const RedoIcon = (): JSX.Element => icon(<path d="M16 5l4 4-4 4M20 9H10a5 5 0 0 0 0 10h3" />);
export const MirrorIcon = (): JSX.Element => icon(<><path d="M12 3v18" stroke-dasharray="2.5 3" /><path d="M8 7L4 12l4 5M16 7l4 5-4 5" /></>);
export const CubeIcon = (): JSX.Element => icon(<><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9" /></>);
export const FlatIcon = (): JSX.Element => icon(<><circle cx="12" cy="6" r="2" /><path d="M12 8.5v5M12 10l-4 2.5M12 10l4 2.5M12 13.5l-3 5.5M12 13.5l3 5.5" /></>);
export const CloseIcon = (): JSX.Element => icon(<path d="M6 6l12 12M18 6L6 18" />);
export const PlusIcon = (): JSX.Element => icon(<path d="M12 5v14M5 12h14" />);
export const MoreIcon = (): JSX.Element => icon(<><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></>);
export const PrintIcon = (): JSX.Element => icon(<><path d="M7 8V4h10v4M7 16H4v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6h-3" /><rect x="7" y="14" width="10" height="7" rx="1" /></>);
export const DownloadIcon = (): JSX.Element => icon(<><path d="M12 4v11M7 11l5 5 5-5" /><path d="M5 20h14" /></>);
export const AngleIcon = (): JSX.Element =>
  icon(<><path d="M4 19h16" /><path d="M4 19L16 6" /><path d="M11 19a8 8 0 0 0-2.5-5.5" /></>);
export const LinkIcon = (): JSX.Element => icon(<><path d="M9 15l6-6" /><path d="M10.5 6.5L12 5a4 4 0 0 1 6 6l-1.5 1.5M13.5 17.5L12 19a4 4 0 0 1-6-6l1.5-1.5" /></>);
