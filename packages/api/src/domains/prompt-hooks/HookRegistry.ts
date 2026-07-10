/**
 * HookRegistry — F237 Phase 2
 *
 * Scans `assets/prompt-hooks/` for hook.yaml manifests, parses them,
 * validates, and provides query APIs.
 * Modeled on PluginRegistry (F202).
 */

import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  HookManifest,
  HookOverride,
  HookOverrideSnapshot,
  HookStage,
  RegisteredHook,
  TraceEventDisabled,
} from '@cat-cafe/shared';
import { parseHookManifest } from './hook-manifest-parser.js';

export class HookRegistry {
  private hooks = new Map<string, RegisteredHook>();
  private readonly hooksDir: string;
  private readonly templatesDir: string | null;
  private overrideSnapshot: HookOverrideSnapshot | null = null;

  /**
   * @param hooksDir - Directory containing hook subdirectories (each with hook.yaml)
   * @param templatesDir - Optional fallback directory for template files.
   *   Templates are first checked in the hook subdirectory, then in this fallback.
   *   Typically `assets/prompt-templates/` (centralized template location).
   */
  constructor(hooksDir: string, templatesDir?: string) {
    this.hooksDir = hooksDir;
    this.templatesDir = templatesDir ?? null;
  }

  /** Scan hook directory, parse manifests, validate, register. */
  scan(): HookManifest[] {
    this.hooks.clear();

    if (!existsSync(this.hooksDir)) return [];

    let entries: string[];
    try {
      entries = readdirSync(this.hooksDir).sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }

    const ordersByStage = new Map<HookStage, Map<number, string>>();
    const results: HookManifest[] = [];

    for (const entry of entries) {
      const hookDir = join(this.hooksDir, entry);
      try {
        if (!lstatSync(hookDir).isDirectory()) continue;
      } catch {
        continue;
      }

      const yamlPath = join(hookDir, 'hook.yaml');
      if (!existsSync(yamlPath)) continue;

      const result = parseHookManifest(yamlPath);
      if (!result.ok || !result.manifest) {
        console.warn(`[HookRegistry] Skipping ${entry}: ${result.errors.join('; ')}`);
        continue;
      }

      const manifest = result.manifest;

      // Validate ID matches directory convention (lowercase of ID)
      const expectedDirPrefix = manifest.id.toLowerCase();
      if (!entry.toLowerCase().startsWith(expectedDirPrefix)) {
        console.warn(`[HookRegistry] Skipping ${entry}: directory must start with '${expectedDirPrefix}'`);
        continue;
      }

      // Validate order uniqueness within stage
      if (!ordersByStage.has(manifest.stage)) {
        ordersByStage.set(manifest.stage, new Map());
      }
      const stageOrders = ordersByStage.get(manifest.stage)!;
      const existing = stageOrders.get(manifest.order);
      if (existing) {
        console.warn(
          `[HookRegistry] Skipping ${entry}: order ${manifest.order} in stage '${manifest.stage}' already used by ${existing}`,
        );
        continue;
      }
      stageOrders.set(manifest.order, manifest.id);

      // Resolve template path: check hook dir first, then centralized templates dir
      let templatePath = join(hookDir, manifest.template);
      if (!existsSync(templatePath) && this.templatesDir) {
        templatePath = join(this.templatesDir, manifest.template);
      }
      if (!existsSync(templatePath)) {
        console.warn(`[HookRegistry] Skipping ${entry}: template '${manifest.template}' not found`);
        continue;
      }

      // Validate duplicate ID
      if (this.hooks.has(manifest.id)) {
        console.warn(`[HookRegistry] Skipping ${entry}: duplicate hook ID '${manifest.id}'`);
        continue;
      }

      const registered: RegisteredHook = {
        manifest,
        dirPath: hookDir,
        templatePath,
      };

      this.hooks.set(manifest.id, registered);
      results.push(manifest);
    }

    return results;
  }

  /** Get hooks for a specific stage, ascending by order. */
  getStageHooks(stage: HookStage): RegisteredHook[] {
    return [...this.hooks.values()]
      .filter((h) => h.manifest.stage === stage)
      .sort((a, b) => a.manifest.order - b.manifest.order);
  }

  /** Get single hook by ID. */
  getHook(hookId: string): RegisteredHook | undefined {
    return this.hooks.get(hookId);
  }

  /** Get all registered hooks. */
  getAllHooks(): RegisteredHook[] {
    return [...this.hooks.values()];
  }

  // ---------------------------------------------------------------------------
  // Override snapshot (PR3: loaded async, used sync in pipeline hot-path)
  // ---------------------------------------------------------------------------

  /** Set the override snapshot for sync resolution during pipeline execution. */
  setOverrideSnapshot(snapshot: HookOverrideSnapshot): void {
    this.overrideSnapshot = snapshot;
  }

  /** Clear override snapshot (e.g., between invocations). */
  clearOverrideSnapshot(): void {
    this.overrideSnapshot = null;
  }

  /** Get raw override for a hook (null = no override). */
  getOverride(hookId: string): HookOverride | null {
    return this.overrideSnapshot?.get(hookId) ?? null;
  }

  // ---------------------------------------------------------------------------
  // Override-aware queries (manifest baseline + override layer)
  // ---------------------------------------------------------------------------

  /**
   * Check if hook is enabled (override takes precedence over manifest,
   * but only if the current manifest permits it — defense-in-depth against
   * stale overrides surviving manifest security tightening, sol P1-1).
   */
  isEnabled(hookId: string): boolean {
    const override = this.overrideSnapshot?.get(hookId);
    const hook = this.hooks.get(hookId);
    if (override?.enabled === false) {
      // Only honor disable-override if manifest currently allows disabling
      return hook?.manifest.disableable ? false : (hook?.manifest.enabled ?? false);
    }
    if (override?.enabled === true) return true;
    return hook?.manifest.enabled ?? false;
  }

  /** Get active version (override contentVersion if set, else manifest version). */
  getActiveVersion(hookId: string): number {
    const override = this.overrideSnapshot?.get(hookId);
    if (override?.contentVersion !== undefined) return override.contentVersion;
    const hook = this.hooks.get(hookId);
    return hook?.manifest.version ?? 0;
  }

  /**
   * Get content override for a hook (undefined = use manifest template).
   * Defense-in-depth: if manifest has been tightened to readonly since
   * the override was written, ignore the stale content override (sol P1-1).
   */
  getContentOverride(hookId: string): string | undefined {
    const hook = this.hooks.get(hookId);
    if (hook?.manifest.safetyTier === 'readonly') return undefined;
    return this.overrideSnapshot?.get(hookId)?.contentOverride;
  }

  /**
   * Determine who disabled this hook — for TraceEventDisabled.disabledBy.
   * If manifest doesn't allow disabling, a stale override is ignored (sol P1-1).
   */
  getDisabledBySource(hookId: string): TraceEventDisabled['disabledBy'] {
    const override = this.overrideSnapshot?.get(hookId);
    const hook = this.hooks.get(hookId);
    if (override?.enabled === false && hook?.manifest.disableable) {
      return override.source === 'auto-eval' ? 'auto-eval' : 'operator';
    }
    return 'manifest';
  }

  /** Total number of registered hooks. */
  get size(): number {
    return this.hooks.size;
  }
}
