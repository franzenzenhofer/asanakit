import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { MUSCLES, MUSCLE_IDS } from '../../anatomy/muscles.js';
import { validatePose } from '../../anatomy/validate.js';
import { CAMERA_PRESET_IDS } from '../../core/camera.js';
import { BONE_IDS, LANDMARK_IDS } from '../../core/types.js';
import { parsePose, poseJsonSchema, sequenceJsonSchema } from '../../model/index.js';
import { STYLES, STYLE_IDS } from '../../render/index.js';
import { library, resolvePose } from '../resolve.js';

const json = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

export const registerInfoCommands = (program: Command): void => {
  program
    .command('list')
    .description('List the poses and sequences in the library')
    .option('-d, --discipline <name>', 'filter by discipline (yoga, surf, other)')
    .option('--json', 'machine-readable output')
    .option('--lib <dir>', 'load poses from this directory')
    .action(async (options: { discipline?: string; json?: boolean; lib?: string }) => {
      const lib = await library(options.lib);
      const poses = [...lib.poses.values()].filter(
        (p) => options.discipline === undefined || p.discipline === options.discipline,
      );

      if (options.json === true) {
        json({
          poses: poses.map((p) => ({
            id: p.id,
            name: p.name,
            sanskrit: p.sanskrit,
            discipline: p.discipline,
            family: p.family,
            difficulty: p.difficulty,
            tags: p.tags,
          })),
          sequences: [...lib.sequences.values()].map((s) => ({
            id: s.id,
            name: s.name,
            steps: s.sections.reduce((n, sec) => n + sec.steps.length, 0),
          })),
        });
        return;
      }

      for (const p of poses) {
        const sanskrit = p.sanskrit === undefined ? '' : `  ${p.sanskrit}`;
        process.stdout.write(`${p.id.padEnd(30)} ${p.name}${sanskrit}\n`);
      }
      for (const s of lib.sequences.values()) {
        const steps = s.sections.reduce((n, sec) => n + sec.steps.length, 0);
        process.stdout.write(`\nsequence: ${s.id} - ${s.name} (${steps} steps)\n`);
      }
    });

  program
    .command('validate <files...>')
    .description('Validate pose files; exits non-zero on the first problem')
    .action(async (files: string[]) => {
      for (const file of files) {
        const pose = parsePose(await readFile(file, 'utf8'), file);
        process.stdout.write(`ok  ${file}  (${pose.id})\n`);
      }
    });

  program
    .command('lint [poses...]')
    .description('Check poses against the limits of a real body; defaults to the whole library')
    .option('--lib <dir>', 'load poses from this directory')
    .action(async (refs: string[], options: { lib?: string }) => {
      const lib = await library(options.lib);
      const targets = refs.length === 0 ? [...lib.poses.values()] : await Promise.all(refs.map((r) => resolvePose(r, options.lib)));

      let failed = 0;
      for (const pose of targets) {
        const issues = validatePose(pose);
        if (issues.length === 0) {
          process.stdout.write(`ok    ${pose.id}\n`);
          continue;
        }
        failed += 1;
        for (const issue of issues) process.stdout.write(`FAIL  ${pose.id}: ${issue.message}\n`);
      }

      process.stdout.write(`\n${targets.length - failed}/${targets.length} poses sound\n`);
      if (failed > 0) process.exitCode = 1;
    });

  program
    .command('schema [what]')
    .description('Print the JSON Schema for the pose or sequence format')
    .action((what = 'pose') => {
      if (what !== 'pose' && what !== 'sequence') throw new Error('schema takes "pose" or "sequence"');
      json(what === 'pose' ? poseJsonSchema() : sequenceJsonSchema());
    });

  program
    .command('vocab')
    .description('Print every joint, landmark, muscle and style name the format accepts')
    .action(() => {
      json({
        joints: BONE_IDS,
        jointAxes: ['flex', 'extend', 'abduct', 'adduct', 'twist', 'externalRotation', 'internalRotation'],
        landmarks: LANDMARK_IDS,
        muscles: MUSCLE_IDS.map((id) => ({ id, label: MUSCLES[id].label, region: MUSCLES[id].region })),
        styles: STYLE_IDS.map((id) => ({ id, label: STYLES[id].label })),
        cameras: CAMERA_PRESET_IDS,
      });
    });
};
