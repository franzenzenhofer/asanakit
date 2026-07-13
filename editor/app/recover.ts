/**
 * The white-screen guard.
 *
 * Studio is a PWA, so a returning visitor may still be holding a service worker
 * from a previous deploy. If that worker serves an index.html whose hashed
 * chunks we have since deleted from the server, the page loads, the module
 * fails, and the app boots to nothing at all. Nobody reports that bug; they
 * just decide the thing is broken.
 *
 * So: if a script or a dynamic import fails to load, assume we are stale, throw
 * away every worker and every cache, and reload ONCE. A single sessionStorage
 * flag makes it once - a reload loop would be a worse bug than the one it fixes.
 */
const FLAG = 'asanakit.recovered';

const looksLikeStaleBuild = (message: string): boolean =>
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unexpected token '<'/i.test(
    message,
  );

const recover = async (): Promise<void> => {
  if (sessionStorage.getItem(FLAG) !== null) return; // already tried; let the error stand
  sessionStorage.setItem(FLAG, '1');

  const workers = await navigator.serviceWorker?.getRegistrations().catch(() => []);
  await Promise.all((workers ?? []).map((w) => w.unregister()));
  const names = await caches?.keys().catch(() => []);
  await Promise.all((names ?? []).map((n) => caches.delete(n)));

  location.reload();
};

export const guardAgainstStaleBuild = (): void => {
  // A good load means the build is coherent; let the next one recover if it needs to.
  window.addEventListener('load', () => sessionStorage.removeItem(FLAG));

  window.addEventListener('error', (event) => {
    const target = event.target;
    const failedResource =
      target instanceof HTMLScriptElement || target instanceof HTMLLinkElement;
    if (failedResource || looksLikeStaleBuild(event.message ?? '')) void recover();
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    if (looksLikeStaleBuild(message)) void recover();
  });
};
