/**
 * Quota Route — F051 真实猫粮额度 API
 *
 * 数据源：
 * 1. Claude: ccusage CLI（官方工具，直接输出计费数据）
 * 2. Codex: 浏览器抓取 chatgpt.com/codex/settings/usage（AI 猫推送）
 * 3. Antigravity: 待接入（下一迭代）
 *
 * 硬约束：看板值 = 官方页面值，不二次换算。抓取失败显示"抓取失败"。
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FastifyInstance } from 'fastify';
import puppeteer from 'puppeteer';
import { z } from 'zod';

const execFileAsync = promisify(execFile);

// --- Types ---

/** ccusage blocks --json 的单个 billing block */
export interface CcusageBillingBlock {
  id: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  isGap: boolean;
  entries: number;
  totalTokens: number;
  costUSD: number;
  models: string[];
  burnRate: { tokensPerMinute: number; costPerHour: number } | null;
  projection: {
    totalTokens: number;
    totalCost: number;
    remainingMinutes: number;
  } | null;
}

export interface ClaudeQuota {
  platform: 'claude';
  activeBlock: CcusageBillingBlock | null;
  usageItems?: CodexUsageItem[];
  recentBlocks: CcusageBillingBlock[];
  error?: string;
  lastChecked: string | null;
}

export interface CodexUsageItem {
  label: string;
  usedPercent: number;
  percentKind?: 'used' | 'remaining';
  resetsAt?: string;
  resetsText?: string;
}

export interface CodexQuota {
  platform: 'codex';
  usageItems: CodexUsageItem[];
  error?: string;
  lastChecked: string | null;
}

export interface AntigravityQuota {
  platform: 'antigravity';
  status: 'not-yet-implemented';
  hint: string;
}

export interface QuotaResponse {
  claude: ClaudeQuota;
  codex: CodexQuota;
  antigravity: AntigravityQuota;
  fetchedAt: string;
}

// --- In-memory cache ---

let claudeCache: ClaudeQuota = {
  platform: 'claude',
  activeBlock: null,
  recentBlocks: [],
  lastChecked: null,
};

let codexCache: CodexQuota = {
  platform: 'codex',
  usageItems: [],
  lastChecked: null,
};

const ANTIGRAVITY: AntigravityQuota = {
  platform: 'antigravity',
  status: 'not-yet-implemented',
  hint: '暹罗猫额度待接入（下一迭代）',
};

const OFFICIAL_CDP_URL_ENV = 'QUOTA_BROWSER_CDP_URL';
const AUTO_START_BROWSER_ENV = 'QUOTA_BROWSER_AUTO_START';
const LOCAL_CDP_CANDIDATES = [
  'http://127.0.0.1:9222',
  'http://localhost:9222',
  'http://127.0.0.1:9223',
  'http://localhost:9223',
  'http://127.0.0.1:9333',
  'http://localhost:9333',
] as const;
const DEFAULT_CDP_PORT = 9222;
const DEFAULT_CDP_URL = `http://127.0.0.1:${DEFAULT_CDP_PORT}`;

function parsePercentLine(line: string): number | null {
  const match = line.match(/(\d{1,3})\s*%/);
  if (!match) return null;
  const value = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function pickNear(lines: string[], idx: number, pattern: RegExp): string | undefined {
  for (let offset = 1; offset <= 4; offset += 1) {
    const candidate = lines[idx + offset];
    if (!candidate) break;
    if (pattern.test(candidate)) return candidate;
  }
  return undefined;
}

export function parseCodexUsageFromPageText(pageText: string): CodexUsageItem[] {
  const lines = pageText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const defs = [
    {
      token: /^(GPT-5\.3-Codex-Spark\s*5\s*小时使用限额|GPT-5\.3-Codex-Spark\s*5(?:\s|-)?hour\s*usage\s*limit)$/i,
      label: 'GPT-5.3-Codex-Spark 5小时使用限额',
    },
    {
      token: /^(GPT-5\.3-Codex-Spark\s*每周使用限额|GPT-5\.3-Codex-Spark\s*weekly\s*usage\s*limit)$/i,
      label: 'GPT-5.3-Codex-Spark 每周使用限额',
    },
    { token: /^(5\s*小时使用限额|5(?:\s|-)?hour usage limit)$/i, label: '5小时使用限额' },
    { token: /^(每周使用限额|weekly usage limit)$/i, label: '每周使用限额' },
    { token: /(代码审查|code review)/i, label: '代码审查' },
  ] as const;

  const items: CodexUsageItem[] = [];
  for (const def of defs) {
    const idx = lines.findIndex((l) => def.token.test(l));
    if (idx < 0) continue;
    const percentLine = pickNear(lines, idx, /%/);
    const resetLine = pickNear(lines, idx, /(重置时间|resets?)/i);
    if (!percentLine) continue;
    const remaining = parsePercentLine(percentLine);
    if (remaining == null) continue;
    items.push({
      label: def.label,
      // Keep official value as-is: OpenAI page exposes remaining%
      usedPercent: remaining,
      percentKind: 'remaining',
      ...(resetLine ? { resetsText: resetLine } : {}),
    });
  }
  return items;
}

export function parseClaudeUsageFromPageText(pageText: string): CodexUsageItem[] {
  const lines = pageText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const defs = [
    { token: /(current session|当前会话)/i, label: 'Current session' },
    {
      token: /(current week \(all models\)|本周（所有模型）|本周\(所有模型\)|本周.*all models)/i,
      label: 'Current week (all models)',
    },
    {
      token: /(current week \(sonnet only\)|本周（仅 Sonnet）|本周\(仅 Sonnet\)|本周.*sonnet)/i,
      label: 'Current week (Sonnet only)',
    },
  ] as const;

  const items: CodexUsageItem[] = [];
  for (const def of defs) {
    const idx = lines.findIndex((l) => def.token.test(l));
    if (idx < 0) continue;
    const percentLine = pickNear(lines, idx, /%/);
    const resetLine = pickNear(lines, idx, /(重置|resets?)/i);
    if (!percentLine) continue;
    const used = parsePercentLine(percentLine);
    if (used == null) continue;
    items.push({
      label: def.label,
      usedPercent: used,
      ...(resetLine ? { resetsText: resetLine } : {}),
    });
  }
  return items;
}

async function readPageTextFromConnectedChrome(browserURL: string, url: string): Promise<string> {
  const browser = await puppeteer.connect({ browserURL });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const title = await page.title();
    if (/just a moment/i.test(title)) {
      throw new Error(`Cloudflare challenge blocked ${url}`);
    }
    const bodyText = await page.evaluate(
      () => (globalThis as { document?: { body?: { innerText?: string } } }).document?.body?.innerText ?? '',
    );
    await page.close();
    return bodyText;
  } finally {
    await browser.disconnect();
  }
}

