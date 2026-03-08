/**
 * Antigravity CDP Client
 * Chrome DevTools Protocol bridge to Antigravity IDE (Electron).
 *
 * Target selection logic lives in cdp-target-selection.ts.
 * Inline DOM scripts live in cdp-dom-scripts.ts.
 */

import { DISPATCH_ENTER_JS, FIND_SEND_BUTTON_JS, NEW_CONVERSATION_JS, POLL_RESPONSE_JS } from './cdp-dom-scripts.js';
import { rankEditorTargets } from './cdp-target-selection.js';
import type { CdpTarget } from './cdp-target-selection.js';

// Re-export for backward compatibility (tests import from here)
export { findEditorTarget, rankEditorTargets, normaliseHint } from './cdp-target-selection.js';
export type { CdpTarget, FindEditorTargetOptions } from './cdp-target-selection.js';

export interface AntigravityCdpClientOptions {
  port?: number;
  host?: string;
  titleHint?: string;
  commandTimeoutMs?: number;
  connectTimeoutMs?: number;
  fetchTimeoutMs?: number;
  /** Timeout for health probe evaluate('1') during connect in ms (default: 2_000) */
  probeTimeoutMs?: number;
  /** Enable debug logging (target list, probe results, selected target) */
  debug?: boolean;
}

export interface PollResponseOptions {
  expectedUserMessageCount?: number;
  pollIntervalMs?: number;
  stablePollCount?: number;
}

function isMissingCdpMethod(error: unknown, method: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(`'${method}' wasn't found`) || message.includes('Method not found');
}

export class AntigravityCdpClient {
  private readonly port: number;
  private readonly host: string;
  private readonly titleHint: string | undefined;
  private readonly commandTimeoutMs: number;
  private readonly connectTimeoutMs: number;
  private readonly fetchTimeoutMs: number;
  private readonly probeTimeoutMs: number;
  private readonly debug: boolean;
  private ws: WebSocket | null = null;
  private idCounter = 0;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(options?: AntigravityCdpClientOptions) {
    this.port = options?.port ?? 9000;
    this.host = options?.host ?? 'localhost';
    this.titleHint = options?.titleHint;
    this.commandTimeoutMs = options?.commandTimeoutMs ?? 10_000;
    this.connectTimeoutMs = options?.connectTimeoutMs ?? 5_000;
    this.fetchTimeoutMs = options?.fetchTimeoutMs ?? 5_000;
    this.probeTimeoutMs = options?.probeTimeoutMs ?? 2_000;
    this.debug = options?.debug ?? !!process.env['CDP_DEBUG'];
  }

