/**
 * Capabilities Route
 * GET /api/capabilities — 发现每只猫的 skills 和外部 MCP 服务器
 *
 * 安全:
 * - 需要身份校验 (resolveUserId) — 暴露主机级 skills/MCP 元信息
 * - Skills 发现: Claude 项目级 .claude/skills/ + 用户级 ~/.claude/skills/, Codex 用户级 ~/.codex/skills/
 * - MCP 发现: 项目 .mcp.json, Gemini ~/.gemini/settings.json
 */

import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';
import type { FastifyPluginAsync } from 'fastify';
import { catRegistry } from '@cat-cafe/shared';
import { resolveUserId } from '../utils/request-identity.js';

interface CatCapabilities {
  skills: string[];
  externalMcpServers: string[];
}

type CapabilitiesResponse = Record<string, CatCapabilities>;

async function listSubdirs(dir: string, exclude?: string[]): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && !(exclude ?? []).includes(e.name))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

async function readJsonKeys(filePath: string, key: string): Promise<string[]> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    const section = data[key];
    if (section && typeof section === 'object') return Object.keys(section);
    return [];
  } catch {
    return [];
  }
}

export const capabilitiesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/capabilities', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }
    // Project root is 2 levels up from packages/api (process.cwd())
    const projectRoot = resolve(process.cwd(), '../..');
    const home = homedir();

    const [claudeProjectSkills, claudeUserSkills, codexSkills, geminiSkills, projectMcp, geminiMcp] = await Promise.all([
      listSubdirs(join(projectRoot, '.claude', 'skills')),
      listSubdirs(join(home, '.claude', 'skills')),
      listSubdirs(join(home, '.codex', 'skills'), ['.system']),
      listSubdirs(join(home, '.gemini', 'skills')),
      readJsonKeys(join(projectRoot, '.mcp.json'), 'mcpServers'),
      readJsonKeys(join(home, '.gemini', 'settings.json'), 'mcpServers'),
    ]);

    // Claude skills: merge project-level + user-level, deduplicate
    const claudeSkills = [...new Set([...claudeProjectSkills, ...claudeUserSkills])];

    // F32-a: provider-based capability mapping for built-in + dynamic cats
    const providerCapabilities: Record<string, CatCapabilities> = {
      anthropic: { skills: claudeSkills, externalMcpServers: projectMcp },
      openai: { skills: codexSkills, externalMcpServers: [] },
      google: { skills: geminiSkills, externalMcpServers: geminiMcp },
    };

    const result: CapabilitiesResponse = {};
    for (const id of catRegistry.getAllIds()) {
      const entry = catRegistry.tryGet(id as string);
      const provider = entry?.config.provider ?? 'unknown';
      result[id as string] = providerCapabilities[provider] ?? { skills: [], externalMcpServers: [] };
    }

    return result;
  });
};