function isAllowedBrowserCdpUrl(browserURL: string): boolean {
  try {
    const parsed = new URL(browserURL);
    return parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type SleepLike = (ms: number) => Promise<void>;
type LaunchChromeLike = (port: number) => Promise<void>;

export interface ResolveBrowserCdpUrlOptions {
  fetchLike?: FetchLike;
  autoStartOnMissing?: boolean;
  launchChrome?: LaunchChromeLike;
  sleep?: SleepLike;
  retryCount?: number;
  retryIntervalMs?: number;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function autoStartChromeWithCdp(port: number): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('auto-start via open command is only supported on macOS');
  }
  await execFileAsync('open', ['-a', 'Google Chrome', '--args', `--remote-debugging-port=${port}`], {
    timeout: 8_000,
  });
}

async function hasCdpEndpoint(browserBaseUrl: string, fetchLike: FetchLike): Promise<boolean> {
  try {
    const response = await fetchLike(`${browserBaseUrl}/json/version`, {
      method: 'GET',
      signal: AbortSignal.timeout(1200),
    });
    if (!response.ok) return false;
    const json = (await response.json()) as { webSocketDebuggerUrl?: unknown };
    return typeof json.webSocketDebuggerUrl === 'string' && json.webSocketDebuggerUrl.length > 0;
  } catch {
    return false;
  }
}

export async function resolveBrowserCdpUrl(
  explicitUrl: string | undefined,
  options: ResolveBrowserCdpUrlOptions = {},
): Promise<{ url: string } | { error: string }> {
  const fetchLike = options.fetchLike ?? globalThis.fetch.bind(globalThis);
  if (explicitUrl) {
    if (!isAllowedBrowserCdpUrl(explicitUrl)) {
      return {
        error: `${OFFICIAL_CDP_URL_ENV} must be http://localhost:* or http://127.0.0.1:*`,
      };
    }
    return { url: explicitUrl };
  }

  for (const candidate of LOCAL_CDP_CANDIDATES) {
    if (await hasCdpEndpoint(candidate, fetchLike)) {
      return { url: candidate };
    }
  }

  if (!options.autoStartOnMissing) {
    return {
      error: `Missing ${OFFICIAL_CDP_URL_ENV}. Start Chrome with --remote-debugging-port=9222, then retry.`,
    };
  }

  const launchChrome = options.launchChrome ?? autoStartChromeWithCdp;
  const sleep = options.sleep ?? sleepMs;
  const retryCount = options.retryCount ?? 6;
  const retryIntervalMs = options.retryIntervalMs ?? 400;
  try {
    await launchChrome(DEFAULT_CDP_PORT);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      error: `Missing ${OFFICIAL_CDP_URL_ENV}. Tried to auto-start Chrome but failed: ${reason}. Start Chrome with --remote-debugging-port=9222, then retry.`,
    };
  }

  for (let i = 0; i < retryCount; i += 1) {
    if (await hasCdpEndpoint(DEFAULT_CDP_URL, fetchLike)) {
      return { url: DEFAULT_CDP_URL };
    }
    if (i < retryCount - 1) {
      await sleep(retryIntervalMs);
    }
  }

  return {
    error: `Missing ${OFFICIAL_CDP_URL_ENV}. Tried to auto-start Chrome, but CDP endpoint is still unavailable. If Chrome is already running, restart it with --remote-debugging-port=9222, then retry.`,
  };
}

