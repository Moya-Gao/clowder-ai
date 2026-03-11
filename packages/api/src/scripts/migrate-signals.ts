import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatMigrateSignalsSummary,
  parseMigrateSignalsArgs,
  runMigrateSignalsCli,
  type MigrateSignalsCliArgs,
  type MigrateSignalsCliIo,
  type MigrateSignalsSummary,
} from './migrate-signals/cli.js';

export {
  formatMigrateSignalsSummary,
  parseMigrateSignalsArgs,
  runMigrateSignalsCli,
  type MigrateSignalsCliArgs,
  type MigrateSignalsCliIo,
  type MigrateSignalsSummary,
};

async function main(): Promise<void> {
  const code = await runMigrateSignalsCli(process.argv.slice(2), console);
  if (code !== 0) {
    process.exitCode = code;
  }
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (entryPath.length > 0 && entryPath === fileURLToPath(import.meta.url)) {
  main();
}
