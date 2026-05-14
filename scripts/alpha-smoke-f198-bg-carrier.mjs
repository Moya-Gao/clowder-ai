#!/usr/bin/env node
/**
 * F198 Phase B Step 3: Alpha Smoke for ClaudeBgCarrierService
 *
 * Real end-to-end run of the production carrier on a live `claude --bg`
 * job. Validates:
 *   - AC-B3e (tool_use visible + per-message streaming + usage on real --bg)
 *   - AC-B6 (transcript entrypoint=cli for subscription client evidence)
 *
 * NOT validated by this script:
 *   - AC-B4 (MCP under --bg): this prompt uses the built-in Bash tool, not a
 *     cat_cafe_* MCP tool, and does not pass callbackEnv. Real MCP smoke is
 *     a follow-up — to exercise the --mcp-config injection PATH (still not
 *     full AC-B4 verification), re-run with env CAT_CAFE_INVOCATION_ID=...
 *     CAT_CAFE_CALLBACK_TOKEN=... and a prompt that asks the model to call a
 *     cat_cafe_* MCP tool.
 *
 * Manual run only (requires real Claude subscription auth + claude CLI in
 * PATH). NOT executed by `pnpm gate` or CI.
 *
 * Usage:
 *   pnpm --filter @cat-cafe/api build
 *   node scripts/alpha-smoke-f198-bg-carrier.mjs
 *
 * Exit code: 0 = all assertions pass, 1 = any assertion failed.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ClaudeBgCarrierService } from '../packages/api/dist/domains/cats/services/agents/providers/ClaudeBgCarrierService.js';
import { JobEventConsumer } from '../packages/api/dist/domains/cats/services/agents/providers/JobEventConsumer.js';

const CAT_ID = 'opus';
const MODEL = process.env.CAT_OPUS_MODEL || 'claude-opus-4-7';

// Prompt designed to trigger a tool call (Bash) so R2 (tool_use visibility)
// is exercised on the real path.
const TOOL_PROMPT =
  'Use the Bash tool to run `echo F198_ALPHA_SMOKE_OK` and report the output. Keep your final answer short.';

function log(stage, msg) {
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] [${stage}] ${msg}`);
}

async function main() {
  log('init', `carrier=ClaudeBgCarrierService model=${MODEL} catId=${CAT_ID}`);
  const service = new ClaudeBgCarrierService({ catId: CAT_ID, model: MODEL });

  const events = [];
  const startedAt = Date.now();
  let shortId;

  try {
    for await (const msg of service.invoke(TOOL_PROMPT)) {
      events.push(msg);
      if (msg.type === 'session_init') {
        shortId = msg.sessionId;
        log('session', `shortId=${shortId} model=${msg.metadata?.model}`);
      } else if (msg.type === 'text') {
        log('text', `${msg.content.slice(0, 80)}${msg.content.length > 80 ? '…' : ''}`);
      } else if (msg.type === 'tool_use') {
        log('tool_use', `${msg.toolName} input=${JSON.stringify(msg.toolInput).slice(0, 100)}`);
      } else if (msg.type === 'system_info') {
        log('system_info', msg.content.slice(0, 100));
      } else if (msg.type === 'error') {
        log('error', msg.error);
      } else if (msg.type === 'done') {
        log('done', `usage=${JSON.stringify(msg.metadata?.usage ?? null)}`);
      }
    }
  } catch (err) {
    log('THROW', `invoke threw: ${err.message}`);
    process.exit(1);
  }

  const elapsedMs = Date.now() - startedAt;
  log('summary', `${events.length} events in ${elapsedMs}ms`);

  // ============ ASSERTIONS ============
  log('assert', 'AC-B3e: session_init present');
  const init = events.find((e) => e.type === 'session_init');
  assert.ok(init, 'must yield session_init');
  assert.ok(init.sessionId, 'session_init must have sessionId');

  log('assert', 'AC-B3e: at least one tool_use event (R2 Hub observability)');
  const toolUseEvents = events.filter((e) => e.type === 'tool_use');
  assert.ok(toolUseEvents.length > 0, 'R2 critical: must see at least one tool_use');
  log('pass', `tool_use count=${toolUseEvents.length}, names=[${toolUseEvents.map((e) => e.toolName).join(', ')}]`);

  log('assert', 'AC-B3e: at least one text event');
  const textEvents = events.filter((e) => e.type === 'text');
  assert.ok(textEvents.length > 0, 'must see at least one text event');
  log('pass', `text count=${textEvents.length}`);

  log('assert', 'AC-B3e: done event with usage');
  const done = events[events.length - 1];
  assert.equal(done.type, 'done', 'last event must be done');
  assert.ok(done.metadata?.usage, 'done.metadata.usage must be populated');
  assert.ok((done.metadata.usage.outputTokens ?? 0) > 0, 'outputTokens must be > 0');
  log('pass', `usage=${JSON.stringify(done.metadata.usage)}`);

  log('assert', 'AC-B6: transcript entrypoint=cli (subscription routing client evidence)');
  const consumer = new JobEventConsumer(shortId);
  const state = await consumer.readState();
  assert.ok(state?.linkScanPath, 'state.linkScanPath must be set');
  assert.ok(existsSync(state.linkScanPath), `transcript file must exist at ${state.linkScanPath}`);
  const transcript = readFileSync(state.linkScanPath, 'utf8');
  const lines = transcript
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const entrypoints = new Set(lines.map((l) => l.entrypoint).filter(Boolean));
  log('info', `transcript entrypoints observed: ${[...entrypoints].join(', ')}`);
  assert.ok(entrypoints.has('cli'), 'AC-B6: transcript must contain entrypoint=cli (subscription client evidence)');
  log('pass', 'AC-B6: entrypoint=cli verified ✓');

  log('done', `✅ Alpha smoke PASSED — all assertions met (R1 client evidence + R2 observability)`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Alpha smoke FAILED:', err);
  process.exit(1);
});
