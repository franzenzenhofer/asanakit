import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname } from 'node:path';
import type { Command } from 'commander';
import { DEFAULT_RIG } from '../../core/rig.js';
import { solveSkeleton } from '../../core/skeleton.js';
import { exportGlb, exportGltf } from '../../export3d/index.js';
import { resolveFigure } from '../../model/index.js';
import { solvePose } from '../../solve.js';
import { toKeypoints, type KeypointFormat } from '../../standards/keypoints.js';
import { resolvePose } from '../resolve.js';

const FORMATS: readonly string[] = ['mediapipe33', 'coco17'];

export const registerExportCommands = (program: Command): void => {
  program
    .command('gltf <pose>')
    .description('Export a pose as a 3D model any glTF viewer can orbit and zoom (.glb or .gltf)')
    .requiredOption('-o, --out <file>', 'output path; the extension picks binary .glb or JSON .gltf')
    .option('--settle', 'drop the figure onto the ground with the physics engine first')
    .option('--lib <dir>', 'load poses from this directory')
    .action(async (ref: string, options: { out: string; settle?: boolean; lib?: string }) => {
      const pose = await resolvePose(ref, options.lib);
      const skeleton = await solvePose(pose, options.settle === undefined ? {} : { settle: options.settle });
      const sceneOptions = { engaged: pose.muscles.engaged, stretched: pose.muscles.stretched, props: pose.props };

      await mkdir(dirname(options.out), { recursive: true });
      if (extname(options.out).toLowerCase() === '.gltf') {
        await writeFile(options.out, await exportGltf(skeleton, sceneOptions));
      } else {
        await writeFile(options.out, await exportGlb(skeleton, sceneOptions));
      }
      process.stdout.write(`${options.out}\n`);
    });
  program
    .command('keypoints <pose>')
    .description('Export a pose as pose-estimation keypoints (MediaPipe 33 or COCO 17)')
    .option('-f, --format <name>', 'mediapipe33 | coco17', 'mediapipe33')
    .option('--normalize', 'emit 0..1 image coordinates with y pointing down')
    .option('--lib <dir>', 'load poses from this directory')
    .action(async (ref: string, options: { format: string; normalize?: boolean; lib?: string }) => {
      if (!FORMATS.includes(options.format)) {
        throw new Error(`Unknown keypoint format "${options.format}". Available: ${FORMATS.join(', ')}`);
      }

      const pose = await resolvePose(ref, options.lib);
      const skeleton = solveSkeleton(resolveFigure(pose.figure), DEFAULT_RIG);
      const set = toKeypoints(skeleton, options.format as KeypointFormat, {
        normalize: options.normalize === true,
      });

      process.stdout.write(`${JSON.stringify({ pose: pose.id, name: pose.name, ...set }, null, 2)}\n`);
    });

  program
    .command('landmarks <pose>')
    .description("Print the solved skeleton: every bone's endpoints and world angle, plus the named landmarks")
    .option('--lib <dir>', 'load poses from this directory')
    .action(async (ref: string, options: { lib?: string }) => {
      const pose = await resolvePose(ref, options.lib);
      const skeleton = solveSkeleton(resolveFigure(pose.figure), DEFAULT_RIG);

      process.stdout.write(
        `${JSON.stringify(
          {
            pose: pose.id,
            height: skeleton.height,
            bounds: skeleton.bounds,
            landmarks: skeleton.landmarks,
            bones: Object.fromEntries(
              Object.entries(skeleton.bones).map(([id, b]) => [
                id,
                { start: b.start, end: b.end, orientation: b.orientation, length: b.length },
              ]),
            ),
          },
          null,
          2,
        )}\n`,
      );
    });
};
