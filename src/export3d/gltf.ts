import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import type { Skeleton } from '../core/types.js';
import { buildFigureScene, type FigureSceneOptions } from '../three/scene.js';
import { installFileReaderShim } from './shims.js';

export interface GltfExportOptions extends FigureSceneOptions {
  /** Embed as binary GLB (default) or JSON .gltf with embedded buffers. */
  readonly binary?: boolean;
}

const exportScene = (skeleton: Skeleton, options: GltfExportOptions): Promise<ArrayBuffer | object> => {
  installFileReaderShim();
  const scene = buildFigureScene(skeleton, options);
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        resolve(result);
      },
      reject,
      { binary: options.binary ?? true },
    );
  });
};

/** A solved skeleton as binary GLB bytes - browser-safe (no Buffer). */
export const exportGlbBytes = async (skeleton: Skeleton, options: GltfExportOptions = {}): Promise<ArrayBuffer> => {
  const result = await exportScene(skeleton, { ...options, binary: true });
  if (!(result instanceof ArrayBuffer)) throw new Error('GLTFExporter did not return a binary buffer');
  return result;
};

/** A solved skeleton as a binary GLB: one file any 3D viewer can orbit and zoom. */
export const exportGlb = async (skeleton: Skeleton, options: GltfExportOptions = {}): Promise<Buffer> =>
  Buffer.from(await exportGlbBytes(skeleton, options));

/** The same scene as embedded-buffer glTF JSON, for debugging and diffing. */
export const exportGltf = async (skeleton: Skeleton, options: GltfExportOptions = {}): Promise<string> => {
  const result = await exportScene(skeleton, { ...options, binary: false });
  if (result instanceof ArrayBuffer) throw new Error('GLTFExporter returned binary for a JSON export');
  return `${JSON.stringify(result, null, 2)}\n`;
};
