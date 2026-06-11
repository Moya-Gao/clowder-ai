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
    return new ClaudeInteractivePtyCarrierService({ catId });
  }
  return new ClaudeAgentService({ catId });
}
