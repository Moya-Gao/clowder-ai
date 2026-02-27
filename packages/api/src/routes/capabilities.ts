/**
 * Capabilities Route — F041 统一能力看板 API
 *
 * GET  /api/capabilities — 返回看板聚合视图 (CapabilityBoardItem[])
 * PATCH /api/capabilities — 开关单个能力 (global or per-cat override)
 *
 * 安全:
 * - 需要身份校验 (resolveUserId)
 * - Skills 发现: Claude .claude/skills/, Codex ~/.codex/skills/, Gemini ~/.gemini/skills/
 * - MCP 发现: 从 .cat-cafe/capabilities.json 读取（唯一真相源）
 */

import { readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import type { FastifyPluginAsync } from 'fastify';
import { catRegistry } from '@cat-cafe/shared';
import type {
  CapabilityBoardItem,
  CapabilityPatchRequest,
} from '@cat-cafe/shared';
import { resolveUserId } from '../utils/request-identity.js';
import {
  readCapabilitiesConfig,
  writeCapabilitiesConfig,
  bootstrapCapabilities,
  resolveServersForCat,
  generateCliConfigs,
} from '../config/capabilities/capability-orchestrator.js';

// ────────── Helpers ──────────

/**
 * Returns subdirectory names.
 * - ENOENT (dir missing) → [] (normal — not all providers have skill dirs)
 * - Other errors (EACCES, EIO) → null (real scan failure — unsafe to prune)
 */
async function listSubdirs(dir: string, exclude?: string[]): Promise<string[] | null> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && !(exclude ?? []).includes(e.name))
      .map((e) => e.name);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ENOENT') {
      return [];
    }
    return null;
  }
}

