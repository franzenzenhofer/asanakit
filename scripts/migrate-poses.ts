/**
 * One-shot migration of format-1 (2D) pose files to format 2 (3D).
 *
 * Format 1 declared bone directions as single picture-plane angles under a
 * named view. The view told you which anatomical plane that picture was:
 * `side` drew the sagittal plane, `front`/`back` the coronal plane. Each
 * scalar therefore lifts losslessly into a 3D direction inside its plane -
 * what the author drew is exactly what the 3D solve reproduces, seen through
 * the matching camera preset.
 *
 * Kept as an authoring aid, not a runtime compatibility layer: the parser
 * rejects format 1, this script rewrites the files.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import YAML, { isMap, isPair, isScalar } from 'yaml';

const ROOT = new URL('../poses', import.meta.url).pathname;

type ViewId = 'front' | 'back' | 'side' | 'three-quarter';

const normalizeDeg = (deg: number): number => {
  const wrapped = ((deg % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
};

/** Lift a picture-plane angle into a 3D direction inside the view's anatomical plane. */
const liftAngle = (theta: number, view: ViewId): { azimuth: number; elevation: number } => {
  const t = normalizeDeg(theta);
  const inPlane = Math.abs(t) <= 90;
  const elevation = inPlane ? t : Math.sign(t) * (180 - Math.abs(t));
  if (view === 'side' || view === 'three-quarter') {
    // Sagittal plane: picture-x was the facing direction.
    return { azimuth: inPlane ? 0 : 180, elevation };
  }
  // Coronal plane: picture-x was the figure's left.
  return { azimuth: inPlane ? 90 : -90, elevation };
};

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (e) => {
      const full = join(dir, e.name);
      if (e.isDirectory()) return walk(full);
      return extname(e.name) === '' ? [] : [full];
    }),
  );
  return files.flat();
};

const flowWorldEntries = (doc: YAML.Document): void => {
  const world = doc.getIn(['figure', 'world']);
  if (!isMap(world)) return;
  for (const item of world.items) {
    if (isPair(item) && isMap(item.value)) item.value.flow = true;
  }
};

// Root rotation was the pelvis picture angle (90 = upright). In the sagittal
// plane that is pitch; in the coronal plane it is roll (negated: positive
// roll drops the figure's right side, positive picture rotation tipped left).
const migrateRoot = (doc: YAML.Document, view: ViewId): void => {
  const rotation = doc.getIn(['figure', 'root', 'rotation']);
  if (typeof rotation !== 'number') return;
  doc.deleteIn(['figure', 'root', 'rotation']);
  const tilt = normalizeDeg(90 - rotation);
  if (tilt !== 0) {
    if (view === 'side' || view === 'three-quarter') doc.setIn(['figure', 'root', 'pitch'], tilt);
    else doc.setIn(['figure', 'root', 'roll'], -tilt);
  }
  const rootNode = doc.getIn(['figure', 'root']);
  if (isMap(rootNode) && rootNode.items.length === 0) doc.deleteIn(['figure', 'root']);
};

const migrateWorld = (doc: YAML.Document, view: ViewId, file: string): void => {
  const world = doc.getIn(['figure', 'world']);
  if (!isMap(world)) return;
  for (const item of world.items) {
    if (!isPair(item) || !isScalar(item.value)) continue;
    const theta = item.value.value;
    if (typeof theta !== 'number') throw new Error(`${file}: non-numeric world angle`);
    item.value = doc.createNode(liftAngle(theta, view));
  }
};

const migratePose = (text: string, file: string): string => {
  const doc = YAML.parseDocument(text);
  if (doc.get('asanakit') !== 1) {
    console.log(`skip  ${file} (already format ${String(doc.get('asanakit'))})`);
    return text;
  }

  doc.set('asanakit', 2);

  const view = (doc.getIn(['figure', 'view']) as ViewId | undefined) ?? 'front';
  doc.deleteIn(['figure', 'view']);

  // The authored view becomes the pose's default camera.
  doc.set('camera', view === 'three-quarter' ? 'three-quarter' : view);

  migrateRoot(doc, view);
  migrateWorld(doc, view, file);
  flowWorldEntries(doc);
  return doc.toString({ lineWidth: 0 });
};

const migrateSequence = (text: string, file: string): string => {
  const doc = YAML.parseDocument(text);
  if (doc.get('asanakit') !== 1) {
    console.log(`skip  ${file}`);
    return text;
  }
  doc.set('asanakit', 2);
  return doc.toString({ lineWidth: 0 });
};

const files = await walk(ROOT);
for (const file of files.sort()) {
  const text = await readFile(file, 'utf8');
  if (/\.pose\.ya?ml$/.test(file)) {
    await writeFile(file, migratePose(text, file));
    console.log(`pose  ${file}`);
  } else if (/\.seq\.ya?ml$/.test(file)) {
    await writeFile(file, migrateSequence(text, file));
    console.log(`seq   ${file}`);
  }
}
console.log('done');
