/**
 * F230 Phase B: ClaudeInteractivePtyCarrierService
 *
 * Carrier that invokes Claude via an interactive PTY session managed by tmux.
 * Backup/alternative to `claude --bg` daemon (F198). Avoids the `-p` flag
 * entirely → billing identity stays `cli` (not `sdk-cli`).
 *
 * Architecture:
 *   - PtyDriver handles tmux session lifecycle + prompt injection
 *   - TranscriptTailer reads output from ~/.claude/projects/<slug>/<session>.jsonl
 *   - transcriptEntriesToAgentMessages/accumulateUsageFromEntries reused from bg path
 *   - Terminal state: `system/turn_duration` event (D4) + silence fallback
 *   - Cancel: options.signal → driver.cancel() (ESC) → drain → driver.dispose()
 *
 * F230 KD-1: per-invocation form — each invoke() starts a fresh tmux session
 * and disposes it when done. Resume via `sessionId` option reuses transcript.
 * Persistent session form (Phase C) is out of B-min scope.
 *
 * Note: B-min does NOT inject --system-prompt-file (L0 compiler integration
 * deferred to a later phase) to stay minimal and avoid dependency on
 * compileL0ViaSubprocess machinery.
 */
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { type CatId, createCatId } from '@cat-cafe/shared';
import { getCatModel } from '../../../../../config/cat-models.js';
import { createModuleLogger } from '../../../../../infrastructure/logger.js';
import type { AgentMessage, AgentService, AgentServiceOptions, TokenUsage } from '../../types.js';
import {
  accumulateUsageFromEntries,
  createUsageAccumulator,
  finalizeTranscriptUsage,
  transcriptEntriesToAgentMessages,
} from './BgTranscriptEventConsumer.js';
import {
  ANTHROPIC_PROFILE_MODE_KEY,
  buildClaudeEnvOverrides,
  resolveClaudeModelSelection,
  resolveDefaultClaudeMcpServerPath,
} from './ClaudeAgentService.js';
import { appendLocalImagePathHints, collectImageAccessDirectories } from './image-cli-bridge.js';
import { extractImagePaths } from './image-paths.js';
import type { PtyDriverOptions } from './pty/PtyDriver.js';
import { PtyDriver } from './pty/PtyDriver.js';
import { ptyTranscriptDir, sleep } from './pty/pty-utils.js';
export { ptyTranscriptDir }; // re-export for consumers (f230-interactive-pty-carrier.test.js)

import { TranscriptTailer } from './TranscriptTailer.js';

const log = createModuleLogger('interactive-pty-carrier');

export interface ClaudeInteractivePtyCarrierServiceOptions {
  catId?: CatId;
  /** Test seam: polling interval for TranscriptTailer (ms). Default 500. */
  pollIntervalMs?: number;
  /** Test seam: terminal timeout (silence fallback, ms). Default 5 min. */
  terminalTimeoutMs?: number;
  /** Test seam: working directory for PtyDriver (default to resolved cwd). */
  cwd?: string;
  /** Test seam: inject a custom PtyDriver factory. Default creates real PtyDriver. */
  driverFactory?: (opts: PtyDriverOptions) => PtyDriver;
  /** Test seam: transcript directory override. */
  transcriptDirOverride?: string;
  /**
   * Absolute path to the MCP server entry point (dist/index.js).
   * Defaults to CAT_CAFE_MCP_SERVER_PATH env var or repo-layout heuristics.
   * Mirrors ClaudeBgCarrierService.mcpServerPath for AC-B3 parity.
   */
  mcpServerPath?: string;
  /** claude binary path override; default: 'claude'. 2.1.172 breaks transcript writes — use 2.1.170 for AC-B1/B4. */
  claudeBinary?: string;
}

/**
 * Carrier for `claude` interactive PTY mode (F230 Plan B).
 * Complements F198 `--bg` daemon; reads transcript from `~/.claude/projects/…/<session>.jsonl`.
 * Reuses: TranscriptTailer, BgTranscriptEventConsumer, transcriptEntriesToAgentMessages.
 */
