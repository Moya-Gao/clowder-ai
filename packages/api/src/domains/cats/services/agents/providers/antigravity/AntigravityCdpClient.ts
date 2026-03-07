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
}

export interface FindEditorTargetOptions {
  /** Substring to match in target title (e.g. project name) to avoid multi-window misrouting */
  titleHint?: string;
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
  private ws: WebSocket | null = null;
  private idCounter = 0;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
    }
  >();

  constructor(options?: AntigravityCdpClientOptions) {
    this.port = options?.port ?? 9000;
    this.host = options?.host ?? 'localhost';
    this.titleHint = options?.titleHint;
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
    const resp = await fetch(`${this.baseUrl}/json`);
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
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      }
    };

    await new Promise<void>((resolve, reject) => {
      this.ws!.onopen = () => resolve();
      this.ws!.onerror = (e) => reject(new Error(`CDP WebSocket error: ${e}`));
    });

    await this.cdp('Runtime.enable');
    await this.cdp('Input.enable');
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pending.clear();
  }

  /** Send a CDP command and await result */
  async cdp(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('CDP not connected');
    }
    const id = ++this.idCounter;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout for ${method}`));
        }
      }, 10_000);
    });
  }

  /** Evaluate JS in the Antigravity page */
  async evaluate<T = unknown>(expression: string): Promise<T> {
    const result = (await this.cdp('Runtime.evaluate', { expression })) as { result: { value: T } };
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

    await this.cdp('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await this.cdp('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });

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

  /** Poll DOM for model response. Returns text or null on timeout.
   *  P1-3 fix: uses the container *after* the last user message rather than
   *  the global last <p>, which could pick up unrelated page text. */
  async pollResponse(timeoutMs = 60_000): Promise<string | null> {
    if (!this.connected) throw new Error('CDP not connected');

    const start = Date.now();
    const pollInterval = 1_000;

    // Snapshot: count user messages so we can detect when a new exchange completes
    const baselineCount = await this.evaluate<number>(`document.querySelectorAll('.whitespace-pre-wrap').length`);

    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, pollInterval));

      const state = await this.evaluate<string>(`(() => {
        const loading = document.querySelector('.codicon-loading');
        const userMsgs = document.querySelectorAll('.whitespace-pre-wrap');

        // Find the last user message, then collect all <p> text from
        // sibling/subsequent containers (= the assistant response).
        let responseText = '';
        if (userMsgs.length > 0) {
          const lastUserMsg = userMsgs[userMsgs.length - 1];
          // Walk up to the message-level container (group), then look for
          // the next sibling group which holds the assistant reply.
          const userGroup = lastUserMsg.closest('.group') || lastUserMsg.parentElement;
          if (userGroup) {
            let sibling = userGroup.nextElementSibling;
            const parts = [];
            while (sibling) {
              const ps = sibling.querySelectorAll('p');
              for (const p of ps) {
                const t = p.textContent?.trim();
                if (t) parts.push(t);
              }
              sibling = sibling.nextElementSibling;
            }
            responseText = parts.join('\\n');
          }
        }

        return JSON.stringify({
          loading: !!loading,
          userMsgCount: userMsgs.length,
          responseText,
        });
      })()`);

      const { loading, userMsgCount, responseText } = JSON.parse(state);

      // Response arrived when: not loading, new user message visible, and response text found
      if (!loading && userMsgCount > baselineCount && responseText) {
        return responseText;
      }
    }
    return null;
  }

  /** Click + button to start new conversation.
   *  P2 fix: uses aria-label / title / SVG icon matching instead of hardcoded coordinates. */
  async newConversation(): Promise<void> {
    if (!this.connected) throw new Error('CDP not connected');

    const btnInfo = await this.evaluate<string | null>(`(() => {
      // Strategy 1: aria-label or title containing "new" / "chat" / "conversation"
      const candidates = document.querySelectorAll('a, button');
      for (const el of candidates) {
        const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
        if (label.includes('new') && (label.includes('chat') || label.includes('conversation'))) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
          }
        }
      }

      // Strategy 2: find the + icon (codicon-add or SVG plus) in the chat header area
      const icons = document.querySelectorAll('.codicon-add, [class*="plus"]');
      for (const icon of icons) {
        const clickable = icon.closest('a, button');
        if (clickable) {
          const r = clickable.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.y < 80) {
            return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
          }
        }
      }

      // Strategy 3: fallback to first small header link (original heuristic, no x constraint)
      const links = document.querySelectorAll('a.group.relative');
      for (const a of links) {
        const r = a.getBoundingClientRect();
        if (r.y > 20 && r.y < 80 && r.width < 50 && r.width > 0) {
          return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
        }
      }

      return null;
    })()`);

    if (!btnInfo) throw new Error('New conversation button not found');
    const { x, y } = JSON.parse(btnInfo);
    await this.cdp('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await this.cdp('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await new Promise((r) => setTimeout(r, 1000));
  }
}