  private log(...args: unknown[]): void {
    if (this.debug) console.log('[CDP]', ...args);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get baseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  /** Fetch targets, probe candidates for health, and connect to the best one.
   *  @param runtimeTitleHint — overrides constructor titleHint (e.g. derived from workingDirectory) */
  async connect(runtimeTitleHint?: string): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/json`, {
      signal: AbortSignal.timeout(this.fetchTimeoutMs),
    });
    const targets = (await resp.json()) as CdpTarget[];
    const hint = runtimeTitleHint ?? this.titleHint;

    this.log('targets:', targets.map((t) => ({ id: t.id, type: t.type, title: t.title, url: t.url })));

    const candidates = rankEditorTargets(targets, hint ? { titleHint: hint } : undefined);
    if (candidates.length === 0) {
      throw new Error(
        `No Antigravity editor page found on port ${this.port}. ` +
          `Targets: ${targets.map((t) => `${t.type}:${t.title}`).join(', ')}`,
      );
    }

    // Probe candidates in priority order — first one that passes evaluate('1') wins.
    for (const candidate of candidates) {
      this.log('probing:', candidate.title, candidate.url);
      try {
        await this.connectToTarget(candidate);
        await this.cdp('Runtime.enable');
        // Health probe — must respond within probeTimeoutMs
        await this.evaluate('1', this.probeTimeoutMs);
        this.log('probe OK:', candidate.title);
        try {
          await this.cdp('Input.enable');
        } catch (error) {
          if (!isMissingCdpMethod(error, 'Input.enable')) throw error;
        }
        return; // healthy — done
      } catch (err) {
        this.log('probe FAIL:', candidate.title, err instanceof Error ? err.message : err);
        await this.disconnect();
      }
    }

    throw new Error(
      `All ${candidates.length} CDP candidates failed health probe. ` +
        `Tried: ${candidates.map((t) => t.title).join(', ')}`,
    );
  }

  /** Low-level: open WebSocket to a specific target and wire up handlers. */
  private async connectToTarget(target: CdpTarget): Promise<void> {
    this.ws = new WebSocket(target.webSocketDebuggerUrl);
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        clearTimeout(p.timer);
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      }
    };

    const rejectAllPending = (reason: string) => {
      for (const [id, p] of this.pending) {
        clearTimeout(p.timer);
        this.pending.delete(id);
        p.reject(new Error(reason));
      }
    };
    this.ws.onclose = () => rejectAllPending('CDP WebSocket closed unexpectedly');
    this.ws.onerror = () => rejectAllPending('CDP WebSocket error');

    const ws = this.ws;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`CDP WebSocket connect timeout (${this.connectTimeoutMs}ms)`));
        ws.close();
      }, this.connectTimeoutMs);
      ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      const prevOnerror = ws.onerror;
      ws.onerror = (e) => {
        clearTimeout(timer);
        if (typeof prevOnerror === 'function') prevOnerror.call(ws, e);
        reject(new Error(`CDP WebSocket error during connect`));
      };
    });
  }

  async disconnect(): Promise<void> {
    // Clear all pending command timers before closing
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
    }
    this.pending.clear();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  /** Send a CDP command and await result.
   *  @param timeoutMs — override default command timeout for this call */
  async cdp(method: string, params: Record<string, unknown> = {}, timeoutMs?: number): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('CDP not connected');
    }
    const id = ++this.idCounter;
    const effectiveTimeout = timeoutMs ?? this.commandTimeoutMs;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout for ${method} (${effectiveTimeout}ms)`));
        }
      }, effectiveTimeout);
      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Evaluate JS in the Antigravity page.
   *  Surfaces CDP-level exceptions (e.g. syntax errors in expression). */
  async evaluate<T = unknown>(expression: string, timeoutMs?: number): Promise<T> {
    const result = (await this.cdp('Runtime.evaluate', { expression }, timeoutMs)) as {
      result: { value: T; type?: string; subtype?: string; description?: string };
      exceptionDetails?: { text: string; exception?: { description?: string } };
    };
    if (result.exceptionDetails) {
      const desc = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`CDP evaluate error: ${desc}`);
    }
    return result.result.value;
  }

  /** Inject message into Antigravity chat and send.
   *  Send uses a multi-strategy approach for resilience across Antigravity versions:
   *  1. Click the send button (most reliable — bypasses keyboard event routing)
   *  2. JS KeyboardEvent dispatch (Lexical-compatible, runs in renderer)
   *  3. CDP Input.dispatchKeyEvent (Chrome input pipeline, least reliable for Electron) */
  async sendMessage(text: string): Promise<void> {
    if (!this.connected) throw new Error('CDP not connected');

    // 1. Find and click the textbox to focus
    const tbInfo = await this.evaluate<string | null>(`(() => {
      const tb = document.querySelector('[role="textbox"][contenteditable="true"]');
      if (!tb) return null;
      const r = tb.getBoundingClientRect();
      return JSON.stringify({ x: r.x + r.width/2, y: r.y + r.height/2 });
    })()`);

    if (!tbInfo) throw new Error('Antigravity chat textbox not found');
    const { x, y } = JSON.parse(tbInfo);
    await this.clickAt(x, y);

    // 2. Small delay for focus
    await new Promise((r) => setTimeout(r, 300));

    // 3. Inject text via execCommand (Lexical hook)
    await this.evaluate(`document.execCommand('insertText', false, ${JSON.stringify(text)})`);
    await new Promise((r) => setTimeout(r, 200));

    // 4. Send — multi-strategy (try each until one succeeds)
    // Strategy A: Find and click the send button
    const sendBtnInfo = await this.evaluate<string | null>(FIND_SEND_BUTTON_JS);
    if (sendBtnInfo) {
      const btn = JSON.parse(sendBtnInfo);
      await this.clickAt(btn.x, btn.y);
      return;
    }

    // Strategy B: JS-level KeyboardEvent dispatch (Lexical catches these)
    const dispatched = await this.evaluate<boolean>(DISPATCH_ENTER_JS);
    if (dispatched) return;

    // Strategy C: CDP Input.dispatchKeyEvent (last resort)
    await this.cdp('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
    });
    await this.cdp('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
    });
  }

  /** Dispatch a mouse click at (x, y) via CDP Input events. */
  private async clickAt(x: number, y: number): Promise<void> {
    await this.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }

  /** Poll DOM for model response. Returns text or null on timeout. */
  async pollResponse(timeoutMs = 60_000, options?: PollResponseOptions): Promise<string | null> {
    if (!this.connected) throw new Error('CDP not connected');

    const start = Date.now();
    const pollInterval = options?.pollIntervalMs ?? 1_000;
    const stablePollCount = options?.stablePollCount ?? 2;
    const expectedUserMessageCount =
      options?.expectedUserMessageCount ??
      (await this.evaluate<number>(`document.querySelectorAll('.whitespace-pre-wrap').length`));
    let lastResponseText = '';
    let stablePolls = 0;

    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, pollInterval));

      const state = await this.evaluate<string>(POLL_RESPONSE_JS);
      const { userMsgCount, responseText, hasInlineLoading } = JSON.parse(state) as {
        userMsgCount: number;
        responseText: string;
        hasInlineLoading: boolean;
      };

      if (userMsgCount >= expectedUserMessageCount && responseText) {
        if (hasInlineLoading) {
          lastResponseText = responseText;
          stablePolls = 0;
          continue;
        }
        if (responseText === lastResponseText) {
          stablePolls += 1;
        } else {
          lastResponseText = responseText;
          stablePolls = 1;
        }
        if (stablePolls >= stablePollCount) return responseText;
      }
    }
    return null;
  }

  /** Click + button to start new conversation. */
  async newConversation(): Promise<void> {
    if (!this.connected) throw new Error('CDP not connected');
    const btnInfo = await this.evaluate<string | null>(NEW_CONVERSATION_JS);
    if (!btnInfo) throw new Error('New conversation button not found');
    const { x, y } = JSON.parse(btnInfo);
    await this.clickAt(x, y);
    await new Promise((r) => setTimeout(r, 1000));
  }
}
