import { signal } from '@preact/signals';

export type Route =
  | { page: 'library' }
  | { page: 'editor' }
  | { page: 'sheet' }
  | { page: 'pose'; id: string };

const parse = (hash: string): Route => {
  const path = hash.replace(/^#\/?/, '');
  if (path.startsWith('pose/')) return { page: 'pose', id: decodeURIComponent(path.slice(5)) };
  if (path === 'editor') return { page: 'editor' };
  if (path === 'sheet') return { page: 'sheet' };
  return { page: 'library' };
};

export const route = signal<Route>(parse(location.hash));

window.addEventListener('hashchange', () => {
  route.value = parse(location.hash);
});

export const navigate = (to: Route): void => {
  const hash = to.page === 'pose' ? `#/pose/${encodeURIComponent(to.id)}` : `#/${to.page}`;
  if (location.hash === hash) route.value = parse(hash);
  else location.hash = hash;
};
