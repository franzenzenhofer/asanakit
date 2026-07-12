import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Command } from 'commander';
import { resolveCamera } from '../../core/camera.js';
import { expandSequence } from '../../library/index.js';
import type { PoseSpec } from '../../model/index.js';
import { solvePose } from '../../solve.js';
import { buildShowcaseHtml, buildViewerHtml, type ShowcaseEntry } from '../../viewer/index.js';
import { library, parseCamera, resolvePose } from '../resolve.js';

const openFile = (path: string): void => {
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [path], { detached: true, stdio: 'ignore' }).unref();
};

interface HtmlOptions {
  out: string;
  all?: boolean;
  sequence?: string;
  title?: string;
  settle?: boolean;
  open?: boolean;
  lib?: string;
}

const posesFor = async (refs: string[], options: HtmlOptions): Promise<PoseSpec[]> => {
  const lib = await library(options.lib);
  if (options.sequence !== undefined) {
    const sequence = lib.sequences.get(options.sequence);
    if (sequence === undefined) {
      throw new Error(`Unknown sequence "${options.sequence}". Known: ${[...lib.sequences.keys()].join(', ')}`);
    }
    // A practice repeats poses; a gallery wants each variant once. Mirrored
    // "second side" steps keep their own entry under a distinct id.
    const seen = new Set<string>();
    const unique: PoseSpec[] = [];
    for (const step of expandSequence(sequence, lib)) {
      const id = step.side === 'right' ? `${step.pose.id}-right` : step.pose.id;
      if (seen.has(id)) continue;
      seen.add(id);
      unique.push({ ...step.pose, id, name: step.label });
    }
    return unique;
  }
  if (options.all === true) return [...lib.poses.values()];
  return Promise.all(refs.map((ref) => resolvePose(ref, options.lib)));
};

export const registerViewCommands = (program: Command): void => {
  program
    .command('view <pose>')
    .description('Write a self-contained interactive 3D viewer (orbit, zoom, pan) as one offline HTML file')
    .option('-o, --out <file>', 'output path (defaults to <pose-id>.viewer.html)')
    .option('--camera <view>', 'starting viewpoint: a preset or "azimuth=30,elevation=15"')
    .option('--settle', 'drop the figure onto the ground with the physics engine first')
    .option('--open', 'open the viewer in the default browser')
    .option('--lib <dir>', 'load poses from this directory')
    .action(async (ref: string, options: { out?: string; camera?: string; settle?: boolean; open?: boolean; lib?: string }) => {
      const pose = await resolvePose(ref, options.lib);
      const skeleton = await solvePose(pose, options.settle === undefined ? {} : { settle: options.settle });
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

  program
    .command('html [poses...]')
    .description('Write ONE self-contained HTML: interactive 3D viewer with pose picker plus an SVG gallery')
    .requiredOption('-o, --out <file>', 'output path (.html)')
    .option('--all', 'every pose in the library')
    .option('--sequence <id>', 'every distinct pose of a sequence, in practice order')
    .option('--title <text>', 'page title')
    .option('--settle', 'drop each figure onto the ground with the physics engine first')
    .option('--open', 'open the page in the default browser')
    .option('--lib <dir>', 'load poses from this directory')
    .action(async (refs: string[], options: HtmlOptions) => {
      const poses = await posesFor(refs, options);
      if (poses.length === 0) throw new Error('Nothing to show: pass pose ids, --all, or --sequence <id>');

      const settle = options.settle === undefined ? {} : { settle: options.settle };
      const entries: ShowcaseEntry[] = await Promise.all(
        poses.map(async (pose) => ({ pose, skeleton: await solvePose(pose, settle) })),
      );

      const html = await buildShowcaseHtml(entries, options.title === undefined ? {} : { title: options.title });
      await mkdir(dirname(options.out), { recursive: true });
      await writeFile(options.out, html);
      process.stdout.write(`${options.out}\n`);
      if (options.open === true) openFile(options.out);
    });
};
