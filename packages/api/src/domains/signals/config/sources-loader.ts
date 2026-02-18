import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { SignalSourceConfig } from '@cat-cafe/shared';
import { SignalSourceConfigSchema } from '@cat-cafe/shared';
import { parse, stringify } from 'yaml';
import { DEFAULT_SIGNAL_SOURCES } from './default-sources.js';
import type { SignalPaths } from './signal-paths.js';
import { resolveSignalPaths } from './signal-paths.js';

const SOURCE_FILE_BANNER = '# Cat Cafe Signal Hunter sources config\n';

function toYaml(config: SignalSourceConfig): string {
  return `${SOURCE_FILE_BANNER}${stringify(config)}`;
}

async function writeDefaultSourcesFile(paths: SignalPaths): Promise<void> {
  await writeFile(paths.sourcesFile, toYaml(DEFAULT_SIGNAL_SOURCES), 'utf-8');
}

export async function ensureSignalWorkspace(paths: SignalPaths = resolveSignalPaths()): Promise<void> {
  await mkdir(paths.rootDir, { recursive: true });
  await mkdir(paths.configDir, { recursive: true });
  await mkdir(paths.libraryDir, { recursive: true });
  await mkdir(paths.inboxDir, { recursive: true });
  await mkdir(paths.logsDir, { recursive: true });

  if (!existsSync(paths.sourcesFile)) {
    await writeDefaultSourcesFile(paths);
  }
}

function parseAndValidateSources(yamlText: string): SignalSourceConfig {
  const parsed = parse(yamlText) as unknown;
  const result = SignalSourceConfigSchema.safeParse(parsed);

  if (!result.success) {
    const detail = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid signal sources config: ${detail}`);
  }

  return result.data as SignalSourceConfig;
}

export async function loadSignalSources(paths: SignalPaths = resolveSignalPaths()): Promise<SignalSourceConfig> {
  await ensureSignalWorkspace(paths);

  const yamlText = await readFile(paths.sourcesFile, 'utf-8');
  if (yamlText.trim().length === 0) {
    await writeDefaultSourcesFile(paths);
    return DEFAULT_SIGNAL_SOURCES;
  }

  return parseAndValidateSources(yamlText);
}

export { resolveSignalPaths };
export type { SignalPaths };
