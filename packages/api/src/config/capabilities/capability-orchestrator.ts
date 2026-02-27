/**
 * Capability Orchestrator — F041 配置编排器
 *
 * 读取 `.cat-cafe/capabilities.json` 唯一真相源，
 * 结合 catRegistry 的 provider 映射，
 * 生成三猫 CLI 的 MCP 配置文件。
 *
 * 首次运行时自动从现有 CLI 配置中发现外部 MCP 服务器，
 * 连同 Cat Cafe 自有 MCP 一起写入 capabilities.json。
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, relative, sep } from 'path';
import type {
  CapabilitiesConfig,
  CapabilityEntry,
  McpServerDescriptor,
} from '@cat-cafe/shared';
import { catRegistry } from '@cat-cafe/shared';
import {
  readClaudeMcpConfig,
  readCodexMcpConfig,
  readGeminiMcpConfig,
  writeClaudeMcpConfig,
  writeCodexMcpConfig,
  writeGeminiMcpConfig,
} from './mcp-config-adapters.js';

// ────────── Constants ──────────

const CAPABILITIES_FILENAME = 'capabilities.json';
const CAT_CAFE_DIR = '.cat-cafe';

/** Provider → CLI config writer mapping */
const PROVIDER_WRITERS = {
  anthropic: writeClaudeMcpConfig,
  openai: writeCodexMcpConfig,
  google: writeGeminiMcpConfig,
} as const;

// ────────── Core: Read / Write capabilities.json ──────────

/** Normalize and validate that a path stays within the project tree. */
function safePath(projectRoot: string, ...segments: string[]): string {
  const root = resolve(projectRoot);
  const normalized = resolve(root, ...segments);
  const rel = relative(root, normalized);
  if (rel.startsWith(`..${sep}`) || rel === '..') {
    throw new Error(`Path escapes project root: ${normalized}`);
  }
  return normalized;
}