/** Walk up from CWD to find pnpm-workspace.yaml — the monorepo root. */
function findMonorepoRoot(): string {
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findMonorepoRoot();

function getProjectRoot(): string {
  return PROJECT_ROOT;
}

/**
 * P1-1 fix: All CLI config paths are project-level (not user-level).
 * This ensures multi-project isolation — different projects have different configs.
 */
function getDiscoveryPaths(projectRoot: string) {
  return {
    claudeConfig: join(projectRoot, '.mcp.json'),
    codexConfig: join(projectRoot, '.codex', 'config.toml'),
    geminiConfig: join(projectRoot, '.gemini', 'settings.json'),
  };
}

function getCliConfigPaths(projectRoot: string) {
  return {
    anthropic: join(projectRoot, '.mcp.json'),
    openai: join(projectRoot, '.codex', 'config.toml'),
    google: join(projectRoot, '.gemini', 'settings.json'),
  };
}

// ────────── Route Plugin ──────────

export const capabilitiesRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /api/capabilities ──
  app.get('/api/capabilities', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }

    const projectRoot = getProjectRoot();
    const home = homedir();

    // 1. Load or bootstrap capabilities.json
    let config = await readCapabilitiesConfig(projectRoot);
    if (!config) {
      config = await bootstrapCapabilities(projectRoot, getDiscoveryPaths(projectRoot));
      // Cloud P1-1: bootstrap must also generate CLI configs, otherwise
      // first invocations with mcpSupport=true have no native MCP configs
      await generateCliConfigs(config, getCliConfigPaths(projectRoot));
    }

    // 2. Discover skills (filesystem scan — separate from MCP)
    // null = scan failed (readdir error); [] = directory exists but empty
    const [claudeProjectSkills, claudeUserSkills, codexSkills, geminiSkills] = await Promise.all([
      listSubdirs(join(projectRoot, '.claude', 'skills')),
      listSubdirs(join(home, '.claude', 'skills')),
      listSubdirs(join(home, '.codex', 'skills'), ['.system']),
      listSubdirs(join(home, '.gemini', 'skills')),
    ]);

    const allScansOk = claudeProjectSkills !== null && claudeUserSkills !== null
      && codexSkills !== null && geminiSkills !== null;

    const providerSkills: Record<string, string[]> = {
      anthropic: [...new Set([...(claudeProjectSkills ?? []), ...(claudeUserSkills ?? [])])],
      openai: codexSkills ?? [],
      google: geminiSkills ?? [],
    };

    // 3. Sync discovered skills into capabilities.json
    const allSkillNames = new Set<string>();
    for (const skills of Object.values(providerSkills)) {
      for (const s of skills) allSkillNames.add(s);
    }

    let configDirty = false;
    // Add newly discovered skills
    for (const skillName of allSkillNames) {
      const exists = config.capabilities.some((c) => c.type === 'skill' && c.id === skillName);
      if (!exists) {
        config.capabilities.push({
          id: skillName,
          type: 'skill',
          enabled: true,
          source: 'external',
        });
        configDirty = true;
      }
    }
    // Prune stale skills no longer on filesystem.
    // Guard: only prune when ALL provider scans succeeded (no null returns).
    // ENOENT (dir missing) returns [] and is safe; only real I/O errors block prune.
    // No size guard: 0 discovered skills + all scans ok = user deleted all → prune all stale.
    if (allScansOk) {
      const before = config.capabilities.length;
      config.capabilities = config.capabilities.filter(
        (c) => c.type !== 'skill' || allSkillNames.has(c.id),
      );
      if (config.capabilities.length !== before) configDirty = true;
    }

    if (configDirty) {
      await writeCapabilitiesConfig(projectRoot, config);
    }

    // 4. Build board items from capabilities.json
    const catIds = catRegistry.getAllIds().map((id) => id as string);
    const items: CapabilityBoardItem[] = [];

    // MCP capabilities
    for (const cap of config.capabilities) {
      if (cap.type !== 'mcp') continue;
      const cats: Record<string, boolean> = {};
      for (const catId of catIds) {
        const servers = resolveServersForCat(config, catId);
        const server = servers.find((s) => s.name === cap.id);
        cats[catId] = server?.enabled ?? false;
      }
      items.push({
        id: cap.id,
        type: 'mcp',
        source: cap.source,
        enabled: cap.enabled,
        cats,
      });
    }

    // Skill capabilities (from capabilities.json, presence from filesystem)
    for (const cap of config.capabilities) {
      if (cap.type !== 'skill') continue;
      const cats: Record<string, boolean> = {};
      for (const catId of catIds) {
        const entry = catRegistry.tryGet(catId);
        const provider = entry?.config.provider ?? 'unknown';
        const presentForProvider = (providerSkills[provider] ?? []).includes(cap.id);
        if (!presentForProvider) continue; // Sparse cats: omit irrelevant cats so frontend filter works
        const override = cap.overrides?.find((o) => o.catId === catId);
        const enabled = override ? override.enabled : cap.enabled;
        cats[catId] = enabled;
      }
      items.push({
        id: cap.id,
        type: 'skill',
        source: cap.source,
        enabled: cap.enabled,
        cats,
      });
    }

    return items;
  });

  // ── PATCH /api/capabilities ──
  app.patch('/api/capabilities', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }

    const body = request.body as CapabilityPatchRequest | undefined;
    if (
      !body || !body.capabilityId || !body.capabilityType ||
      !body.scope || typeof body.enabled !== 'boolean'
    ) {
      reply.status(400);
      return { error: 'Required: capabilityId, capabilityType (mcp|skill), scope (global|cat), enabled (boolean)' };
    }

    if (body.scope === 'cat' && !body.catId) {
      reply.status(400);
      return { error: 'catId required when scope is "cat"' };
    }

    const projectRoot = getProjectRoot();

    let config = await readCapabilitiesConfig(projectRoot);
    if (!config) {
      reply.status(404);
      return { error: 'capabilities.json not found. Run GET first to bootstrap.' };
    }

    // Compound lookup: id + type disambiguates same-name MCP/skill entries
    const capIndex = config.capabilities.findIndex(
      (c) => c.id === body.capabilityId && c.type === body.capabilityType,
    );
    if (capIndex === -1) {
      reply.status(404);
      return { error: `Capability "${body.capabilityId}" (type=${body.capabilityType}) not found` };
    }

    const cap = config.capabilities[capIndex]!;

    if (body.scope === 'global') {
      cap.enabled = body.enabled;
    } else {
      // Per-cat override
      if (!cap.overrides) cap.overrides = [];
      const existing = cap.overrides.find((o) => o.catId === body.catId!);
      if (existing) {
        existing.enabled = body.enabled;
      } else {
        cap.overrides.push({ catId: body.catId!, enabled: body.enabled });
      }
      // Clean up: remove override if it matches global (no-op override)
      if (body.enabled === cap.enabled) {
        cap.overrides = cap.overrides.filter((o) => o.catId !== body.catId!);
        if (cap.overrides.length === 0) delete cap.overrides;
      }
    }

    // Persist and regenerate CLI configs
    await writeCapabilitiesConfig(projectRoot, config);
    await generateCliConfigs(config, getCliConfigPaths(projectRoot));

    return { ok: true, capability: cap };
  });
};
