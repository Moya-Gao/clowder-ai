import { makeReport } from './core.mjs';
import { runReadonlySmoke } from './readonly.mjs';
import { runSentinelSmoke } from './sentinel.mjs';

export async function runAntigravityAvailabilitySmoke(options = {}) {
  const mode = options.mode === undefined ? 'readonly' : options.mode;
  if (mode === 'readonly') return runReadonlySmoke(options);
  if (mode === 'sentinel') return runSentinelSmoke(options);
  if (mode === 'thread') {
    return makeReport({
      ok: false,
      mode: 'thread',
      stage: options.threadId ? 'thread_smoke_not_live_in_unit_runner' : 'thread_id_required',
      diagnostics: {
        threadId: options.threadId,
        message: 'thread smoke is intentionally explicit; use agent-key runtime smoke with a test thread',
      },
    });
  }
  return makeReport({ ok: false, mode, stage: 'unsupported_mode', diagnostics: { mode } });
}
