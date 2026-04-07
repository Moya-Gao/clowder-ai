/**
 * Resolves MCP server configs for ACP sessions from .mcp.json + whitelist.
 *
 * Reads the project-root .mcp.json (Claude CLI config with machine-resolved paths),
 * filters by the cat's mcpWhitelist, and converts to AcpMcpServerStdio format.
 *
 * Fail-fast: throws when whitelist is non-empty but zero servers resolve,
 * preventing silent "ACP started but MCP not connected" failures.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createModuleLogger } from '../../../../../../infrastructure/logger.js';
import type { AcpMcpServer, AcpMcpServerStdio } from './types.js';

const log = createModuleLogger('acp-mcp-resolver');

interface McpJsonEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Resolve MCP servers for an ACP session.
 * @param projectRoot — monorepo root containing .mcp.json
 * @param whitelist — server names from cat-config.json mcpWhitelist
 * @returns AcpMcpServer[] ready for newSession()
 * @throws when whitelist is non-empty but zero servers could be resolved
 */
export function resolveAcpMcpServers(projectRoot: string, whitelist: string[]): AcpMcpServer[] {
  if (!whitelist.length) return [];

  const mcpJsonPath = join(projectRoot, '.mcp.json');
  let raw: { mcpServers?: Record<string, McpJsonEntry> };
  try {
    raw = JSON.parse(readFileSync(mcpJsonPath, 'utf-8')) as typeof raw;
  } catch (err) {
    throw new Error(
      `Cannot read ${mcpJsonPath}: ${err instanceof Error ? err.message : String(err)}. ` +
        `ACP MCP passthrough requires .mcp.json with mcpServers entries matching whitelist [${whitelist.join(', ')}].`,
    );
  }

  if (!raw.mcpServers) {
    throw new Error(`.mcp.json has no mcpServers key. ACP whitelist [${whitelist.join(', ')}] cannot be resolved.`);
  }

  const servers: AcpMcpServer[] = [];
  const missing: string[] = [];
  for (const name of whitelist) {
    const entry = raw.mcpServers[name];
    if (!entry) {
      missing.push(name);
      continue;
    }
    const stdio: AcpMcpServerStdio = {
      name,
      command: entry.command,
      args: entry.args ?? [],
      env: entry.env ? Object.entries(entry.env).map(([k, v]) => ({ name: k, value: v })) : [],
    };
    servers.push(stdio);
  }

  if (missing.length > 0) {
    log.error(
      { missing, resolved: servers.map((s) => s.name) },
      'MCP whitelist entries not found in .mcp.json — these servers will NOT be available to ACP agent',
    );
  }

  if (servers.length === 0) {
    throw new Error(
      `All ${whitelist.length} MCP whitelist entries [${whitelist.join(', ')}] are missing from .mcp.json. ` +
        'ACP agent would start with zero MCP servers — aborting to prevent silent tool-call stalls.',
    );
  }

  log.info({ count: servers.length, names: servers.map((s) => s.name), missing }, 'Resolved MCP servers for ACP');
  return servers;
}
