/**
 * F198 Phase B Step 3: Canary carrier factory
 *
 * Selects `-p` vs `--bg` vs interactive PTY carrier for anthropic provider based on env var.
 * Default behavior unchanged (Step 1+2 are foundation only; this step
 * adds the opt-in switch). AC-B8 hard constraint: no flag → -p default,
 * all布偶猫 invocations route through ClaudeAgentService (current
 * production path). Opt-in = `CAT_CAFE_CLAUDE_CARRIER=bg_daemon`.
 *
 * F230 Phase B adds: `CAT_CAFE_CLAUDE_CARRIER=interactive_pty`
 * Routes to ClaudeInteractivePtyCarrierService — PTY-based backup carrier.
 *
 * Why env var (not thread metadata) for canary slice 1:
 * - Smallest blast radius — operator toggles per-deploy
 * - Easy rollback (unset → -p)
 * - Future per-thread / per-cat granularity layered on top
 *
 * Migration plan beyond canary:
 * - 6/01: bg_daemon enabled on subset of布偶猫 sessions (canary)
 * - 6/08: 100% if no regression (Phase D AC-D3)
 * - 6/15: subscription policy cutover (R1 hard deadline)
 */
import { accessSync, constants, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CatId } from '@cat-cafe/shared';
import type { AgentService } from '../../types.js';
import { ClaudeAgentService } from './ClaudeAgentService.js';
import { ClaudeBgCarrierService } from './ClaudeBgCarrierService.js';
import { ClaudeInteractivePtyCarrierService } from './ClaudeInteractivePtyCarrierService.js';

export const CARRIER_ENV_KEY = 'CAT_CAFE_CLAUDE_CARRIER';
export const CARRIER_BG_DAEMON = 'bg_daemon';
/** F230: opt-in value for interactive PTY carrier */
export const CARRIER_INTERACTIVE_PTY = 'interactive_pty';

/**
 * Env var override for the claude binary used by `interactive_pty` carrier.
 * Default: `~/.local/share/claude/versions/2.1.170`.
 * Fail-fast if binary not found — 2.1.172+ interactive TUI no longer writes
 * transcripts (F230 R13), so falling back to the system `claude` silently
 * breaks AC-B1/AC-B4 capsule checks.
 */
export const CARRIER_PTY_BINARY_KEY = 'CAT_CAFE_CLAUDE_PTY_BINARY';
const DEFAULT_PTY_BINARY_170 = join(homedir(), '.local', 'share', 'claude', 'versions', '2.1.170');

function resolveInteractivePtyBinary(env: Record<string, string | undefined>): string {
  const envPath = env[CARRIER_PTY_BINARY_KEY];
  if (envPath) {
    try {
      accessSync(envPath, constants.X_OK);
    } catch {
      throw new Error(
        `${CARRIER_PTY_BINARY_KEY}=${envPath} does not exist or is not executable. ` +
          `Verify the path points to an executable claude binary.`,
      );
    }
    return envPath;
  }
  if (existsSync(DEFAULT_PTY_BINARY_170)) return DEFAULT_PTY_BINARY_170;
  throw new Error(
    `interactive_pty carrier requires claude 2.1.170 binary ` +
      `(2.1.172+ regression: interactive TUI no longer writes transcripts). ` +
      `Expected: ${DEFAULT_PTY_BINARY_170}. ` +
      `Override via ${CARRIER_PTY_BINARY_KEY} env var.`,
  );
}

/**
 * Construct the appropriate Claude carrier for a布偶猫 cat invocation.
 *
 * @param catId — which布偶猫 instance (opus / sonnet / opus-45 / opus-47)
 * @param env — env vars (defaults to process.env; pass override in tests).
 *
 * Default (env unset / any value ≠ known carriers): `ClaudeAgentService` (-p).
 * Opt-in 'bg_daemon': `ClaudeBgCarrierService` (--bg).
 * Opt-in 'interactive_pty' (F230): `ClaudeInteractivePtyCarrierService` (PTY via tmux).
 */
export function createClaudeAgentServiceForCanary(
  catId: CatId,
  env: Record<string, string | undefined> = process.env,
): AgentService {
  const carrier = env[CARRIER_ENV_KEY]?.trim();
  if (carrier === CARRIER_BG_DAEMON) {
    return new ClaudeBgCarrierService({ catId });
  }
  if (carrier === CARRIER_INTERACTIVE_PTY) {
    try {
      return new ClaudeInteractivePtyCarrierService({
        catId,
        claudeBinary: resolveInteractivePtyBinary(env),
      });
    } catch (err) {
      // Canary carrier dependency failure must not crash the server — degrade
      // gracefully to -p. ERROR level so operator sees the degradation in logs
      // (Fable-5 硬要求: silent fallback = 6/15 判罚日 misread risk).
      console.error(
        `[carrier-factory] interactive_pty fallback → -p for ${catId}:`,
        err instanceof Error ? err.message : err,
      );
      return new ClaudeAgentService({ catId });
    }
  }
  return new ClaudeAgentService({ catId });
}
