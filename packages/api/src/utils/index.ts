/**
 * CLI Parser Utilities
 * CLI 子进程解析工具导出
 */

export type {
  CliSpawnOptions,
  CliTransformer,
  ChildProcessLike,
  SpawnFn,
} from './cli-types.js';

export { parseNDJSON, isParseError } from './ndjson-parser.js';
export { spawnCli, isCliError, KILL_GRACE_MS } from './cli-spawn.js';
export type { CliSpawnerDeps } from './cli-spawn.js';
export { formatCliExitError } from './cli-format.js';
export { validateProjectPath, isUnderAllowedRoot } from './project-path.js';
