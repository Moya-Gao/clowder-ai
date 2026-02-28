/**
 * Capabilities Route — F041 统一能力看板 API
 *
 * GET  /api/capabilities — 返回看板聚合视图 (CapabilityBoardResponse)
 * PATCH /api/capabilities — 开关单个能力 (global or per-cat override)
 *
 * F041 Re-open fixes:
 * - Skill descriptions from SKILL.md frontmatter
 * - Source classification: project-level skills → 'cat-cafe'
 * - Cat family grouping metadata for frontend
 */

import { lstat, readdir, readFile, readlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { FastifyPluginAsync } from 'fastify';
import { catRegistry } from '@cat-cafe/shared';
import type {
  CapabilityBoardItem,
  CapabilityBoardResponse,
  CapabilityPatchRequest,
  CatFamily,
  SkillHealthSummary,
} from '@cat-cafe/shared';
import { resolveUserId } from '../utils/request-identity.js';
import { validateProjectPath } from '../utils/project-path.js';
import {
  readCapabilitiesConfig,
  writeCapabilitiesConfig,
  bootstrapCapabilities,
  resolveServersForCat,
  generateCliConfigs,
  discoverExternalMcpServers,
  type DiscoveryPaths,
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

/** Check if a symlink at `linkPath` points to `expectedTarget`. */
async function isCorrectSymlink(linkPath: string, expectedTarget: string): Promise<boolean> {
  try {
    const stat = await lstat(linkPath);
    if (!stat.isSymbolicLink()) return false;
    const dest = await readlink(linkPath);
    return dest.replace(/\/$/, '') === expectedTarget;
  } catch {
    return false;
  }
}

const execFileAsync = promisify(execFile);

/**
 * Resolve canonical main repo path (not worktree path).
 * Symlinks point to the main repo, so mount checks must use main repo path.
 */
let cachedMainRepoPath: string | null = null;
let cachedMainRepoPathPromise: Promise<string> | null = null;
async function resolveMainRepoPath(): Promise<string> {
  if (cachedMainRepoPath) return cachedMainRepoPath;
  if (cachedMainRepoPathPromise) return cachedMainRepoPathPromise;
  cachedMainRepoPathPromise = (async () => {
  try {
    const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain']);
    const firstLine = stdout.split('\n')[0] ?? '';
    return firstLine.replace(/^worktree\s+/, '').trim();
  } catch {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel']);
      return stdout.trim();
    } catch {
      return resolve(process.cwd(), '../..');
    }
  }
  })().then((p) => {
    cachedMainRepoPath = p;
    return p;
  });
  return cachedMainRepoPathPromise;
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

interface SkillMeta {
  description?: string;
  triggers?: string[];
}

/**
 * Extract description + triggers from a SKILL.md frontmatter.
 * Triggers are embedded in descriptions:
 *   'Triggers on "X", "Y", "Z"' or '触发词："X"、"Y"'
 */
async function readSkillMeta(skillDir: string): Promise<SkillMeta> {
  const skillMdPath = join(skillDir, 'SKILL.md');
  try {
    const content = await readFile(skillMdPath, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    const descLine = match[1]!.split('\n').find((line) => line.startsWith('description:'));
    if (!descLine) return {};
    let desc = descLine.replace(/^description:\s*/, '').trim();
    if ((desc.startsWith('"') && desc.endsWith('"')) || (desc.startsWith("'") && desc.endsWith("'"))) {
      desc = desc.slice(1, -1);
    }
    if (!desc) return {};

    // Extract triggers from description text
    const triggers: string[] = [];
    // English: Triggers on "X", "Y", "Z"
    const enMatch = desc.match(/[Tt]riggers?\s+on\s+"([^"]+)"(,\s*"([^"]+)")*/);
    if (enMatch) {
      const allQuoted = desc.match(/[Tt]riggers?\s+on\s+(.*)/);
      if (allQuoted) {
        for (const m of allQuoted[1]!.matchAll(/"([^"]+)"/g)) {
          triggers.push(m[1]!);
        }
      }
    }
    // Chinese: 触发词："X"、"Y" or 触发词：X、Y
    const cnMatch = desc.match(/触发词[：:]\s*(.*)/);
    if (cnMatch) {
      const raw = cnMatch[1]!;
      // Quoted: "X"、"Y"
      for (const m of raw.matchAll(/["""]([^"""]+)["""]/g)) {
        triggers.push(m[1]!);
      }
      // Unquoted fallback: X、Y、Z
      if (triggers.length === 0) {
        triggers.push(...raw.split(/[、,，]/).map((s) => s.trim()).filter(Boolean));
      }
    }

    // Clean description: strip trigger suffix for display
    let cleanDesc = desc
      .replace(/\s*[Tt]riggers?\s+on\s+.*$/, '')
      .replace(/\s*触发词[：:].*$/, '')
      .replace(/\.\s*$/, '')
      .trim();
    if (!cleanDesc) cleanDesc = desc;

    const result: SkillMeta = { description: cleanDesc };
    if (triggers.length > 0) result.triggers = triggers;
    return result;
  } catch {
    return {};
  }
}

/**
 * Parse BOOTSTRAP.md to extract skill → category mapping.
 * Categories come from ### headers, skills from table rows.
 */
async function parseBootstrapCategories(skillsSrcDir: string): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const bootstrapPath = join(skillsSrcDir, 'BOOTSTRAP.md');
  try {
    const content = await readFile(bootstrapPath, 'utf-8');
    let currentCategory = '';
    for (const line of content.split('\n')) {
      const categoryMatch = line.match(/^###\s+(.+)/);
      if (categoryMatch?.[1]) {
        currentCategory = categoryMatch[1].trim();
        continue;
      }
      const rowMatch = line.match(/^\|\s*`([a-z][-a-z0-9]*)`\s*\|/);
      if (rowMatch?.[1] && currentCategory) {
        result.set(rowMatch[1], currentCategory);
      }
    }
  } catch {
    // BOOTSTRAP.md not found — no categories
  }
  return result;
}

/** Known MCP server descriptions */
const MCP_DESCRIPTIONS: Record<string, string> = {
  'cat-cafe': '三猫协作工具 — 消息、上下文、任务、记忆、权限等',
};

/**
 * Build cat family grouping from catRegistry.
 * Groups catIds by breedId (e.g. ragdoll → [opus, opus-45, sonnet]).
 */
function buildCatFamilies(): CatFamily[] {
  const familyMap = new Map<string, { name: string; catIds: string[] }>();

  for (const catId of catRegistry.getAllIds()) {
    const entry = catRegistry.tryGet(catId as string);
    if (!entry) continue;
    const breedId = entry.config.breedId ?? 'unknown';
    const breedName = entry.config.breedDisplayName ?? breedId;

    let family = familyMap.get(breedId);
    if (!family) {
      family = { name: breedName, catIds: [] };
      familyMap.set(breedId, family);
    }
    family.catIds.push(catId as string);
  }

  return Array.from(familyMap.entries()).map(([id, f]) => ({
    id,
    name: f.name,
    catIds: f.catIds.sort(),
  }));
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

    // Multi-project: accept ?projectPath=... to manage capabilities for any project
    const query = request.query as { projectPath?: string };
    let projectRoot = getProjectRoot();
    if (query.projectPath) {
      const validated = await validateProjectPath(query.projectPath);
      if (!validated) {
        reply.status(400);
        return { error: 'Invalid project path: must be an existing directory under home' };
      }
      projectRoot = validated;
    }

    const home = homedir();

    // 1. Load or bootstrap capabilities.json
    let config = await readCapabilitiesConfig(projectRoot);
    if (!config) {
      // Multi-project: when bootstrapping a non-cat-cafe project, still point the
      // Cat Cafe MCP server to THIS repo (host), not the managed project root.
      config = await bootstrapCapabilities(projectRoot, getDiscoveryPaths(projectRoot), {
        catCafeRepoRoot: getProjectRoot(),
      });
      // Cloud P1-1: bootstrap must also generate CLI configs, otherwise
      // first invocations with mcpSupport=true have no native MCP configs
      await generateCliConfigs(config, getCliConfigPaths(projectRoot));
    }

    // 2. Discover skills (filesystem scan — separate from MCP)
    // null = scan failed (readdir error); [] = directory exists but empty
    const projectSkillsDir = join(projectRoot, '.claude', 'skills');
    const [claudeProjectSkills, claudeUserSkills, codexSkills, geminiSkills] = await Promise.all([
      listSubdirs(projectSkillsDir),
      listSubdirs(join(home, '.claude', 'skills')),
      listSubdirs(join(home, '.codex', 'skills'), ['.system']),
      listSubdirs(join(home, '.gemini', 'skills')),
    ]);

    // F041 bug fix: Also scan cat-cafe-skills/ for project-level skill detection.
    // User-level skills (e.g. ~/.claude/skills/feat-completion) are symlinks to
    // {projectRoot}/cat-cafe-skills/feat-completion — listing cat-cafe-skills/
    // captures them as project-owned regardless of symlink target.
    const catCafeSkillsDir = join(projectRoot, 'cat-cafe-skills');
    const catCafeOwnSkills = await listSubdirs(catCafeSkillsDir);
    const hasProjectCatCafeSkillsDir = existsSync(catCafeSkillsDir);

    const allScansOk = claudeProjectSkills !== null && claudeUserSkills !== null
      && codexSkills !== null && geminiSkills !== null;

    // F041 re-open: Track project-level skills for source classification
    // Includes both .claude/skills/ AND cat-cafe-skills/ entries
    const projectSkillNames = new Set([
      ...(claudeProjectSkills ?? []),
      ...(catCafeOwnSkills ?? []),
    ]);

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
    // Cloud P2: include source-only Cat Cafe skills (present in cat-cafe-skills/ but not mounted
    // into any provider directory yet) so mount health can detect missing mounts.
    if (catCafeOwnSkills !== null) {
      for (const s of catCafeOwnSkills) allSkillNames.add(s);
    }

    let configDirty = false;
    // Add newly discovered skills
    for (const skillName of allSkillNames) {
      const exists = config.capabilities.some((c) => c.type === 'skill' && c.id === skillName);
      if (!exists) {
        // F041 re-open fix: project-level skills → 'cat-cafe', user-level → 'external'
        const source = projectSkillNames.has(skillName) ? 'cat-cafe' as const : 'external' as const;
        config.capabilities.push({
          id: skillName,
          type: 'skill',
          enabled: true,
          source,
        });
        configDirty = true;
      }
    }
    // Also fix source for existing skills that were incorrectly classified
    for (const cap of config.capabilities) {
      if (cap.type !== 'skill') continue;
      const shouldBeCatCafe = projectSkillNames.has(cap.id);
      // Upgrade is safe when we have evidence; downgrade is only safe when cat-cafe-skills scan succeeded.
      if (shouldBeCatCafe && cap.source !== 'cat-cafe') {
        cap.source = 'cat-cafe';
        configDirty = true;
      } else if (
        !shouldBeCatCafe &&
        cap.source === 'cat-cafe' &&
        catCafeOwnSkills !== null &&
        claudeProjectSkills !== null
      ) {
        cap.source = 'external';
        configDirty = true;
      }
    }
    // Prune stale skills no longer on filesystem.
    // Guard: only prune when ALL provider scans succeeded (no null returns).
    if (allScansOk) {
      const before = config.capabilities.length;
      config.capabilities = config.capabilities.filter(
        (c) => c.type !== 'skill' || allSkillNames.has(c.id),
      );
      if (config.capabilities.length !== before) configDirty = true;
    }

    // F041 bug fix: Discover user-level MCP servers (not just project-level).
    // e.g. ~/.codex/config.toml has pencil, playwright, MCP_DOCKER etc.
    // Skip URL-based servers (command='') — TD104 gap.
    const userLevelPaths: DiscoveryPaths = {
      claudeConfig: join(home, '.claude', 'mcp.json'),
      codexConfig: join(home, '.codex', 'config.toml'),
      geminiConfig: join(home, '.gemini', 'settings.json'),
    };
    const userLevelServers = await discoverExternalMcpServers(userLevelPaths);
    for (const server of userLevelServers) {
      if (!server.command) continue; // Skip URL-based (TD104)
      const exists = config.capabilities.some(
        (c) => c.type === 'mcp' && c.id === server.name,
      );
      if (!exists) {
        const mcpServer: { command: string; args: string[]; env?: Record<string, string>; workingDir?: string } = {
          command: server.command,
          args: server.args,
        };
        if (server.env) mcpServer.env = server.env;
        if (server.workingDir) mcpServer.workingDir = server.workingDir;
        config.capabilities.push({
          id: server.name,
          type: 'mcp',
          enabled: server.enabled,
          source: 'external',
          mcpServer,
        });
        configDirty = true;
      }
    }

    if (configDirty) {
      await writeCapabilitiesConfig(projectRoot, config);
    }

    // 4. Build skill metadata lookup (description + triggers + category)
    // Categories + registration must be parsed from the SAME root used for mount checks.
    const mainRepo = await resolveMainRepoPath();
    const mainSkillsSrc = join(mainRepo, 'cat-cafe-skills');
    // Use dir existence (not skill count) to avoid treating existing-but-empty as "missing".
    const mountSkillsSrc = (catCafeOwnSkills !== null && hasProjectCatCafeSkillsDir)
      ? catCafeSkillsDir
      : mainSkillsSrc;

    const [skillCategoryMap] = await Promise.all([
      parseBootstrapCategories(mountSkillsSrc),
    ]);
    const skillMetaMap = new Map<string, SkillMeta>();

    const skillDirCandidates: { name: string; dir: string }[] = [];
    for (const name of allSkillNames) {
      skillDirCandidates.push({ name, dir: join(projectSkillsDir, name) });
      skillDirCandidates.push({ name, dir: join(home, '.claude', 'skills', name) });
      skillDirCandidates.push({ name, dir: join(home, '.codex', 'skills', name) });
      skillDirCandidates.push({ name, dir: join(home, '.gemini', 'skills', name) });
    }

    const metaResults = await Promise.all(
      skillDirCandidates.map(async ({ name, dir }) => ({
        name,
        meta: await readSkillMeta(dir),
      })),
    );
    for (const { name, meta } of metaResults) {
      if (meta.description && !skillMetaMap.has(name)) {
        skillMetaMap.set(name, meta);
      }
    }

    // 5. Build board items from capabilities.json
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
      const mcpItem: CapabilityBoardItem = {
        id: cap.id,
        type: 'mcp',
        source: cap.source,
        enabled: cap.enabled,
        cats,
      };
      const mcpDesc = MCP_DESCRIPTIONS[cap.id];
      if (mcpDesc) mcpItem.description = mcpDesc;
      items.push(mcpItem);
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
      const skillItem: CapabilityBoardItem = {
        id: cap.id,
        type: 'skill',
        source: cap.source,
        enabled: cap.enabled,
        cats,
      };
      const meta = skillMetaMap.get(cap.id);
      if (meta?.description) skillItem.description = meta.description;
      if (meta?.triggers) skillItem.triggers = meta.triggers;
      const category = skillCategoryMap.get(cap.id);
      if (category) skillItem.category = category;
      items.push(skillItem);
    }

    // 6. Mount health check for cat-cafe skills
    // Multi-project: validate mounts against the selected project's cat-cafe-skills
    // if it exists; otherwise fall back to host repo's cat-cafe-skills.

    const mountSourceNames = mountSkillsSrc === catCafeSkillsDir
      ? new Set(catCafeOwnSkills ?? [])
      : new Set((await listSubdirs(mountSkillsSrc)) ?? []);
    const catCafeSkillItems = items.filter((i) => i.type === 'skill' && i.source === 'cat-cafe');
    const providerDirs = {
      claude: join(home, '.claude', 'skills'),
      codex: join(home, '.codex', 'skills'),
      gemini: join(home, '.gemini', 'skills'),
    };
    await Promise.all(
      catCafeSkillItems.map(async (item) => {
        const expectedTarget = join(mountSkillsSrc, item.id);
        const [claude, codex, gemini] = await Promise.all([
          isCorrectSymlink(join(providerDirs.claude, item.id), expectedTarget),
          isCorrectSymlink(join(providerDirs.codex, item.id), expectedTarget),
          isCorrectSymlink(join(providerDirs.gemini, item.id), expectedTarget),
        ]);
        item.mounts = { claude, codex, gemini };
      }),
    );

    // Registration consistency: BOOTSTRAP.md vs source dir
    const bootstrapNames = new Set(skillCategoryMap.keys());
    const unregistered = [...mountSourceNames].filter((n) => !bootstrapNames.has(n));
    const phantom = [...bootstrapNames].filter((n) => !mountSourceNames.has(n));
    let allMounted = catCafeSkillItems.length > 0 && catCafeSkillItems.every((item) =>
      item.mounts && Object.values(item.mounts).every(Boolean),
    );
    // If we have expected cat-cafe skills (source dir non-empty) but discovered none,
    // treat as unhealthy (likely broken mounts).
    if (!allMounted && catCafeSkillItems.length === 0 && mountSourceNames.size > 0) allMounted = false;
    const skillHealth: SkillHealthSummary = {
      allMounted,
      registrationConsistent: unregistered.length === 0 && phantom.length === 0,
      unregistered,
      phantom,
    };

    // 7. Build response with cat family + project metadata
    const response: CapabilityBoardResponse = {
      items,
      catFamilies: buildCatFamilies(),
      projectPath: projectRoot,
      skillHealth,
    };

    return response;
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

    // Multi-project: accept projectPath in body
    let projectRoot = getProjectRoot();
    if (body.projectPath) {
      const validated = await validateProjectPath(body.projectPath);
      if (!validated) {
        reply.status(400);
        return { error: 'Invalid project path: must be an existing directory under home' };
      }
      projectRoot = validated;
    }

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