// --- Route ---

export async function quotaRoutes(app: FastifyInstance): Promise<void> {
  // GET: return all cached quota
  app.get('/api/quota', async () => {
    const response: QuotaResponse = {
      claude: claudeCache,
      codex: codexCache,
      antigravity: ANTIGRAVITY,
      fetchedAt: new Date().toISOString(),
    };
    return response;
  });

  // POST: refresh Claude quota via ccusage CLI
  app.post('/api/quota/refresh/claude', async () => {
    try {
      const { stdout } = await execFileAsync('npx', ['ccusage', 'blocks', '--json'], { timeout: 30_000 });
      const parsed = JSON.parse(stdout) as { blocks: CcusageBillingBlock[] };
      const blocks = parsed.blocks.filter((b) => !b.isGap);
      const activeBlock = blocks.find((b) => b.isActive) ?? null;
      claudeCache = {
        platform: 'claude',
        activeBlock,
        recentBlocks: blocks.slice(-5),
        lastChecked: new Date().toISOString(),
      };
    } catch (err) {
      claudeCache = {
        ...claudeCache,
        error: `ccusage failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    return { claude: claudeCache };
  });

  // POST: refresh official usage pages once (manual click)
  app.post('/api/quota/refresh/official', async (_request, reply) => {
    const resolved = await resolveBrowserCdpUrl(process.env[OFFICIAL_CDP_URL_ENV], {
      autoStartOnMissing: process.env[AUTO_START_BROWSER_ENV] !== '0',
    });
    if ('error' in resolved) {
      const message = resolved.error;
      const checkedAt = new Date().toISOString();
      codexCache = {
        platform: 'codex',
        usageItems: [],
        error: message,
        lastChecked: checkedAt,
      };
      claudeCache = {
        ...claudeCache,
        error: message,
        lastChecked: checkedAt,
      };
      return reply.status(400).send({
        error: message,
      });
    }
    const browserURL = resolved.url;

    try {
      const [openaiText, claudeText] = await Promise.all([
        readPageTextFromConnectedChrome(browserURL, 'https://chatgpt.com/codex/settings/usage'),
        readPageTextFromConnectedChrome(browserURL, 'https://claude.ai/settings/usage'),
      ]);

      const codexItems = parseCodexUsageFromPageText(openaiText);
      const claudeItems = parseClaudeUsageFromPageText(claudeText);
      if (codexItems.length === 0) {
        throw new Error('Failed to parse Codex official usage page');
      }
      if (claudeItems.length === 0) {
        throw new Error('Failed to parse Claude official usage page');
      }

      codexCache = {
        platform: 'codex',
        usageItems: codexItems,
        lastChecked: new Date().toISOString(),
      };
      const { error: _oldError, ...claudeWithoutError } = claudeCache;
      claudeCache = {
        ...claudeWithoutError,
        usageItems: claudeItems,
        lastChecked: new Date().toISOString(),
      };

      return {
        ok: true,
        codexItems: codexItems.length,
        claudeItems: claudeItems.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      codexCache = {
        ...codexCache,
        error: `official fetch failed: ${message}`,
        lastChecked: new Date().toISOString(),
      };
      claudeCache = {
        ...claudeCache,
        error: `official fetch failed: ${message}`,
        lastChecked: new Date().toISOString(),
      };
      return reply.status(502).send({ error: message });
    }
  });

  // PATCH: receive Codex usage data OR scrape failure
  const codexSuccessSchema = z.object({
    usageItems: z
      .array(
        z.object({
          label: z.string().min(1),
          usedPercent: z.number().min(0).max(100),
          percentKind: z.enum(['used', 'remaining']).optional(),
          resetsAt: z.string().optional(),
        }),
      )
      .min(1),
    pageText: z.string().optional(),
  });
  const codexErrorSchema = z.object({
    error: z.string().min(1),
  });
  const codexPatchSchema = z.union([codexSuccessSchema, codexErrorSchema]);

  app.patch('/api/quota/codex', async (request, reply) => {
    const parsed = codexPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid codex usage payload',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    if ('error' in parsed.data) {
      codexCache = {
        platform: 'codex',
        usageItems: [],
        error: parsed.data.error,
        lastChecked: new Date().toISOString(),
      };
    } else {
      codexCache = {
        platform: 'codex',
        usageItems: parsed.data.usageItems.map((item) => ({
          label: item.label,
          usedPercent: item.usedPercent,
          ...(item.percentKind != null && { percentKind: item.percentKind }),
          ...(item.resetsAt != null && { resetsAt: item.resetsAt }),
        })),
        lastChecked: new Date().toISOString(),
      };
    }
    return { codex: codexCache };
  });
}