export class ClaudeInteractivePtyCarrierService implements AgentService {
  readonly catId: CatId;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: used via `const { model } = this` destructuring in invoke()
  private readonly model: string;
  private readonly pollIntervalMs: number;
  private readonly terminalTimeoutMs: number;
  private readonly cwd: string;
  private readonly driverFactory: (opts: PtyDriverOptions) => PtyDriver;
  private readonly transcriptDirOverride: string | undefined;
  private readonly mcpServerPath: string | undefined;
  private readonly claudeBinary: string | undefined;
  /** Cached MCP config file path (created once per instance, reused across invocations). */
  private mcpConfigFilePath: string | undefined;

  constructor(options?: ClaudeInteractivePtyCarrierServiceOptions) {
    this.catId = options?.catId ?? createCatId('opus');
    this.model = getCatModel(this.catId) ?? 'claude-opus-4-8';
    this.pollIntervalMs = options?.pollIntervalMs ?? 500;
    this.terminalTimeoutMs = options?.terminalTimeoutMs ?? 5 * 60 * 1_000; // 5 min
    this.cwd = options?.cwd ?? process.cwd();
    this.driverFactory = options?.driverFactory ?? ((opts) => new PtyDriver(opts));
    this.transcriptDirOverride = options?.transcriptDirOverride;

    // Resolve MCP server path (mirrors ClaudeBgCarrierService pattern)
    const configuredPath = options?.mcpServerPath ?? process.env.CAT_CAFE_MCP_SERVER_PATH;
    if (configuredPath) {
      this.mcpServerPath = isAbsolute(configuredPath) ? configuredPath : resolve(process.cwd(), configuredPath);
    } else {
      this.mcpServerPath = resolveDefaultClaudeMcpServerPath();
    }

    this.claudeBinary = options?.claudeBinary;
  }

