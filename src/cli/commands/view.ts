import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Command } from 'commander';
import { resolveCamera } from '../../core/camera.js';
import { DEFAULT_RIG } from '../../core/rig.js';
import { solveSkeleton } from '../../core/skeleton.js';
import { resolveFigure } from '../../model/index.js';
import { buildViewerHtml } from '../../viewer/index.js';
import { parseCamera, resolvePose } from '../resolve.js';

const openFile = (path: string): void => {
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [path], { detached: true, stdio: 'ignore' }).unref();
};

export const registerViewCommands = (program: Command): void => {
  program
    .command('view <pose>')
    .description('Write a self-contained interactive 3D viewer (orbit, zoom, pan) as one offline HTML file')
    .option('-o, --out <file>', 'output path (defaults to <pose-id>.viewer.html)')
    .option('--camera <view>', 'starting viewpoint: a preset or "azimuth=30,elevation=15"')
    .option('--open', 'open the viewer in the default browser')
    .option('--lib <dir>', 'load poses from this directory')
    .action(async (ref: string, options: { out?: string; camera?: string; open?: boolean; lib?: string }) => {
      const pose = await resolvePose(ref, options.lib);
      const skeleton = solveSkeleton(resolveFigure(pose.figure), DEFAULT_RIG);
      const camera = resolveCamera(options.camera === undefined ? pose.camera : parseCamera(options.camera));

      const html = await buildViewerHtml(skeleton, {
        title: pose.name,
        subtitle: pose.sanskrit,
        camera,
        engaged: pose.muscles.engaged,
        stretched: pose.muscles.stretched,
      });

      const out = options.out ?? `${pose.id}.viewer.html`;
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, html);
      process.stdout.write(`${out}\n`);
      if (options.open === true) openFile(out);
    });
};
