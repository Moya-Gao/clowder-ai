#!/usr/bin/env node
/**
 * F198 Phase B Prototype: ClaudeBgCarrierService + JobEventConsumer
 *
 * Spike script verifying end-to-end:
 *   1. spawn `claude --bg <prompt>` → parse short id
 *   2. read ~/.claude/jobs/<short>/state.json (state machine)
 *   3. read ~/.claude/jobs/<short>/timeline.jsonl (event stream)
 *   4. read transcript jsonl → assert entrypoint=cli (AC-B6 client evidence)
 *   5. stop job (cleanup)
 *
 * Goal: prove the Phase B carrier shape works before refactoring into
 * ClaudeBgCarrierService.ts + JobEventConsumer.ts proper service classes.
 *
 * Run: node scripts/spike-f198-bg-carrier.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const HOME = homedir();
const JOBS_DIR = path.join(HOME, '.claude/jobs');

// =============================================================================
// ClaudeBgCarrierService — minimal prototype
// =============================================================================
class ClaudeBgCarrierService {
  /**
   * Spawn `claude --bg <prompt>` and parse the returned short id.
   *
   * Returns { shortId, stdout } when the claude binary exits (it returns
   * immediately after handing the job to the daemon supervisor, NOT after
   * the LLM finishes).
   */
  async startJob(prompt, options = {}) {
    return new Promise((resolve, reject) => {
      const args = ['--bg', prompt];

      // Critical: under `--bg`, claude binary does NOT self-set
      // CLAUDE_CODE_ENTRYPOINT — so the value entirely depends on what the
      // child inherits. cat-cafe runtime itself runs under
      // CLAUDE_CODE_ENTRYPOINT=sdk-cli, so unless we explicitly delete it
      // here the child sees sdk-cli too.
      //
      // The buildChildEnv util in packages/api/src/utils/cli-spawn.ts already
      // does this correctly via `null → delete`. We replicate it here in the
      // standalone spike.
      const env = { ...process.env };
      delete env.CLAUDE_CODE_ENTRYPOINT;
      delete env.CLAUDECODE;

      const child = spawn('claude', args, {
        cwd: options.cwd || process.cwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));

      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`claude --bg exited ${code}: ${stderr.slice(0, 300)}`));
        }
        // Output looks like:
        //   Starting background service…
        //   backgrounded · c555a987
        const match = stdout.match(/backgrounded\s*·\s*([a-f0-9]{8})/);
        if (!match) {
          return reject(new Error(`Could not parse short id from claude --bg stdout: ${stdout.slice(0, 300)}`));
        }
        resolve({ shortId: match[1], stdout });
      });
    });
  }
}

// =============================================================================
// JobEventConsumer — minimal prototype
// =============================================================================
class JobEventConsumer {
  constructor(shortId) {
    this.shortId = shortId;
    this.jobDir = path.join(JOBS_DIR, shortId);
  }

  async readState() {
    const statePath = path.join(this.jobDir, 'state.json');
    if (!existsSync(statePath)) return null;
    return JSON.parse(await readFile(statePath, 'utf8'));
  }

  async readTimeline() {
    const timelinePath = path.join(this.jobDir, 'timeline.jsonl');
    if (!existsSync(timelinePath)) return [];
    const content = await readFile(timelinePath, 'utf8');
    return content
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  }

  /** Poll state.json until state ∈ {done, error} or timeout. */
  async waitForTerminal(timeoutMs = 30_000, pollMs = 500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const state = await this.readState();
      if (state?.state === 'done' || state?.state === 'error') return state;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    return await this.readState();
  }

  /** Count entrypoint distribution in the linked transcript jsonl. */
  async readTranscriptEntrypoints(transcriptPath) {
    if (!transcriptPath || !existsSync(transcriptPath)) return {};
    const content = await readFile(transcriptPath, 'utf8');
    const counts = {};
    for (const line of content.split('\n').filter(Boolean)) {
      try {
        const obj = JSON.parse(line);
        const ep = obj.entrypoint || '(none)';
        counts[ep] = (counts[ep] || 0) + 1;
      } catch {
        // ignore non-JSON lines
      }
    }
    return counts;
  }
}

// =============================================================================
// SPIKE: end-to-end verify
// =============================================================================
async function main() {
  console.log('=== F198 Phase B Prototype Spike ===\n');

  console.log('[1/5] Start --bg job...');
  const carrier = new ClaudeBgCarrierService();
  const PROMPT = 'reply with exactly: SPIKE_OK';
  const { shortId } = await carrier.startJob(PROMPT);
  console.log(`  ✓ short id: ${shortId}`);

  console.log('[2/5] Wait for state.json to reach terminal...');
  const consumer = new JobEventConsumer(shortId);
  const finalState = await consumer.waitForTerminal(45_000);
  console.log(`  ✓ state: ${finalState?.state} | detail: ${finalState?.detail}`);
  console.log(`  output: ${JSON.stringify(finalState?.output)?.slice(0, 150)}`);

  console.log('[3/5] Read timeline.jsonl...');
  const timeline = await consumer.readTimeline();
  console.log(`  ✓ timeline events: ${timeline.length}`);
  for (const e of timeline.slice(0, 3)) {
    console.log(`    ${e.at} [${e.state}] ${(e.text || e.detail || '').slice(0, 60)}`);
  }

  console.log('[4/5] Verify transcript entrypoint=cli (AC-B6 client evidence)...');
  const counts = await consumer.readTranscriptEntrypoints(finalState?.linkScanPath);
  console.log(`  entrypoint distribution: ${JSON.stringify(counts)}`);
  if ((counts.cli || 0) > 0 && (counts['sdk-cli'] || 0) === 0) {
    console.log(`  ✅ AC-B6 PASS: entrypoint=cli (no sdk-cli)`);
  } else if ((counts.cli || 0) > 0) {
    console.log(`  ⚠️  PARTIAL: cli=${counts.cli} but also sdk-cli=${counts['sdk-cli']}`);
  } else {
    console.log(`  ❌ AC-B6 FAIL: transcript has no entrypoint=cli`);
    process.exitCode = 1;
  }

  console.log('[5/5] Cleanup: claude stop...');
  await new Promise((resolve) => {
    const stop = spawn('claude', ['stop', shortId], { stdio: 'inherit' });
    stop.on('close', resolve);
  });
  console.log('  ✓ stopped\n');

  console.log('=== Spike complete ===');
}

main().catch((err) => {
  console.error('\n[spike] FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
