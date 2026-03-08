/**
 * Antigravity CDP Client
 * Chrome DevTools Protocol bridge to Antigravity IDE (Electron).
 *
 * Phase 0 spike 已验证:
 * - 消息注入: document.execCommand('insertText') (Lexical 编辑器唯一有效方式)
 * - 注入前必须 click 获焦
 * - 回复读取: <p> 元素 DOM polling
 * - Target 发现: /json 获取, 过滤 Launchpad
 * - CDP 端口: 9000 (~/.antigravity/argv.json)
 */

export interface CdpTarget {
  title: string;
  webSocketDebuggerUrl: string;
  type: string;
  url: string;
}

export interface AntigravityCdpClientOptions {
  port?: number;
  host?: string;
  /** Substring to match in target title (e.g. project name) to avoid multi-window misrouting */
  titleHint?: string;
  /** Default timeout for CDP commands in ms (default: 10_000) */
  commandTimeoutMs?: number;
  /** Timeout for initial WebSocket connection in ms (default: 5_000) */
  connectTimeoutMs?: number;
  /** Timeout for target discovery fetch in ms (default: 5_000) */
  fetchTimeoutMs?: number;
}

export interface FindEditorTargetOptions {
  /** Substring to match in target title (e.g. project name) to avoid multi-window misrouting */
  titleHint?: string;
}

export interface PollResponseOptions {
  /** Number of visible user messages expected once sendMessage() has committed */
  expectedUserMessageCount?: number;
  /** Test hook: shorten polling cadence for unit tests */
  pollIntervalMs?: number;
  /** Require the same response text this many polls in a row before returning */
  stablePollCount?: number;
}

import { NEW_CONVERSATION_JS, POLL_RESPONSE_JS } from './cdp-dom-scripts.js';

function isMissingCdpMethod(error: unknown, method: string): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(`'${method}' wasn't found`) || message.includes('Method not found');
}

/** Pick the editor page target, skip Launchpad / iframes / workers.
 *  When titleHint is provided, prefer targets whose title contains it. */
export function findEditorTarget(targets: CdpTarget[], options?: FindEditorTargetOptions): CdpTarget | null {
  const pages = targets.filter((t) => t.type === 'page' && !t.title.includes('Launchpad') && t.webSocketDebuggerUrl);
  if (pages.length === 0) return null;

  if (options?.titleHint) {
    const hinted = pages.find((t) => t.title.includes(options.titleHint!));
    if (hinted) return hinted;
  }
  return pages[0] ?? null;
}

export class AntigravityCdpClient {
  private readonly port: number;
  private readonly host: string;
  private readonly titleHint: string | undefined;
  private readonly commandTimeoutMs: number;
  private readonly connectTimeoutMs: number;
  private readonly fetchTimeoutMs: number;
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
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get baseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  /** Fetch targets and connect to editor page.
   *  @param runtimeTitleHint — overrides constructor titleHint (e.g. derived from workingDirectory) */
  async connect(runtimeTitleHint?: string): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/json`, {
      signal: AbortSignal.timeout(this.fetchTimeoutMs),
    });
    const targets = (await resp.json()) as CdpTarget[];
    const hint = runtimeTitleHint ?? this.titleHint;
    const target = findEditorTarget(targets, hint ? { titleHint: hint } : undefined);
    if (!target) {
      throw new Error(
        `No Antigravity editor page found on port ${this.port}. ` +
          `Targets: ${targets.map((t) => t.title).join(', ')}`,
      );
    }

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

    // When WebSocket closes or errors, reject all pending commands immediately
    // instead of waiting for individual timeouts (prevents "silent stall").
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

    await this.cdp('Runtime.enable');
    try {
      await this.cdp('Input.enable');
    } catch (error) {
      // Newer Antigravity/Chrome targets may not expose Input.enable, but
      // Input.dispatch* still works. Treat that protocol drift as non-fatal.
      if (!isMissingCdpMethod(error, 'Input.enable')) throw error;
    }
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

  /** Inject message into Antigravity chat and send */
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

    // 4. Press Enter to send
    await new Promise((r) => setTimeout(r, 200));
    await this.cdp('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
    });
    await this.cdp('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
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
