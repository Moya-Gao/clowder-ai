/**
 * F198 Phase B: ClaudeBgCarrierService
 *
 * Carrier that invokes Claude Code via `claude --bg` (Anthropic Agent View
 * daemon mode, available since v2.1.139).
 *
 * Goals vs the legacy `claude -p` ClaudeAgentService:
 *   - Avoid the `-p` flag → claude binary no longer self-sets
 *     CLAUDE_CODE_ENTRYPOINT=sdk-cli (KD-9 + spike empirically confirmed)
 *   - Consume jsonl event stream from ~/.claude/jobs/<short>/ instead of
 *     stdout NDJSON
 *   - 客户端层证据指向走订阅 quota；服务端 billing 仍 pending 6/15 dashboard
 *     / Anthropic dev support confirm
 *
 * Initial production cut — minimal AgentService implementation. Image hints,
 * accountEnv overrides, MCP injection, session resume, OTel spans, etc are
 * intentionally deferred to the integration step that wires this service into
 * the existing routing layer. Spec section: F198 Phase B (KD-10).
 *
 * 砚砚 review guards integrated:
 *   1. state==='error' → throws CarrierError (AgentMessage type='error' yielded
 *      before throw)
 *   2. child.on('error') → reject promise (ENOENT / spawn failure)
 *   3. JobEventConsumer parses jsonl per-line with try/catch (delegated)
 */
import { spawn } from 'node:child_process';
import { type CatId, createCatId } from '@cat-cafe/shared';
import { getCatModel } from '../../../../../config/cat-models.js';
import { resolveCliCommandOrBare } from '../../../../../utils/cli-resolve.js';
import { buildChildEnv } from '../../../../../utils/cli-spawn.js';
import type { AgentMessage, AgentService, AgentServiceOptions } from '../../types.js';
import {
  ANTHROPIC_PROFILE_MODE_KEY,
  buildClaudeEnvOverrides,
  resolveClaudeModelSelection,
} from './ClaudeAgentService.js';
import { JobEventConsumer } from './JobEventConsumer.js';

const SHORT_ID_PATTERN = /backgrounded\s*·\s*([a-f0-9]{8})/;

export class CarrierError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'CarrierError';
    this.cause = cause;
  }
}

export interface ClaudeBgCarrierServiceOptions {
  catId?: CatId;
  model?: string;
  /** Test seam — replaces the real spawn call. */
  spawnFn?: typeof spawn;
  /** Test seam — override default ~/.claude/jobs base dir. */
  jobsDir?: string;
}

interface StartJobResult {
  shortId: string;
  consumer: JobEventConsumer;
  /**
   * codex round-8 P2: the effective model the spawned job is actually running.
   * May differ from `this.model` when callbackEnv.CAT_CAFE_ANTHROPIC_MODEL_OVERRIDE
   * is set or when api_key routing omits --model and env decides.
   * Caller (invoke) propagates this into metadata for accurate observability.
   */
  effectiveModel: string;
}

/**
 * Service wrapper for invoking Claude via `claude --bg`.
 *
 * F198 KD-10: replaces `-p` mode carrier path for clients that want
 * entrypoint=cli (client-layer evidence for subscription quota routing).
 */
export class ClaudeBgCarrierService implements AgentService {
  readonly catId: CatId;
  private readonly model: string;
  private readonly spawnFn: typeof spawn;
  private readonly jobsDir?: string;

  constructor(options?: ClaudeBgCarrierServiceOptions) {
    this.catId = options?.catId ?? createCatId('opus');
    this.model = options?.model ?? getCatModel(this.catId as string);
    this.spawnFn = options?.spawnFn ?? spawn;
    this.jobsDir = options?.jobsDir;
  }

  /**
   * Best-effort `claude stop <shortId>` — fire-and-forget cleanup after
   * abort / timeout / unexpected wait failure. Errors are intentionally
   * swallowed: the caller is already throwing, and we don't want stop()
   * failures to mask the original cause.
   *
   * codex review (PR #1666 round 5) P1.2.
   */
  private bestEffortStop(shortId: string): void {
    try {
      const child = this.spawnFn(resolveCliCommandOrBare('claude'), ['stop', shortId], {
        stdio: 'ignore',
      });
      // Detach so stop() doesn't keep the event loop alive
      child.unref?.();
      child.on('error', () => {
        /* swallow — best effort */
      });
    } catch {
      /* swallow — best effort */
    }
  }

