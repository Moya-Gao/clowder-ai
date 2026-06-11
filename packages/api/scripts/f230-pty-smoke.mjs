/**
 * F230 Phase B: end-to-end PTY smoke test
 *
 * Exercises ClaudeInteractivePtyCarrierService with a real claude interactive
 * session via tmux. Validates:
 *   - session_init is yielded with a real sessionId (UUID)
 *   - at least one text message is yielded
 *   - done is yielded with usage.outputTokens > 0
 *   - no zombie tmux session after invocation
 *
 * Usage (from repo root):
 *   node packages/api/scripts/f230-pty-smoke.mjs
 *
 * Env:
 *   CAT_OPUS_MODEL=claude-opus-4-8   (or set via cat-catalog.json)
 *   ANTHROPIC_PROFILE_MODE=subscription (default)
 *
 * Takes ~30-60s: TUI startup 10-15s + claude response + cleanup.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const distRoot = resolve(__dirname, '../dist');

// Set model so getCatModel('opus') resolves without full cat-catalog bootstrap
process.env.CAT_OPUS_MODEL ??= 'claude-opus-4-8';

// ─── imports (after env setup) ────────────────────────────────────────────────

const { ClaudeInteractivePtyCarrierService } = await import(
  `${distRoot}/domains/cats/services/agents/providers/ClaudeInteractivePtyCarrierService.js`
);

// ─── helpers ──────────────────────────────────────────────────────────────────

function countTmuxSessionsWithPrefix(prefix) {
  try {
    const out = execSync('tmux ls 2>/dev/null || true', { encoding: 'utf8', timeout: 5000 });
    return out.split('\n').filter((l) => l.includes(prefix)).length;
  } catch {
    return 0;
  }
}

function hasTmux() {
  try {
    execSync('tmux -V', { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

if (!hasTmux()) {
  console.error('❌ tmux not available — cannot run PTY smoke test');
  process.exit(1);
}

// D6 constraint: independent cwd to isolate the smoke's transcript directory.
//
// TRUST CONSTRAINT (E5 lesson): /tmp dirs are NOT trusted by Claude Code — they
// trigger a "Do you trust files in this directory?" dialog that blocks the TUI
// before the prompt is sent. Claude must be invoked from a TRUSTED directory.
//
// Solution: use the worktree root (already trusted — devs run `claude` here).
// Slug collision risk is minimal: watchForTranscriptFile snapshots existing .jsonl
// files RIGHT BEFORE send-keys Enter, so any pre-existing session's files are in
// the exclusion set. A collision requires another NEW Claude session to start in
// the exact same directory within the <2s grace window, which is extremely unlikely
// for sequential smoke runs.
const SMOKE_CWD = resolve(__dirname, '../../..');
console.log(`🔍 smoke cwd (trusted worktree root): ${SMOKE_CWD}`);
console.log('🚀 Starting F230 PTY smoke test...');

// B-min compatibility: Claude 2.1.172 interactive TUI does NOT write real-time
// transcripts (confirmed 2026-06-11). Use 2.1.170 explicitly — it writes
// transcripts with entrypoint=cli, enabling AC-B1/B4 capsule verification.
// Path: ~/.local/share/claude/versions/2.1.170 (present on dev machines).
const CLAUDE_170 = join(homedir(), '.local', 'share', 'claude', 'versions', '2.1.170');
const claudeBinary = existsSync(CLAUDE_170) ? CLAUDE_170 : undefined;
if (claudeBinary) {
  console.log(`🔧 Using claude 2.1.170 binary: ${claudeBinary}`);
} else {
  console.warn(`⚠️  2.1.170 binary not found at ${CLAUDE_170}, falling back to default 'claude'`);
  console.warn('   AC-B1/AC-B4 may fail if running Claude 2.1.172+ (transcript regression)');
}

const carrier = new ClaudeInteractivePtyCarrierService({
  cwd: SMOKE_CWD,
  pollIntervalMs: 500,
  terminalTimeoutMs: 5 * 60 * 1_000,
  claudeBinary,
});

const results = {
  sessionInit: null,
  texts: [],
  done: null,
  errors: [],
  transcriptPath: null,
};

/**
 * Compute ~/.claude/projects/<slug>/ for a given cwd (mirrors ptyTranscriptDir).
 *
 * Claude writes conversation transcripts to `~/.claude/projects/<slug>/`
 * where the slug is derived directly from the cwd.
 *
 * F230 diagnostic 2026-06-11: confirmed that Claude uses the ACTUAL CWD slug,
 * not the git-common-dir parent (earlier resolveGitProjectDir hypothesis was wrong).
 */
