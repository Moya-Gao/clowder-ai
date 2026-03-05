import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function findMonorepoRoot(start = process.cwd()): string {
  let dir = resolve(start);
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = dirname(dir);
  }
  return resolve(start);
}
