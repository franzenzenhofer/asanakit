import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname } from 'node:path';
import type { Command } from 'commander';
import { resolveCamera } from '../../core/camera.js';
import { expandSequence } from '../../library/index.js';
import type { PoseSpec } from '../../model/index.js';
import { optimizeSvg, renderPng, renderSheet, renderSvg, type RenderOptions, type SheetOptions } from '../../render/index.js';
import { solvePose } from '../../solve.js';
import { buildShowcaseHtml } from '../../viewer/index.js';
import { library, parseCamera, parseIntOption, parseStyle, resolvePose } from '../resolve.js';

interface CommonOptions {
  style: string;
  width: string;
  height: string;
  camera?: string;
  settle?: boolean;
  title?: boolean;
  caption?: boolean;
  muscles?: boolean;
  background?: string;
  optimize?: boolean;
  scale?: string;
  lib?: string;
}

const renderOptionsFrom = (o: CommonOptions): RenderOptions => ({
  style: parseStyle(o.style),
  width: parseIntOption(o.width, 'width'),
  height: parseIntOption(o.height, 'height'),
  title: o.title === true,
  caption: o.caption === true,
  ...(o.camera === undefined ? {} : { camera: parseCamera(o.camera) }),
  ...(o.muscles === undefined ? {} : { muscles: o.muscles }),
  ...(o.background === undefined ? {} : { background: o.background }),
});

const write = async (path: string, svg: string, o: CommonOptions): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  const body = o.optimize === true ? optimizeSvg(svg) : svg;

  if (extname(path).toLowerCase() === '.png') {
    const width = o.scale === undefined ? undefined : parseIntOption(o.scale, 'scale');
    await writeFile(path, renderPng(body, width === undefined ? {} : { width }));
  } else {
    await writeFile(path, body);
  }
  process.stdout.write(`${path}\n`);
};

const withCommonOptions = (cmd: Command): Command =>
  cmd
    .option('-s, --style <style>', 'stick | anatomy | silhouette | blueprint | ink | poster | minimal', 'stick')
    .option('-w, --width <px>', 'canvas width', '600')
    .option('-h, --height <px>', 'canvas height', '800')
    .option('--camera <view>', 'front | back | left | right | side | three-quarter | top, or "azimuth=30,elevation=15"')
    .option('--settle', 'drop the figure onto the ground with the physics engine before rendering')
    .option('--title', 'draw the pose name above the figure')
    .option('--caption', 'draw the teaching cues below the figure')
    .option('--muscles', 'force the muscle layer on')
    .option('--no-muscles', 'force the muscle layer off')
    .option('--background <color>', 'background colour, or "none" for transparent')
    .option('--optimize', 'run the SVG through svgo')
    .option('--scale <px>', 'PNG output width in pixels (defaults to the canvas width)')
    .option('--lib <dir>', 'load poses from this directory instead of the bundled library');

export const registerRenderCommands = (program: Command): void => {
  withCommonOptions(
    program
      .command('render <pose>')
      .description('Render one pose (a .pose.yaml file, or a library id) to SVG or PNG')
      .requiredOption('-o, --out <file>', 'output path; the extension picks the format (.svg, .png, or .html showcase with embedded 3D viewer)'),
  ).action(async (ref: string, options: CommonOptions & { out: string }) => {
    const pose = await resolvePose(ref, options.lib);
    const skeleton = await solvePose(pose, options.settle === undefined ? {} : { settle: options.settle });

    if (extname(options.out).toLowerCase() === '.html') {
      const camera = options.camera === undefined ? undefined : { camera: resolveCamera(parseCamera(options.camera)) };
      await mkdir(dirname(options.out), { recursive: true });
      await writeFile(options.out, await buildShowcaseHtml([{ pose, skeleton }], camera ?? {}));
      process.stdout.write(`${options.out}\n`);
      return;
    }

    await write(options.out, renderSvg(pose, { ...renderOptionsFrom(options), skeleton }), options);
  });

  withCommonOptions(
    program
      .command('sheet [poses...]')
      .description('Render many poses into one contact sheet')
      .requiredOption('-o, --out <file>', 'output path (.svg or .png)')
      .option('-c, --columns <n>', 'columns in the grid', '6')
      .option('--sequence <id>', 'lay out a whole sequence in practice order')
      .option('--all', 'every pose in the library')
      .option('--sheet-title <text>', 'title printed across the top')
      .option('--numbered', 'number each cell'),
  ).action(
    async (
      refs: string[],
      options: CommonOptions & {
        out: string;
        columns: string;
        sequence?: string;
        all?: boolean;
        sheetTitle?: string;
        numbered?: boolean;
      },
    ) => {
      const lib = await library(options.lib);
      let poses: PoseSpec[];

      if (options.sequence !== undefined) {
        const sequence = lib.sequences.get(options.sequence);
        if (sequence === undefined) {
          throw new Error(`Unknown sequence "${options.sequence}". Known: ${[...lib.sequences.keys()].join(', ')}`);
        }
        poses = expandSequence(sequence, lib).map((step) => ({ ...step.pose, name: step.label }));
      } else if (options.all === true) {
        poses = [...lib.poses.values()];
      } else {
        poses = await Promise.all(refs.map((ref) => resolvePose(ref, options.lib)));
      }

      if (poses.length === 0) throw new Error('Nothing to render: pass pose ids, --all, or --sequence <id>');

      const settle = options.settle === undefined ? {} : { settle: options.settle };
      const skeletons = await Promise.all(poses.map((p) => solvePose(p, settle)));

      const sheetOptions: SheetOptions = {
        ...renderOptionsFrom(options),
        skeletons,
        columns: parseIntOption(options.columns, 'columns'),
        cellWidth: parseIntOption(options.width, 'width'),
        cellHeight: parseIntOption(options.height, 'height'),
        title: true,
        ...(options.sheetTitle === undefined ? {} : { sheetTitle: options.sheetTitle }),
        ...(options.numbered === undefined ? {} : { numbered: options.numbered }),
      };

      await write(options.out, renderSheet(poses, sheetOptions), options);
    },
  );

  withCommonOptions(
    program
      .command('sequence <id>')
      .description('Render every pose of a sequence into a directory, numbered in practice order')
      .requiredOption('-o, --out <dir>', 'output directory')
      .option('--format <ext>', 'svg or png', 'svg'),
  ).action(async (id: string, options: CommonOptions & { out: string; format: string }) => {
    const lib = await library(options.lib);
    const sequence = lib.sequences.get(id);
    if (sequence === undefined) {
      throw new Error(`Unknown sequence "${id}". Known: ${[...lib.sequences.keys()].join(', ')}`);
    }

    const steps = expandSequence(sequence, lib);
    const pad = String(steps.length).length;

    for (const [i, step] of steps.entries()) {
      const n = String(i + 1).padStart(pad, '0');
      const path = `${options.out}/${n}-${step.pose.id}${step.side === 'right' ? '-right' : ''}.${options.format}`;
      const skeleton = await solvePose(step.pose, options.settle === undefined ? {} : { settle: options.settle });
      await write(path, renderSvg({ ...step.pose, name: step.label }, { ...renderOptionsFrom(options), skeleton }), options);
    }
  });
};
