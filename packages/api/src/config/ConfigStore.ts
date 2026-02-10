/**
 * Config Store — hot-updatable configuration overlay (F4)
 *
 * Provides a runtime overlay on top of process.env for safe hot-reload
 * of select configuration keys without server restart.
 */

import { clearBudgetCache } from './cat-budgets.js';

/** Map of logical config key → env var name */
const UPDATABLE_KEYS: Record<string, string> = {
  'cli.timeoutMs': 'CLI_TIMEOUT_MS',
  'cli.codexSandboxMode': 'CAT_CODEX_SANDBOX_MODE',
  'cli.codexApprovalPolicy': 'CAT_CODEX_APPROVAL_POLICY',
  'a2a.maxDepth': 'MAX_A2A_DEPTH',
  'mode.switchRequiresApproval': 'MODE_SWITCH_REQUIRES_APPROVAL',
};

class ConfigStoreImpl {
  private overlay = new Map<string, string>();

  /** Set a hot-updatable config key. Throws if key is not updatable. */
  set(key: string, value: string): void {
    const envKey = UPDATABLE_KEYS[key];
    if (!envKey) {
      throw new Error(
        `Key '${key}' is not hot-updatable. Updatable keys: ${Object.keys(UPDATABLE_KEYS).join(', ')}`,
      );
    }
    this.overlay.set(key, value);
    process.env[envKey] = value;
    clearBudgetCache();
  }

  /** Get a config key value (overlay first, then env). */
  get(key: string): string | undefined {
    const envKey = UPDATABLE_KEYS[key];
    if (!envKey) return undefined;
    return this.overlay.get(key) ?? process.env[envKey];
  }

  /** List all updatable keys and their current values. */
  listUpdatable(): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};
    for (const key of Object.keys(UPDATABLE_KEYS)) {
      result[key] = this.get(key);
    }
    return result;
  }

  /** Reset overlay (for testing). */
  reset(): void {
    for (const [key] of this.overlay) {
      const envKey = UPDATABLE_KEYS[key];
      if (envKey) delete process.env[envKey];
    }
    this.overlay.clear();
    clearBudgetCache();
  }
}

export const configStore = new ConfigStoreImpl();
