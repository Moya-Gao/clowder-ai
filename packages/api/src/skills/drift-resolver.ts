/**
 * Drift Resolver — F228 Three-Layer Model
 *
 * Applies the user's "sync" decision to a pre-computed DriftResult:
 * pre-deletes conflict paths, then syncProject reconciles.
 */

import { lstat, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { MountRules } from '@cat-cafe/shared';
import { isValidSkillName } from '../config/governance/skill-sync.js';
import { buildSkillMountTargets } from '../utils/skill-mount.js';
import type { DriftResult } from './drift-detector.js';
import { syncProject } from './skill-sync-engine.js';

// ────────── Types ──────────

export interface DriftSyncReport {
  mounted: string[];
  unmounted: string[];
  overridden: string[];
  resolvedFrom: DriftResult;
}

// ────────── Sync Drift ──────────

export async function syncDrift(
  projectRoot: string,
  skillsSource: string,
  mountRules: MountRules,
  drift: DriftResult,
  opts?: {
    disabledSkills?: Iterable<string>;
    skillMountPaths?: Record<string, readonly string[]>;
    globalSkillMountPaths?: Record<string, readonly string[]>;
    cascadeDisabledSkills?: Iterable<string>;
    configOrphans?: Iterable<string>;
  },
): Promise<DriftSyncReport> {
  // Pre-delete conflict blockers so syncProject sees clean paths.
  // Scope to the specific provider where the conflict was detected.
  const targets = buildSkillMountTargets(projectRoot, homedir(), mountRules);
  const overriddenSkills = new Set<string>();
  for (const conflict of drift.conflicts ?? []) {
    if (!isValidSkillName(conflict.skill)) continue;
    overriddenSkills.add(conflict.skill);
    const target = targets.find((t) => t.id === conflict.provider);
    if (!target) continue;
    // Standard providers: only use project path (candidates[0]), skip HOME fallback.
    const dirs = target.kind === 'standard' ? target.candidates.slice(0, 1) : target.candidates;
    for (const dir of dirs) {
      // If the provider dir path is not a directory (symlink or file blocking it),
      // remove the blocker itself — don't follow symlinks into the source.
      try {
        const stat = await lstat(dir);
        if (!stat.isDirectory()) {
          await rm(dir, { force: true });
          continue;
        }
      } catch {
        /* ENOENT — dir doesn't exist, nothing to clean */
        continue;
      }
      await rm(join(dir, conflict.skill), { recursive: true, force: true }).catch(() => {});
    }
  }

  const syncResult = await syncProject(projectRoot, skillsSource, {
    mountRules,
    disabledSkills: new Set(opts?.disabledSkills ?? []),
    cascadeDisabledSkills: new Set(opts?.cascadeDisabledSkills ?? []),
    mountPathsBySkill: new Map(Object.entries(opts?.skillMountPaths ?? {})),
    globalMountPathsBySkill: new Map(Object.entries(opts?.globalSkillMountPaths ?? {})),
    additionalRemovedSkills: new Set(opts?.configOrphans ?? []),
    preserveGlobalCascade: true,
    force: false,
  });

  return {
    mounted: [...new Set(syncResult.mounted.map((m) => m.skillName))].sort(),
    unmounted: [...new Set(syncResult.unmounted.map((u) => u.skillName))].sort(),
    overridden: [...overriddenSkills].sort(),
    resolvedFrom: drift,
  };
}