function ptyTranscriptDir(cwd) {
  const slug = cwd.replace(/\//g, '-');
  return join(homedir(), '.claude', 'projects', slug);
}

const startMs = Date.now();
console.log('📡 Invoking carrier...');

try {
  for await (const msg of carrier.invoke('Reply with exactly: F230_SMOKE_OK')) {
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    process.stdout.write(`  [${elapsed}s] ${msg.type}`);

    switch (msg.type) {
      case 'session_init':
        results.sessionInit = msg;
        // Resolve transcript path now (used for AC-B1/B4 capsule check after loop)
        if (msg.sessionId) {
          results.transcriptPath = join(ptyTranscriptDir(SMOKE_CWD), `${msg.sessionId}.jsonl`);
        }
        process.stdout.write(` sessionId=${msg.sessionId}\n`);
        break;
      case 'text':
        results.texts.push(msg);
        process.stdout.write(` "${(msg.content ?? '').slice(0, 60)}"\n`);
        break;
      case 'done':
        results.done = msg;
        process.stdout.write(` isFinal=${msg.isFinal} outputTokens=${msg.metadata?.usage?.outputTokens ?? '?'}\n`);
        break;
      case 'error':
        results.errors.push(msg);
        process.stdout.write(` error="${msg.error}"\n`);
        break;
      case 'system_info':
        process.stdout.write(` (${(msg.content ?? '').slice(0, 80)})\n`);
        break;
      default:
        process.stdout.write('\n');
    }
  }
} catch (err) {
  console.error('❌ Generator threw:', err.message);
  process.exit(1);
}

const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
console.log(`\n⏱  Total: ${elapsedSec}s`);

// ─── Read transcript for AC-B1/B4 capsule checks ──────────────────────────────
// AC-B1: entrypoint must be 'cli' (not 'sdk-cli') — billing identity guard
// AC-B4: permissionMode must be 'bypassPermissions'
let transcriptEntrypoint = null;
let transcriptPermMode = null;
if (results.transcriptPath && existsSync(results.transcriptPath)) {
  try {
    const lines = readFileSync(results.transcriptPath, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        // entrypoint is on the first user event
        if (event.type === 'user' && event.entrypoint && !transcriptEntrypoint) {
          transcriptEntrypoint = event.entrypoint;
        }
        // permission-mode event carries the effective permissionMode
        if (event.type === 'permission-mode' && event.permissionMode) {
          transcriptPermMode = event.permissionMode;
        }
      } catch {
        // skip malformed lines
      }
    }
  } catch (err) {
    console.error(`  ⚠️  Could not read transcript: ${err.message}`);
  }
} else {
  console.error(`  ⚠️  Transcript file not found: ${results.transcriptPath}`);
}

// ─── assertions ────────────────────────────────────────────────────────────────

let pass = true;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    console.error(`  ❌ ${label}${detail ? `: ${detail}` : ''}`);
    pass = false;
  }
}

console.log('\n📋 Smoke assertions:');

check('session_init yielded', results.sessionInit != null);
check(
  'sessionId looks like UUID',
  results.sessionInit?.sessionId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(results.sessionInit.sessionId),
  `got: ${results.sessionInit?.sessionId}`,
);
check('at least 1 text message', results.texts.length > 0, `got ${results.texts.length} texts`);
check('done yielded', results.done != null);
check('done.isFinal === true', results.done?.isFinal === true);
check(
  'usage.outputTokens > 0',
  typeof results.done?.metadata?.usage?.outputTokens === 'number' && results.done.metadata.usage.outputTokens > 0,
  `outputTokens = ${results.done?.metadata?.usage?.outputTokens}`,
);
check('no errors', results.errors.length === 0, results.errors.map((e) => e.error).join('; '));
check(
  'no zombie tmux sessions (f230pty prefix)',
  countTmuxSessionsWithPrefix('f230pty') === 0,
  `found ${countTmuxSessionsWithPrefix('f230pty')} lingering sessions`,
);

// AC-B1: entrypoint capsule — billing identity must be 'cli' not 'sdk-cli'
check(
  'AC-B1: entrypoint=cli in transcript (billing identity guard)',
  transcriptEntrypoint === 'cli',
  `got entrypoint=${transcriptEntrypoint ?? 'NOT FOUND'} from transcript`,
);

// AC-B4: permission mode bypass — must be 'bypassPermissions'
check(
  'AC-B4: permissionMode=bypassPermissions in transcript',
  transcriptPermMode === 'bypassPermissions',
  `got permissionMode=${transcriptPermMode ?? 'NOT FOUND'} from transcript`,
);

// AC-B3: MCP config shape (validated by unit test Step 6)
// The standalone smoke does NOT pass callbackEnv, so MCP config is not injected here.
// MCP config shape (mcpServers.cat-cafe.command=node + args=[path]) is validated by
// the unit test Step 6 in f230-interactive-pty-carrier.test.js.
console.log('  ℹ️  AC-B3 (MCP config): gated on callbackEnv — validated by unit test Step 6');

if (pass) {
  console.log('\n🎉 F230 PTY smoke test PASS');
  process.exit(0);
} else {
  console.error('\n💥 F230 PTY smoke test FAIL');
  process.exit(1);
}
