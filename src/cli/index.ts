#!/usr/bin/env node
import { Command } from 'commander';
import { PoseParseError } from '../model/index.js';
import { registerExportCommands } from './commands/export.js';
import { registerInfoCommands } from './commands/info.js';
import { registerRenderCommands } from './commands/render.js';

const program = new Command();

program
  .name('posekit')
  .description('Programmatic stick-figure and anatomical infographics for yoga and surf postures.')
  .version('0.1.0')
  .showHelpAfterError();

registerRenderCommands(program);
registerInfoCommands(program);
registerExportCommands(program);

const fail = (error: unknown): never => {
  if (error instanceof PoseParseError) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write(`posekit: ${error instanceof Error ? error.message : String(error)}\n`);
  }
  process.exit(1);
};

try {
  await program.parseAsync(process.argv);
} catch (error) {
  fail(error);
}
