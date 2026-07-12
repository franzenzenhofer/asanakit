#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { PoseParseError } from '../model/index.js';
import { registerExportCommands } from './commands/export.js';
import { registerInfoCommands } from './commands/info.js';
import { registerRenderCommands } from './commands/render.js';
import { registerViewCommands } from './commands/view.js';

// Both dist/cli/index.js and src/cli/index.ts sit two levels below the root.
const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

const program = new Command();

program
  .name('asanakit')
  .description('Programmatic stick-figure and body-posture visualization for yoga and surf, in 2D and 3D.')
  .version(pkg.version)
  .showHelpAfterError();

registerRenderCommands(program);
registerInfoCommands(program);
registerExportCommands(program);
registerViewCommands(program);

const fail = (error: unknown): never => {
  if (error instanceof PoseParseError) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write(`asanakit: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exit(1);
};

try {
  await program.parseAsync(process.argv);
} catch (error) {
  fail(error);
}
