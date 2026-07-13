/**
 * rough.js publishes its ESM build with extensionless imports, which Node's ESM
 * resolver will not follow - so we import the single-file BUNDLE, which every
 * runtime can load. The bundle has no types of its own; rough.js ships them
 * separately, and this points at them.
 */
declare module 'roughjs/bundled/rough.esm.js' {
  import type { RoughGenerator } from 'roughjs/bin/generator.js';

  const rough: { generator: () => RoughGenerator };
  export default rough;
}
