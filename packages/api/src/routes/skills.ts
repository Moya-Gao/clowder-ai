/**
 * Skills Route
 * GET /api/skills — Cat Café 共享 Skills 看板数据
 *
 * 扫描 cat-cafe-skills/ 源目录，检查三猫 symlink 挂载状态，
 * 解析 BOOTSTRAP.md 提取分类和触发说明。
 */

import { readdir, readFile, lstat, readlink } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { FastifyPluginAsync } from 'fastify';
import { resolveUserId } from '../utils/request-identity.js';

const execFileAsync = promisify(execFile);

interface SkillMount {
  claude: boolean;
  codex: boolean;
  gemini: boolean;
}

interface SkillEntry {
  name: string;
  category: string;
  trigger: string;
  mounts: SkillMount;
}

interface SkillsSummary {
  total: number;
  allMounted: boolean;
  registrationConsistent: boolean;
}

interface SkillsResponse {
  skills: SkillEntry[];
  summary: SkillsSummary;
}

/**
 * Resolve canonical main repo path.
 * Uses git worktree list (works from any worktree/subdir) → rev-parse fallback → cwd fallback.
 * No hardcoded paths — inherits cwd from the API server process.
 */
async function resolveMainRepoPath(): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain']);
    const firstLine = stdout.split('\n')[0] ?? '';
    return firstLine.replace(/^worktree\s+/, '').trim();
  } catch {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel']);
      return stdout.trim();
    } catch {
      // Last resort: 2 levels up from packages/api cwd
      const { resolve } = await import('path');
      return resolve(process.cwd(), '../..');
    }
  }
}

/** Check if a path is a symlink pointing to the expected target. */
async function isCorrectSymlink(linkPath: string, expectedTarget: string): Promise<boolean> {
  try {
    const stat = await lstat(linkPath);
    if (!stat.isSymbolicLink()) return false;
    const dest = await readlink(linkPath);
    // Normalize trailing slash
    return dest.replace(/\/$/, '') === expectedTarget;
  } catch {
    return false;
  }
}

/** List subdirs that contain SKILL.md */
async function listSkillDirs(skillsSrc: string): Promise<string[]> {
  try {
    const entries = await readdir(skillsSrc, { withFileTypes: true });
    const names: string[] = [];
    for (const e of entries) {
      if (!e.isDirectory() && !e.isSymbolicLink()) continue;
      try {
        await readFile(join(skillsSrc, e.name, 'SKILL.md'), 'utf-8');
        names.push(e.name);
      } catch {
        // No SKILL.md, skip
      }
    }
    return names;
  } catch {
    return [];
  }
}

interface BootstrapEntry {
  name: string;
  category: string;
  trigger: string;
}

/** Parse BOOTSTRAP.md to extract skill entries with categories and triggers. */
async function parseBootstrap(bootstrapPath: string): Promise<Map<string, BootstrapEntry>> {
  const result = new Map<string, BootstrapEntry>();
  try {
    const content = await readFile(bootstrapPath, 'utf-8');
    const lines = content.split('\n');

    let currentCategory = '';
    for (const line of lines) {
      // Detect category headers: ### 分类名
      const categoryMatch = line.match(/^###\s+(.+)/);
      if (categoryMatch?.[1]) {
        currentCategory = categoryMatch[1].trim();
        continue;
      }
      // Detect skill table rows: | `skill-name` | trigger |
      const rowMatch = line.match(/^\|\s*`([a-z][-a-z0-9]*)`\s*\|\s*(.+?)\s*\|/);
      if (rowMatch?.[1]) {
        const name = rowMatch[1];
        const trigger = rowMatch[2]?.trim() ?? '';
        result.set(name, { name, category: currentCategory, trigger });
      }
    }
  } catch {
    // BOOTSTRAP.md not found or unreadable
  }
  return result;
}

export const skillsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/skills', async (request, reply) => {
    const userId = resolveUserId(request);
    if (!userId) {
      reply.status(401);
      return { error: 'Identity required (X-Cat-Cafe-User header or userId query)' };
    }
    const mainRepo = await resolveMainRepoPath();
    const skillsSrc = join(mainRepo, 'cat-cafe-skills');
    const bootstrapPath = join(skillsSrc, 'BOOTSTRAP.md');
    const home = homedir();

    const catDirs = {
      claude: join(home, '.claude', 'skills'),
      codex: join(home, '.codex', 'skills'),
      gemini: join(home, '.gemini', 'skills'),
    };

    const [sourceSkills, bootstrapEntries] = await Promise.all([
      listSkillDirs(skillsSrc),
      parseBootstrap(bootstrapPath),
    ]);

    // Build mount status lookup for each source skill
    const sourceSet = new Set(sourceSkills);
    const mountLookup = new Map<string, SkillEntry>();
    await Promise.all(
      sourceSkills.map(async (name) => {
        const expectedTarget = join(skillsSrc, name);
        const [claude, codex, gemini] = await Promise.all([
          isCorrectSymlink(join(catDirs.claude, name), expectedTarget),
          isCorrectSymlink(join(catDirs.codex, name), expectedTarget),
          isCorrectSymlink(join(catDirs.gemini, name), expectedTarget),
        ]);
        const entry = bootstrapEntries.get(name);
        mountLookup.set(name, {
          name,
          category: entry?.category ?? '未分类',
          trigger: entry?.trigger ?? '',
          mounts: { claude, codex, gemini },
        });
      }),
    );

    // Order: BOOTSTRAP insertion order first, then unregistered skills appended
    const ordered: string[] = [];
    const bootstrapOrdered = new Set<string>();
    for (const bsName of bootstrapEntries.keys()) {
      if (sourceSet.has(bsName)) {
        ordered.push(bsName);
        bootstrapOrdered.add(bsName);
      }
    }
    for (const name of sourceSkills) {
      if (!bootstrapOrdered.has(name)) ordered.push(name);
    }
    const skills = ordered.map((n) => mountLookup.get(n)!).filter(Boolean);

    // Registration consistency check
    const sourceNames = new Set(sourceSkills);
    const bootstrapNames = new Set(bootstrapEntries.keys());
    const unregistered = sourceSkills.filter((n) => !bootstrapNames.has(n));
    const phantom = [...bootstrapNames].filter((n) => !sourceNames.has(n));
    const registrationConsistent = unregistered.length === 0 && phantom.length === 0;

    const allMounted = skills.every((s) => s.mounts.claude && s.mounts.codex && s.mounts.gemini);

    const response: SkillsResponse = {
      skills,
      summary: {
        total: skills.length,
        allMounted,
        registrationConsistent,
      },
    };

    return response;
  });
};
