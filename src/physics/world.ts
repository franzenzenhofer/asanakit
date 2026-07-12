/**
 * The one place asanakit touches Rapier's WASM module. Initialisation is
 * async and cached, and nothing outside src/physics imports Rapier - so
 * `import '@franzenzenhofer/asanakit'` never pays for a physics engine the
 * caller did not ask for.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import type { RapierApi } from './rapier-types.js';

// The single cast at the boundary: rapier's own d.ts degrades to `any` under
// NodeNext (extensionless internal imports), so we assert our structural
// types instead. See rapier-types.ts.
const R = RAPIER as unknown as RapierApi;

let ready: Promise<RapierApi> | null = null;

export const rapier = (): Promise<RapierApi> => {
  const current = ready ?? R.init().then(() => R);
  ready = current;
  return current;
};

export type { RapierApi } from './rapier-types.js';
