/**
 * Capabilities Route
 * GET /api/capabilities — 发现每只猫的 skills 和外部 MCP 服务器
 *
 * 安全:
 * - 需要身份校验 (resolveUserId) — 暴露主机级 skills/MCP 元信息
 * - Skills 发现: Claude 项目级 .claude/skills/, Codex 用户级 ~/.codex/skills/
 * - MCP 发现: 项目 .mcp.json, Gemini ~/.gemini/settings.json
 */

import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { homedir } from 'os';
import type { FastifyPluginAsync } from 'fastify';
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

    const [claudeSkills, codexSkills, projectMcp, geminiMcp] = await Promise.all([
      listSubdirs(join(projectRoot, '.claude', 'skills')),
      listSubdirs(join(home, '.codex', 'skills'), ['.system']),
      readJsonKeys(join(projectRoot, '.mcp.json'), 'mcpServers'),
      readJsonKeys(join(home, '.gemini', 'settings.json'), 'mcpServers'),
    ]);

    const result: CapabilitiesResponse = {
      opus: {
        skills: claudeSkills,
        externalMcpServers: projectMcp,
      },
      codex: {
        skills: codexSkills,
        externalMcpServers: [],
      },
      gemini: {
        skills: [],
        externalMcpServers: geminiMcp,
      },
    };

    return result;
  });
};
