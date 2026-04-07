#!/usr/bin/env node

import { access } from 'node:fs/promises';

const cliUrl = new URL('../dist/cli.js', import.meta.url);

try {
  await access(cliUrl);
} catch {
  console.error(
    '[ppt-forge] CLI build artifact is missing. Run `pnpm install` or `pnpm --filter @cat-cafe/ppt-forge build` first.',
  );
  process.exit(1);
}

await import(cliUrl.href);