export async function readCapabilitiesConfig(
  projectRoot: string,
): Promise<CapabilitiesConfig | null> {
  const filePath = safePath(projectRoot, CAT_CAFE_DIR, CAPABILITIES_FILENAME);
  try {
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw) as CapabilitiesConfig;
    if (data.version !== 1 || !Array.isArray(data.capabilities)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function writeCapabilitiesConfig(
  projectRoot: string,
  config: CapabilitiesConfig,
): Promise<void> {
  const dir = safePath(projectRoot, CAT_CAFE_DIR);
  await mkdir(dir, { recursive: true });
  const filePath = safePath(projectRoot, CAT_CAFE_DIR, CAPABILITIES_FILENAME);
  await writeFile(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

// ────────── Discovery: Bootstrap from existing CLI configs ──────────

export interface DiscoveryPaths {
  claudeConfig: string;   // e.g. <projectRoot>/.mcp.json
  codexConfig: string;    // e.g. <projectRoot>/.codex/config.toml
  geminiConfig: string;   // e.g. <projectRoot>/.gemini/settings.json
}

/**
 * Discover external MCP servers from all 3 CLI configs.
 * Merges by name; if same name appears in multiple, first wins.
 */
export async function discoverExternalMcpServers(
  paths: DiscoveryPaths,
): Promise<McpServerDescriptor[]> {
  const [claude, codex, gemini] = await Promise.all([
    readClaudeMcpConfig(paths.claudeConfig),
    readCodexMcpConfig(paths.codexConfig),
    readGeminiMcpConfig(paths.geminiConfig),
  ]);

  const seen = new Set<string>();
  const result: McpServerDescriptor[] = [];

  for (const server of [...claude, ...codex, ...gemini]) {
    if (!seen.has(server.name)) {
      seen.add(server.name);
      result.push({ ...server, source: 'external' });
    }
  }
  return result;
}

/**
 * Build the Cat Cafe own MCP server descriptor.
 * Uses the same resolution logic as ClaudeAgentService.
 */
export function buildCatCafeMcpDescriptor(
  projectRoot: string,
): McpServerDescriptor {
  const serverPath = resolve(projectRoot, 'packages/mcp-server/dist/index.js');
  return {
    name: 'cat-cafe',
    command: 'node',
    args: [serverPath],
    enabled: true,
    source: 'cat-cafe',
  };
}

// ────────── Bootstrap: Create initial capabilities.json ──────────

/**
 * Bootstrap capabilities.json from discovery.
 * Called once on first run (when capabilities.json doesn't exist).
 */
export async function bootstrapCapabilities(
  projectRoot: string,
  discoveryPaths: DiscoveryPaths,
): Promise<CapabilitiesConfig> {
  const catCafe = buildCatCafeMcpDescriptor(projectRoot);
  const externals = await discoverExternalMcpServers(discoveryPaths);

  const capabilities: CapabilityEntry[] = [];

  // Add Cat Cafe's own MCP
  capabilities.push({
    id: catCafe.name,
    type: 'mcp',
    enabled: true,
    source: 'cat-cafe',
    mcpServer: {
      command: catCafe.command,
      args: catCafe.args,
    },
  });

  // Add discovered external MCP servers
  for (const ext of externals) {
    // Skip cat-cafe if already discovered from existing config
    if (ext.name === 'cat-cafe') continue;
    const entry: CapabilityEntry = {
      id: ext.name,
      type: 'mcp',
      enabled: ext.enabled,
      source: 'external',
      mcpServer: { command: ext.command, args: ext.args },
    };
    if (ext.env) entry.mcpServer!.env = ext.env;
    if (ext.workingDir) entry.mcpServer!.workingDir = ext.workingDir;
    capabilities.push(entry);
  }

  const config: CapabilitiesConfig = { version: 1, capabilities };
  await writeCapabilitiesConfig(projectRoot, config);
  return config;
}

// ────────── Orchestrate: Generate CLI configs from capabilities.json ──────────

/** Provider → config file path mapping */
export interface CliConfigPaths {
  anthropic: string;   // e.g. <projectRoot>/.mcp.json
  openai: string;      // e.g. <projectRoot>/.codex/config.toml
  google: string;      // e.g. <projectRoot>/.gemini/settings.json
}

/**
 * Resolve effective MCP servers for a specific cat.
 * Applies global enabled + per-cat overrides.
 */
export function resolveServersForCat(
  config: CapabilitiesConfig,
  catId: string,
): McpServerDescriptor[] {
  return config.capabilities
    .filter((cap) => cap.type === 'mcp' && cap.mcpServer)
    .map((cap) => {
      // Resolve effective enabled: global + per-cat override
      const override = cap.overrides?.find((o) => o.catId === catId);
      const enabled = override ? override.enabled : cap.enabled;

      const desc: McpServerDescriptor = {
        name: cap.id,
        command: cap.mcpServer!.command,
        args: cap.mcpServer!.args,
        enabled,
        source: cap.source,
      };
      if (cap.mcpServer!.env) desc.env = cap.mcpServer!.env;
      if (cap.mcpServer!.workingDir) desc.workingDir = cap.mcpServer!.workingDir;
      return desc;
    });
}

/**
 * Group cats by provider, collecting the union of servers each provider needs.
 * A server is included for a provider if ANY cat of that provider has it enabled.
 */
function collectServersPerProvider(
  config: CapabilitiesConfig,
): Record<string, McpServerDescriptor[]> {
  const providerServers: Record<string, Map<string, McpServerDescriptor>> = {};

  for (const catId of catRegistry.getAllIds()) {
    const entry = catRegistry.tryGet(catId as string);
    if (!entry) continue;
    const provider = entry.config.provider;

    if (!providerServers[provider]) {
      providerServers[provider] = new Map();
    }

    const servers = resolveServersForCat(config, catId as string);
    for (const s of servers) {
      // If any cat of this provider has it enabled, it's enabled for the provider
      const existing = providerServers[provider].get(s.name);
      if (!existing || (s.enabled && !existing.enabled)) {
        providerServers[provider].set(s.name, s);
      }
    }
  }

  const result: Record<string, McpServerDescriptor[]> = {};
  for (const [provider, serverMap] of Object.entries(providerServers)) {
    result[provider] = Array.from(serverMap.values());
  }
  return result;
}

/**
 * Generate all 3 CLI config files from capabilities.json.
 *
 * This is the main orchestration entry point:
 * capabilities.json → resolve per-provider → write CLI configs
 */
export async function generateCliConfigs(
  config: CapabilitiesConfig,
  paths: CliConfigPaths,
): Promise<void> {
  const perProvider = collectServersPerProvider(config);

  const writes: Promise<void>[] = [];
  for (const [provider, servers] of Object.entries(perProvider)) {
    const writer = PROVIDER_WRITERS[provider as keyof typeof PROVIDER_WRITERS];
    const path = paths[provider as keyof CliConfigPaths];
    if (writer && path) {
      writes.push(writer(path, servers));
    }
  }

  await Promise.all(writes);
}

/**
 * Full orchestration flow:
 * 1. Read or bootstrap capabilities.json
 * 2. Generate CLI configs
 */
export async function orchestrate(
  projectRoot: string,
  discoveryPaths: DiscoveryPaths,
  cliConfigPaths: CliConfigPaths,
): Promise<CapabilitiesConfig> {
  let config = await readCapabilitiesConfig(projectRoot);
  if (!config) {
    config = await bootstrapCapabilities(projectRoot, discoveryPaths);
  }
  await generateCliConfigs(config, cliConfigPaths);
  return config;
}