  /**
   * Invoke claude via interactive PTY.
   *
   * Lifecycle:
   *   start → injectPrompt → [yield session_init] → tail transcript → [yield text/tool_use/system_info]
   *   → turn_duration terminal signal → [yield done + usage] → dispose
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: async generator with cancellation, multiple error paths, and inline polling loop — extracting would worsen readability
  async *invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage> {
    const { catId, model, pollIntervalMs, terminalTimeoutMs } = this;

    // ─── Env construction (F230 D3 + KD-7: reuse buildClaudeEnvOverrides) ─────
    const callbackEnvWithMode: Record<string, string> = {
      [ANTHROPIC_PROFILE_MODE_KEY]: 'subscription',
      ...(options?.callbackEnv ?? {}),
    };
    const envOverrides = buildClaudeEnvOverrides(callbackEnvWithMode);
    if (options?.accountEnv) {
      for (const [k, v] of Object.entries(options.accountEnv)) {
        envOverrides[k] = v;
      }
    }
    // Hardcoded guard — always unset entrypoint vars (D3 double-safety)
    // These will map to env -u flags in PtyDriver.buildClaudeCommand().
    envOverrides.CLAUDE_CODE_ENTRYPOINT = null;
    envOverrides.CLAUDECODE = null;

    // PtyDriver: string → tmux -e KEY=VALUE; null → env -u. Proxy vars injected below (P2 F230 2026-06-11).
    const envDelta = envOverrides as Record<string, string | null>;
    // P2 proxy: explicitly forward network proxy vars — defeats tmux server env snapshot.
    Object.assign(
      envDelta,
      Object.fromEntries(
        ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy']
          .filter((k) => process.env[k] != null && !(k in envDelta))
          .map((k) => [k, process.env[k]]),
      ),
    );

    // ─── Model + args ──────────────────────────────────────────────────────────
    const { effectiveModel, useEnvModelOverride } = resolveClaudeModelSelection(options?.callbackEnv, model);
    const extraArgs: string[] = [];
    // --permission-mode bypassPermissions (F230 AC-B4, F198 Phase D parity)
    extraArgs.push('--permission-mode', 'bypassPermissions');
    // --model (skip if env-based override)
    if (!useEnvModelOverride) {
      extraArgs.push('--model', effectiveModel);
    }
    // --mcp-config + --strict-mcp-config (F230 AC-B3): gated on callbackEnv (no callback = MCP unusable).
    if (options?.callbackEnv && this.mcpServerPath && existsSync(this.mcpServerPath)) {
      // Write MCP config to temp file (file-based avoids inline JSON shell quoting issues).
      if (!this.mcpConfigFilePath || !existsSync(this.mcpConfigFilePath)) {
        const dir = mkdtempSync(join(tmpdir(), 'cat-cafe-pty-mcp-'));
        this.mcpConfigFilePath = join(dir, 'mcp-config.json');
        writeFileSync(
          this.mcpConfigFilePath,
          JSON.stringify({
            mcpServers: {
              'cat-cafe': { command: 'node', args: [this.mcpServerPath] },
            },
          }),
          'utf-8',
        );
      }
      extraArgs.push('--mcp-config', this.mcpConfigFilePath, '--strict-mcp-config');
    }
    const cwd = options?.workingDirectory ?? this.cwd;
    // R8: use accountEnv.HOME (if set) for transcriptDir derivation instead of API process homedir.
    const effectiveHome = options?.accountEnv?.HOME;
    const transcriptDir = this.transcriptDirOverride ?? ptyTranscriptDir(cwd, effectiveHome);
    // --resume (E4 P1-D): UUID regex + existsSync guards stale cross-carrier IDs (F230 alpha P1 2026-06-11).
    const resumeSessionId =
      options?.sessionId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.sessionId) &&
      existsSync(join(transcriptDir, `${options.sessionId}.jsonl`))
        ? options.sessionId
        : undefined;
    if (!resumeSessionId && options?.sessionId) {
      log.info({ sessionId: options.sessionId, transcriptDir }, 'stale sessionId — fresh session');
    }
    // `--session-id` removed (R10): flag writes ai-title only; real events go to a different UUID. PtyDriver watches via watchForTranscriptFile.

    // ─── Image inputs: extract paths, grant --add-dir, append path hints (F230 P2-image-inputs fix) ──
    const imagePaths = extractImagePaths(options?.contentBlocks, options?.uploadDir);
    const imageAccessDirs = collectImageAccessDirectories(imagePaths);
    const effectivePrompt = appendLocalImagePathHints(prompt, imagePaths);
    for (const dir of imageAccessDirs) {
      extraArgs.push('--add-dir', dir);
    }

    // ─── Driver setup ──────────────────────────────────────────────────────────
    const driver = this.driverFactory({
      cwd,
      env: envDelta,
      extraArgs,
      resumeSessionId,
      claudeBinary: this.claudeBinary,
      readyTimeoutMs: 30_000,
      readyGraceMs: 15_000,
    });

    // ─── Abort signal wiring ───────────────────────────────────────────────────
    let abortRequested = false;
    const abortListener = async () => {
      abortRequested = true;
      await driver.cancel().catch(() => void 0);
    };
    options?.signal?.addEventListener('abort', abortListener);

    // P2-abort fix: check if signal is already aborted before committing resources.
    // addEventListener('abort') does not fire if the signal was aborted before it was
    // attached; without this check, a pre-aborted signal would let the carrier proceed
    // through start() (30s+ grace) and injectPrompt(), wasting a Claude turn.
    if (options?.signal?.aborted) {
      options.signal.removeEventListener('abort', abortListener);
      yield { type: 'error', catId, error: 'cancelled before start (signal already aborted)', timestamp: Date.now() };
      yield { type: 'done', catId, isFinal: true, timestamp: Date.now() };
      return;
    }

    try {
      // ─── Start + inject ──────────────────────────────────────────────────────
      try {
        await driver.start();
      } catch (err) {
        yield {
          type: 'error',
          catId,
          error: `PtyDriver start failed: ${(err as Error).message}`,
          timestamp: Date.now(),
        };
        yield { type: 'done', catId, isFinal: true, timestamp: Date.now() };
        return;
      }

      // P2-abort-mid fix: re-check abort after start() completes.
      // The abort listener may have fired during start()'s 30 s grace window —
      // in that case abortRequested is now true but the event won't fire again.
      // Without this guard the carrier proceeds to injectPrompt(), wasting a turn.
      if (abortRequested) {
        yield { type: 'error', catId, error: 'cancelled during start', timestamp: Date.now() };
        yield { type: 'done', catId, isFinal: true, timestamp: Date.now() };
        return;
      }

      let transcriptPath: string;
      let sessionId: string;
      let initialLines: number | undefined;
      try {
        // F230 R10 root-cause fix (2026-06-11): PtyDriver uses watchForTranscriptFile to
        // discover the transcript — Claude generates its own UUID per session. For resume
        // sessions the path is deterministic (resumeSessionId.jsonl). No serialization gate
        // needed — each concurrent invocation operates on Claude's independently-generated UUID.
        ({ transcriptPath, sessionId, initialLines } = await driver.injectPrompt(effectivePrompt, transcriptDir));
      } catch (err) {
        yield {
          type: 'error',
          catId,
          error: `PtyDriver injectPrompt failed: ${(err as Error).message}`,
          timestamp: Date.now(),
        };
        yield { type: 'done', catId, isFinal: true, timestamp: Date.now() };
        return;
      }

      // ─── session_init ────────────────────────────────────────────────────────
      yield { type: 'session_init', catId, sessionId, timestamp: Date.now() };

      // ─── Tail transcript ──────────────────────────────────────────────────────
      // P1-B fix: for resume sessions, start tailer at initialLines to skip old content.
      // New sessions have initialLines=undefined → starts at 0 (default behavior unchanged).
      const tailer = new TranscriptTailer(transcriptPath, initialLines ?? 0);
      const acc = createUsageAccumulator();
      let lastActivityMs = Date.now();
      let terminal = false;

      while (!terminal) {
        if (abortRequested) {
          yield { type: 'error', catId, error: 'cancelled by abort signal', timestamp: Date.now() };
          yield { type: 'done', catId, isFinal: true, timestamp: Date.now() };
          return;
        }

        // P2 fix: when regular read returns nothing, do a final drain with
        // includeTrailingPartial:true. Handles the flush race where Claude writes
        // `system/turn_duration` without a trailing \n (mirrors bg-carrier pattern).
        let entries = await tailer.readNew();
        if (entries.length === 0) {
          entries = await tailer.readNew({ includeTrailingPartial: true });
        }
        if (entries.length > 0) {
          lastActivityMs = Date.now();
          accumulateUsageFromEntries(acc, entries);

          // Emit messages from this batch
          const messages = transcriptEntriesToAgentMessages(entries, { catId });
          for (const msg of messages) {
            yield msg;
          }

          // Detect terminal event: system/turn_duration (D4)
          for (const raw of entries) {
            const entry = raw as Record<string, unknown>;
            if (entry.type === 'system' && entry.subtype === 'turn_duration') {
              log.debug({ catId, sessionId }, 'terminal event: turn_duration');
              terminal = true;
              break;
            }
          }
        } else {
          // Silence fallback: if no new entries for terminalTimeoutMs → done
          if (Date.now() - lastActivityMs > terminalTimeoutMs) {
            log.warn({ catId, sessionId, terminalTimeoutMs }, 'transcript silence timeout, treating as done');
            terminal = true;
          } else {
            await sleep(pollIntervalMs);
          }
        }
      }

      // ─── done + usage ─────────────────────────────────────────────────────────
      const usage: TokenUsage = finalizeTranscriptUsage(acc);
      yield {
        type: 'done',
        catId,
        isFinal: true,
        timestamp: Date.now(),
        metadata: { model: effectiveModel, usage, provider: 'claude_interactive_pty' },
      };
    } finally {
      options?.signal?.removeEventListener('abort', abortListener);
      await driver.dispose();
    }
  }
}
