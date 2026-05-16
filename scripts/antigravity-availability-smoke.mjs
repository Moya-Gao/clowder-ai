#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseAntigravitySmokeArgs } from './antigravity-smoke/cli.mjs';
import { makeReport } from './antigravity-smoke/core.mjs';
import { runAntigravityAvailabilitySmoke } from './antigravity-smoke/runner.mjs';

export { parseAntigravitySmokeArgs } from './antigravity-smoke/cli.mjs';
export { runAntigravityAvailabilitySmoke } from './antigravity-smoke/runner.mjs';

function writeReportIfRequested(outputJson, report) {
  if (!outputJson) return;
  const outputPath = resolve(outputJson);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseAntigravitySmokeArgs(argv);
  const report = await runAntigravityAvailabilitySmoke(args);
  writeReportIfRequested(args.outputJson, report);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

function reportCliException(err) {
  const report = makeReport({
    ok: false,
    mode: 'readonly',
    stage: 'exception',
    diagnostics: { error: err instanceof Error ? err.message : String(err) },
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === pathToFileURL(currentFile).href) {
  main().then(undefined, reportCliException);
}