  /**
   * Launch a `claude --bg <prompt>` background job and resolve once the
   * daemon supervisor has acknowledged the dispatch with a short id.
   *
   * 砚砚 guard #2: child.on('error') ensures ENOENT / EACCES / spawn failures
   * reject instead of hanging.
   */
  async startJob(prompt: string, options?: AgentServiceOptions): Promise<StartJobResult> {
    return new Promise<StartJobResult>((resolve, reject) => {
      // Critical: even with --bg, the child inherits parent env unless we
      // explicitly strip CLAUDE_CODE_ENTRYPOINT. Otherwise transcript entrypoint
      // becomes sdk-cli regardless of flag. See F198 spike commit 8c5da78c7.
      //
      // F198 refactor (CVO directive 2026-05-14): delegate env construction
      // to the shared `buildClaudeEnvOverrides` helper (exported from
      // ClaudeAgentService) instead of re-implementing 80% of subscription/
      // ENTRYPOINT/Anthropic-clearing rules. Coordinate-system fix for the
      // round-6 补锅 pattern — single source of truth for Claude carrier env.
      //
      // Default to subscription mode unless caller explicitly sets mode in
      // callbackEnv. accountEnv applied LAST (F171). Entrypoint guard FINAL
      // (AC-B6 invariant — never accept ENTRYPOINT poisoning via either env).
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
      envOverrides.CLAUDE_CODE_ENTRYPOINT = null;
      envOverrides.CLAUDECODE = null;
      const env = buildChildEnv(envOverrides);

      // F198 codex round-7 B-prime refactor: model selection delegates to
      // ClaudeAgentService.resolveClaudeModelSelection so we don't drift
      // from production --model handling. Resolves:
      // - callbackEnv MODEL_OVERRIDE_KEY (per-invocation override)
      // - api_key + non-Anthropic model → omit --model (let env drive)
      const { effectiveModel, useEnvModelOverride } = resolveClaudeModelSelection(options?.callbackEnv, this.model);
      const args = useEnvModelOverride ? ['--bg', prompt] : ['--bg', prompt, '--model', effectiveModel];

      // codex review (PR #1666 round 4) P1: resolve claude binary so hosts
      // with claude installed-but-not-on-PATH (production runtime envs
      // launched via systemd/pm2/launchd) don't fail with ENOENT. Matches
      // existing ClaudeAgentService pattern (utils/cli-resolve.ts).
      const claudeCommand = resolveCliCommandOrBare('claude');

      // codex round 6 P1.3: propagate AbortSignal into spawn so cancellation
      // during the 5-15s startup window kills the child via SIGTERM. Without
      // this, abort during startJob() never reaches waitForTerminal()'s
      // bestEffortStop cleanup path and leaks the daemon job.
      const child = this.spawnFn(claudeCommand, args, {
        cwd: options?.workingDirectory ?? process.cwd(),
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        signal: options?.signal,
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (err: unknown, result?: StartJobResult) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else if (result) resolve(result);
      };

      child.on('error', (err) => {
        finish(new CarrierError(`claude --bg spawn failed: ${(err as Error).message}`, err));
      });
      child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));

      child.on('close', (code) => {
        if (code !== 0) {
          return finish(new CarrierError(`claude --bg exited code=${code}: ${stderr.slice(0, 300)}`));
        }
        const match = SHORT_ID_PATTERN.exec(stdout);
        if (!match) {
          return finish(new CarrierError(`Could not parse short id from claude --bg stdout: ${stdout.slice(0, 300)}`));
        }
        const shortId = match[1];
        finish(null, {
          shortId,
          consumer: new JobEventConsumer(shortId, { jobsDir: this.jobsDir }),
          effectiveModel,
        });
      });
    });
  }

  /**
   * AgentService contract: invoke and stream back AgentMessages.
   *
   * Initial cut: emits session_init → done/error based on terminal state.
   * Streaming partial tokens / tool_use events is deferred to integration
   * (transcript jsonl tail). state.json + timeline.jsonl already give a
   * complete answer for short prompts, which covers the prototype scope.
   *
   * 砚砚 guard #1: state==='error' → emits error AgentMessage AND throws so
   * upstream routing distinguishes terminal failure from successful done.
   */
  async *invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage> {
    const startedAt = Date.now();
    // codex round-8 P2: receive effective model from startJob so metadata
    // reflects what was actually spawned (not this.model fallback when
    // callbackEnv MODEL_OVERRIDE_KEY or api_key env routing changes the run).
    const { shortId, consumer, effectiveModel } = await this.startJob(prompt, options);

    yield {
      type: 'session_init',
      catId: this.catId,
      sessionId: shortId,
      timestamp: Date.now(),
      metadata: { provider: 'claude-bg', model: effectiveModel },
    };

    // codex review (PR #1666 round 4) P1: honor AbortSignal during the long
    // poll — otherwise cancellation from invoke-single-cat can't stop our
    // 30-min default polling loop, leaving daemon jobs running and burning
    // resources. Pass signal through.
    //
    // codex review (PR #1666 round 5) P1.2: when waitForTerminal throws
    // (abort / timeout / unexpected fs error), issue a best-effort
    // `claude stop <shortId>` so the detached --bg session stops consuming
    // quota instead of leaking until natural completion or manual cleanup.
    let terminal: Awaited<ReturnType<typeof consumer.waitForTerminal>>;
    try {
      terminal = await consumer.waitForTerminal({ signal: options?.signal });
    } catch (err) {
      this.bestEffortStop(shortId);
      throw err;
    }

    if (terminal.state === 'error') {
      // codex review (PR #1666) P1.1 (round 1): yield error AgentMessage and
      // STOP — do NOT throw. invoke-single-cat.ts catches iterator throws and
      // converts them into another error + done event, which would produce
      // duplicate error events. Pattern matches existing ClaudeAgentService
      // isCliError branch.
      //
      // codex review (PR #1666) P1.1 (round 2): must STILL emit terminal done
      // after the error. route-serial.ts / route-parallel.ts key completion
      // and flush/ack logic off `done` events — error-without-done would
      // miscount completion + skip per-cat flush.
      yield {
        type: 'error',
        catId: this.catId,
        sessionId: shortId,
        error: terminal.detail ?? 'claude --bg job ended in error state',
        timestamp: Date.now(),
      };
      yield {
        type: 'done',
        catId: this.catId,
        sessionId: shortId,
        timestamp: Date.now(),
        metadata: {
          provider: 'claude-bg',
          model: effectiveModel,
          diagnostics: { terminalState: 'error', durationMs: Date.now() - startedAt },
        },
      };
      return;
    }

    const resultText = terminal.output?.result;
    if (resultText) {
      yield {
        type: 'text',
        catId: this.catId,
        sessionId: shortId,
        content: resultText,
        timestamp: Date.now(),
      };
    }

    yield {
      type: 'done',
      catId: this.catId,
      sessionId: shortId,
      timestamp: Date.now(),
      metadata: {
        provider: 'claude-bg',
        model: effectiveModel,
        diagnostics: { durationMs: Date.now() - startedAt },
      },
    };
  }
}
