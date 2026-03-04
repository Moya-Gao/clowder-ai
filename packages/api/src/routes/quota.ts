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
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
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
  poolId?: string;
  resetsAt?: string;
  resetsText?: string;
}

export interface CodexQuota {
  platform: 'codex';
  usageItems: CodexUsageItem[];
  error?: string;
  lastChecked: string | null;
}

export interface GeminiQuota {
  platform: 'gemini';
  usageItems: CodexUsageItem[];
  error?: string;
  lastChecked: string | null;
}

export interface AntigravityQuota {
  platform: 'antigravity';
  usageItems: CodexUsageItem[];
  error?: string;
  lastChecked: string | null;
}

export interface QuotaResponse {
  claude: ClaudeQuota;
  codex: CodexQuota;
  gemini: GeminiQuota;
  antigravity: AntigravityQuota;
  fetchedAt: string;
}

export type QuotaProbeTargetPlatform = 'claude' | 'codex' | 'antigravity';
export type QuotaProbeRuntimeStatus = 'ok' | 'error' | 'disabled';

export interface QuotaProbeAction {
  kind: 'refresh';
  method: 'POST';
  path: `/api/quota/refresh/${string}`;
  requiresInteractive: boolean;
}

export interface QuotaProbeDescriptor {
  id: 'claude-cli' | 'official-browser' | 'antigravity-placeholder';
  sourceKind: 'cli' | 'browser' | 'placeholder';
  refreshMode: 'manual' | 'scheduled';
  enabled: boolean;
  status: QuotaProbeRuntimeStatus;
  targets: QuotaProbeTargetPlatform[];
  actions: QuotaProbeAction[];
  reason: string;
}

export type QuotaRiskLevel = 'ok' | 'warn' | 'high';

export interface QuotaSummaryPlatform {
  id: QuotaProbeTargetPlatform;
  label: string;
  displayPercent: number | null;
  displayKind: 'used' | 'remaining' | null;
  utilizationPercent: number | null;
  status: 'ok' | 'warn' | 'error' | 'pending';
  note: string;
  lastChecked: string | null;
}

export interface QuotaSummaryResponse {
  fetchedAt: string;
  risk: {
    level: QuotaRiskLevel;
    reasons: string[];
    maxUtilization: number | null;
  };
  platforms: {
    codex: QuotaSummaryPlatform;
    claude: QuotaSummaryPlatform;
    antigravity: QuotaSummaryPlatform;
  };
  probes: {
    official: Pick<QuotaProbeDescriptor, 'enabled' | 'status' | 'reason'>;
    claudeCli: Pick<QuotaProbeDescriptor, 'enabled' | 'status' | 'reason'>;
  };
  actions: {
    refreshOfficialPath: '/api/quota/refresh/official';
    refreshClaudePath: '/api/quota/refresh/claude';
  };
}

// --- In-memory cache ---

function createInitialClaudeCache(): ClaudeQuota {
  return {
    platform: 'claude',
    activeBlock: null,
    recentBlocks: [],
    lastChecked: null,
  };
}

function createInitialCodexCache(): CodexQuota {
  return {
    platform: 'codex',
    usageItems: [],
    lastChecked: null,
  };
}

function createInitialGeminiCache(): GeminiQuota {
  return {
    platform: 'gemini',
    usageItems: [],
    lastChecked: null,
  };
}

function createInitialAntigravityCache(): AntigravityQuota {
  return {
    platform: 'antigravity',
    usageItems: [],
    lastChecked: null,
  };
}

let claudeCache: ClaudeQuota = createInitialClaudeCache();
let codexCache: CodexQuota = createInitialCodexCache();
let geminiCache: GeminiQuota = createInitialGeminiCache();
let antigravityCache: AntigravityQuota = createInitialAntigravityCache();

export function resetQuotaCachesForTests(): void {
  claudeCache = createInitialClaudeCache();
  codexCache = createInitialCodexCache();
  geminiCache = createInitialGeminiCache();
  antigravityCache = createInitialAntigravityCache();
}

const OFFICIAL_CDP_URL_ENV = 'QUOTA_BROWSER_CDP_URL';
const OFFICIAL_REFRESH_ENABLED_ENV = 'QUOTA_OFFICIAL_REFRESH_ENABLED';
const BROWSER_MODE_ENV = 'QUOTA_BROWSER_MODE';
const BROWSER_CDP_PORT_ENV = 'QUOTA_BROWSER_CDP_PORT';
const BROWSER_PROFILE_DIR_ENV = 'QUOTA_BROWSER_PROFILE_DIR';
const BROWSER_HEADLESS_ENV = 'QUOTA_BROWSER_HEADLESS';
const AUTO_START_BROWSER_ENV = 'QUOTA_BROWSER_AUTO_START';
const AUTO_RESTART_BROWSER_ENV = 'QUOTA_BROWSER_AUTO_RESTART';
const LEGACY_LOCAL_CDP_CANDIDATES = [
  'http://127.0.0.1:9222',
  'http://localhost:9222',
  'http://127.0.0.1:9223',
  'http://localhost:9223',
  'http://127.0.0.1:9333',
  'http://localhost:9333',
] as const;
const DEFAULT_ISOLATED_CDP_PORT = 9224;
const DEFAULT_BROWSER_MODE = 'isolated';

interface OfficialRefreshRequestBody {
  interactive?: boolean;
}

type BrowserMode = 'isolated' | 'existing';

function resolveBrowserMode(raw: string | undefined): BrowserMode {
  if (raw === 'existing') return 'existing';
  return 'isolated';
}

function resolveCdpPort(raw: string | undefined): number {
  const value = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(value)) return DEFAULT_ISOLATED_CDP_PORT;
  if (value < 1024 || value > 65535) return DEFAULT_ISOLATED_CDP_PORT;
  return value;
}

function buildBrowserBaseUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

function buildProfileDir(raw: string | undefined): string {
  if (raw && raw.trim()) return raw.trim();
  return join(homedir(), '.cat-cafe', 'quota-browser-profile');
}

function isTruthyFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  return raw === '1' || raw.toLowerCase() === 'true';
}

function hasOfficialProbeFailure(): boolean {
  const messages = [codexCache.error, claudeCache.error].filter((message): message is string => Boolean(message));
  return messages.some((message) => {
    if (/temporarily disabled/i.test(message)) return false;
    return /official fetch failed|QUOTA_BROWSER_CDP_URL|remote-debugging-port|尚未登录|CDP endpoint/i.test(message);
  });
}

export function listQuotaProbeDescriptors(env: NodeJS.ProcessEnv = process.env): QuotaProbeDescriptor[] {
  const officialRefreshEnabled = isTruthyFlag(env[OFFICIAL_REFRESH_ENABLED_ENV]);
  const officialStatus: QuotaProbeRuntimeStatus = !officialRefreshEnabled
    ? 'disabled'
    : hasOfficialProbeFailure()
      ? 'error'
      : 'ok';
  const claudeStatus: QuotaProbeRuntimeStatus = /ccusage failed/i.test(claudeCache.error ?? '') ? 'error' : 'ok';

  return [
    {
      id: 'claude-cli',
      sourceKind: 'cli',
      refreshMode: 'manual',
      enabled: true,
      status: claudeStatus,
      targets: ['claude'],
      actions: [
        {
          kind: 'refresh',
          method: 'POST',
          path: '/api/quota/refresh/claude',
          requiresInteractive: false,
        },
      ],
      reason:
        claudeStatus === 'error' ? (claudeCache.error ?? 'ccusage probe error') : 'Uses ccusage CLI output. No browser scraping.',
    },
    {
      id: 'official-browser',
      sourceKind: 'browser',
      refreshMode: 'manual',
      enabled: officialRefreshEnabled,
      status: officialStatus,
      targets: ['codex', 'claude'],
      actions: [
        {
          kind: 'refresh',
          method: 'POST',
          path: '/api/quota/refresh/official',
          requiresInteractive: true,
        },
      ],
      reason:
        officialStatus === 'disabled'
          ? 'Disabled by default for risk control. Set QUOTA_OFFICIAL_REFRESH_ENABLED=1 to enable.'
          : officialStatus === 'error'
            ? (codexCache.error ?? claudeCache.error ?? 'official browser probe error')
            : 'Enabled by QUOTA_OFFICIAL_REFRESH_ENABLED=1. Triggered by manual click only.',
    },
    {
      id: 'antigravity-placeholder',
      sourceKind: 'placeholder',
      refreshMode: 'manual',
      enabled: false,
      status: 'disabled',
      targets: ['antigravity'],
      actions: [],
      reason: 'Antigravity official probe not implemented yet.',
    },
  ];
}

function normalizePercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function toUtilizationPercent(item: CodexUsageItem): number {
  const raw = item.percentKind === 'remaining' ? 100 - item.usedPercent : item.usedPercent;
  return normalizePercent(raw);
}

function pickPrimaryUsageItem(items: CodexUsageItem[]): CodexUsageItem | null {
  if (items.length === 0) return null;
  const sorted = [...items].sort((left, right) => {
    const utilizationDiff = toUtilizationPercent(right) - toUtilizationPercent(left);
    if (utilizationDiff !== 0) return utilizationDiff;
    const rank = (label: string): number => {
      if (/(weekly|每周)/i.test(label)) return 2;
      if (/(5\s*小时|5(?:\s|-)?hour)/i.test(label)) return 1;
      return 0;
    };
    return rank(right.label) - rank(left.label);
  });
  return sorted[0] ?? null;
}

function statusFromUtilization(utilization: number): QuotaSummaryPlatform['status'] {
  if (utilization >= 95) return 'error';
  if (utilization >= 80) return 'warn';
  return 'ok';
}

function buildCodexSummaryPlatform(): QuotaSummaryPlatform {
  if (codexCache.error) {
    return {
      id: 'codex',
      label: '缅因猫 (Codex + GPT-5.2)',
      displayPercent: null,
      displayKind: null,
      utilizationPercent: null,
      status: 'error',
      note: codexCache.error,
      lastChecked: codexCache.lastChecked,
    };
  }
  const primary = pickPrimaryUsageItem(codexCache.usageItems);
  if (!primary) {
    return {
      id: 'codex',
      label: '缅因猫 (Codex + GPT-5.2)',
      displayPercent: null,
      displayKind: null,
      utilizationPercent: null,
      status: 'pending',
      note: '暂无官方额度数据，请先手动获取。',
      lastChecked: codexCache.lastChecked,
    };
  }
  const utilization = toUtilizationPercent(primary);
  return {
    id: 'codex',
    label: '缅因猫 (Codex + GPT-5.2)',
    displayPercent: normalizePercent(primary.usedPercent),
    displayKind: primary.percentKind ?? 'used',
    utilizationPercent: utilization,
    status: statusFromUtilization(utilization),
    note: primary.resetsText ?? primary.resetsAt ?? primary.label,
    lastChecked: codexCache.lastChecked,
  };
}

function buildClaudeSummaryPlatform(): QuotaSummaryPlatform {
  if (claudeCache.error) {
    return {
      id: 'claude',
      label: '布偶猫 (Claude)',
      displayPercent: null,
      displayKind: null,
      utilizationPercent: null,
      status: 'error',
      note: claudeCache.error,
      lastChecked: claudeCache.lastChecked,
    };
  }
  const usageItems = claudeCache.usageItems ?? [];
  const primary = pickPrimaryUsageItem(usageItems);
  if (primary) {
    const utilization = toUtilizationPercent(primary);
    return {
      id: 'claude',
      label: '布偶猫 (Claude)',
      displayPercent: normalizePercent(primary.usedPercent),
      displayKind: primary.percentKind ?? 'used',
      utilizationPercent: utilization,
      status: statusFromUtilization(utilization),
      note: primary.resetsText ?? primary.resetsAt ?? primary.label,
      lastChecked: claudeCache.lastChecked,
    };
  }
  if (claudeCache.activeBlock) {
    return {
      id: 'claude',
      label: '布偶猫 (Claude)',
      displayPercent: null,
      displayKind: null,
      utilizationPercent: null,
      status: 'ok',
      note: 'CLI 活跃计费窗口已加载（无百分比摘要）。',
      lastChecked: claudeCache.lastChecked,
    };
  }
  return {
    id: 'claude',
    label: '布偶猫 (Claude)',
    displayPercent: null,
    displayKind: null,
    utilizationPercent: null,
    status: 'pending',
    note: '暂无 Claude 额度数据，请先手动获取。',
    lastChecked: claudeCache.lastChecked,
  };
}

function buildAntigravitySummaryPlatform(): QuotaSummaryPlatform {
  if (antigravityCache.error) {
    return {
      id: 'antigravity',
      label: '暹罗猫 (Antigravity)',
      displayPercent: null,
      displayKind: null,
      utilizationPercent: null,
      status: 'error',
      note: antigravityCache.error,
      lastChecked: antigravityCache.lastChecked,
    };
  }
  const primary = pickPrimaryUsageItem(antigravityCache.usageItems);
  if (!primary) {
    return {
      id: 'antigravity',
      label: '暹罗猫 (Antigravity)',
      displayPercent: null,
      displayKind: null,
      utilizationPercent: null,
      status: 'pending',
      note: '暹罗猫额度待获取。',
      lastChecked: antigravityCache.lastChecked,
    };
  }
  const utilization = toUtilizationPercent(primary);
  return {
    id: 'antigravity',
    label: '暹罗猫 (Antigravity)',
    displayPercent: normalizePercent(primary.usedPercent),
    displayKind: primary.percentKind ?? 'used',
    utilizationPercent: utilization,
    status: statusFromUtilization(utilization),
    note: primary.resetsText ?? primary.resetsAt ?? primary.label,
    lastChecked: antigravityCache.lastChecked,
  };
}

export function buildQuotaSummary(env: NodeJS.ProcessEnv = process.env): QuotaSummaryResponse {
  const probes = listQuotaProbeDescriptors(env);
  const officialProbe = probes.find((probe) => probe.id === 'official-browser');
  const claudeCliProbe = probes.find((probe) => probe.id === 'claude-cli');
  const codex = buildCodexSummaryPlatform();
  const claude = buildClaudeSummaryPlatform();
  const antigravity = buildAntigravitySummaryPlatform();

  const utilizationValues = [codex.utilizationPercent, claude.utilizationPercent].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  const maxUtilization = utilizationValues.length > 0 ? Math.max(...utilizationValues) : null;

  const reasons: string[] = [];
  let level: QuotaRiskLevel = 'ok';

  if (officialProbe?.status === 'disabled') {
    reasons.push('官方网页探针已禁用（止血模式）');
    level = 'warn';
  }

  if (officialProbe?.status === 'error') {
    reasons.push('官方网页探针运行异常，请检查登录或 CDP 配置');
    level = 'high';
  }

  if (codex.status === 'error') {
    reasons.push(`缅因猫额度异常：${codex.note}`);
    level = 'high';
  }

  if (claude.status === 'error') {
    reasons.push(`布偶猫额度异常：${claude.note}`);
    level = 'high';
  }

  if (maxUtilization != null && maxUtilization >= 95) {
    reasons.push(`综合利用率达到 ${maxUtilization}%（高风险）`);
    level = 'high';
  } else if (maxUtilization != null && maxUtilization >= 80) {
    reasons.push(`综合利用率达到 ${maxUtilization}%（需关注）`);
    if (level !== 'high') level = 'warn';
  }

  return {
    fetchedAt: new Date().toISOString(),
    risk: {
      level,
      reasons,
      maxUtilization,
    },
    platforms: {
      codex,
      claude,
      antigravity,
    },
    probes: {
      official: {
        enabled: officialProbe?.enabled ?? false,
        status: officialProbe?.status ?? 'disabled',
        reason: officialProbe?.reason ?? 'official-browser probe unavailable',
      },
      claudeCli: {
        enabled: claudeCliProbe?.enabled ?? true,
        status: claudeCliProbe?.status ?? 'ok',
        reason: claudeCliProbe?.reason ?? 'claude-cli probe unavailable',
      },
    },
    actions: {
      refreshOfficialPath: '/api/quota/refresh/official',
      refreshClaudePath: '/api/quota/refresh/claude',
    },
  };
}

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
      poolId: 'codex-spark',
    },
    {
      token: /^(GPT-5\.3-Codex-Spark\s*每周使用限额|GPT-5\.3-Codex-Spark\s*weekly\s*usage\s*limit)$/i,
      label: 'GPT-5.3-Codex-Spark 每周使用限额',
      poolId: 'codex-spark',
    },
    { token: /^(5\s*小时使用限额|5(?:\s|-)?hour usage limit)$/i, label: '5小时使用限额', poolId: 'codex-main' },
    { token: /^(每周使用限额|weekly usage limit)$/i, label: '每周使用限额', poolId: 'codex-main' },
    { token: /(代码审查|code review)/i, label: '代码审查', poolId: 'codex-review' },
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
      poolId: def.poolId,
      ...(resetLine ? { resetsText: resetLine } : {}),
    });
  }

  // Overflow credits line: "剩余额度: N" or "Remaining credits: N"
  const overflowPattern = /^(剩余额度|remaining credits)\s*[:：]\s*(\d+)/i;
  for (const line of lines) {
    const m = overflowPattern.exec(line);
    if (m) {
      items.push({
        label: '溢出额度',
        usedPercent: Math.min(Number(m[2]), 100),
        percentKind: 'remaining',
        poolId: 'codex-overflow',
      });
      break;
    }
  }

  return items;
}

export function parseClaudeUsageFromPageText(pageText: string): CodexUsageItem[] {
  const lines = pageText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const defs = [
    { token: /(current session|当前会话)/i, label: 'Current session', poolId: 'claude-session' },
    {
      token: /(current week \(all models\)|本周（所有模型）|本周\(所有模型\)|本周.*all models)/i,
      label: 'Current week (all models)',
      poolId: 'claude-weekly-all',
    },
    {
      token: /(current week \(sonnet only\)|本周（仅 Sonnet）|本周\(仅 Sonnet\)|本周.*sonnet)/i,
      label: 'Current week (Sonnet only)',
      poolId: 'claude-weekly-sonnet',
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
      poolId: def.poolId,
      ...(resetLine ? { resetsText: resetLine } : {}),
    });
  }
  return items;
}

class OfficialLoginRequiredError extends Error {
  constructor(hostname: string) {
    super(
      `官方额度浏览器尚未登录 ${hostname}。请在弹出的隔离浏览器窗口完成登录后，再点击“获取官方额度”。`,
    );
    this.name = 'OfficialLoginRequiredError';
  }
}

function looksLikeLoginPage(targetUrl: string, currentUrl: string, title: string, bodyText: string): boolean {
  const current = currentUrl.toLowerCase();
  if (current.includes('/login') || current.includes('/signin') || current.includes('/auth')) return true;
  if (/sign in|log in|登录|authenticate|verification/i.test(title)) return true;
  if (/sign in|log in|继续|continue with|验证码|verification code|账户/i.test(bodyText.slice(0, 5000))) {
    return true;
  }
  const targetHost = new URL(targetUrl).hostname;
  const currentHost = new URL(currentUrl).hostname;
  if (targetHost !== currentHost && (currentHost.includes('auth') || currentHost.includes('login'))) {
    return true;
  }
  return false;
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
    const currentUrl = page.url();
    const bodyText = await page.evaluate(
      () => (globalThis as { document?: { body?: { innerText?: string } } }).document?.body?.innerText ?? '',
    );
    if (looksLikeLoginPage(url, currentUrl, title, bodyText)) {
      throw new OfficialLoginRequiredError(new URL(url).hostname);
    }
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
interface LaunchChromeConfig {
  profileDir: string;
  headless: boolean;
  mode: BrowserMode;
}
type LaunchChromeLike = (port: number, config: LaunchChromeConfig) => Promise<void>;
type RestartChromeLike = (port: number, sleep: SleepLike, config: LaunchChromeConfig) => Promise<void>;

export interface ResolveBrowserCdpUrlOptions {
  fetchLike?: FetchLike;
  mode?: BrowserMode;
  isolatedPort?: number;
  profileDir?: string;
  headless?: boolean;
  autoStartOnMissing?: boolean;
  autoRestartOnUnavailable?: boolean;
  launchChrome?: LaunchChromeLike;
  restartChrome?: RestartChromeLike;
  sleep?: SleepLike;
  retryCount?: number;
  retryIntervalMs?: number;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const QUOTA_LOGIN_URLS = ['https://chatgpt.com/codex/settings/usage', 'https://claude.ai/settings/usage'] as const;

async function autoStartChromeWithCdp(port: number, config: LaunchChromeConfig): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('auto-start via open command is only supported on macOS');
  }
  await mkdir(config.profileDir, { recursive: true });
  const args = ['-na', 'Google Chrome', ...QUOTA_LOGIN_URLS, '--args', `--remote-debugging-port=${port}`];
  if (config.mode === 'isolated') {
    args.push(`--user-data-dir=${config.profileDir}`, '--no-first-run', '--no-default-browser-check');
  }
  if (config.headless) {
    args.push('--headless=new');
  }
  await execFileAsync('open', args, {
    timeout: 8_000,
  });
}

async function restartChromeWithCdp(port: number, sleep: SleepLike, config: LaunchChromeConfig): Promise<void> {
  if (config.mode === 'isolated') {
    // Isolated mode should never quit user's running Chrome session.
    await autoStartChromeWithCdp(port, config);
    return;
  }
  if (process.platform !== 'darwin') {
    throw new Error('auto-restart via open command is only supported on macOS');
  }
  // Best effort quit; ignore if app is already stopped.
  await execFileAsync('osascript', ['-e', 'tell application "Google Chrome" to quit'], {
    timeout: 8_000,
  }).catch(() => undefined);
  await sleep(400);
  await execFileAsync('open', ['-a', 'Google Chrome', '--args', `--remote-debugging-port=${port}`], {
    timeout: 8_000,
  });
}

function buildCdpCandidates(mode: BrowserMode, isolatedPort: number): string[] {
  const isolatedCandidates = [buildBrowserBaseUrl(isolatedPort), `http://localhost:${isolatedPort}`];
  if (mode === 'isolated') return isolatedCandidates;
  return [...isolatedCandidates, ...LEGACY_LOCAL_CDP_CANDIDATES];
}

function buildManualStartHint(mode: BrowserMode, port: number, profileDir: string): string {
  if (mode === 'isolated') {
    return `Start isolated Chrome with --remote-debugging-port=${port} and --user-data-dir=\"${profileDir}\", then retry.`;
  }
  return `Start Chrome with --remote-debugging-port=${port}, then retry.`;
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
  const mode = options.mode ?? DEFAULT_BROWSER_MODE;
  const isolatedPort = options.isolatedPort ?? DEFAULT_ISOLATED_CDP_PORT;
  const profileDir = options.profileDir ?? buildProfileDir(undefined);
  const launchConfig: LaunchChromeConfig = {
    profileDir,
    headless: options.headless ?? false,
    mode,
  };
  const isolatedBrowserBaseUrl = buildBrowserBaseUrl(isolatedPort);
  const manualStartHint = buildManualStartHint(mode, isolatedPort, profileDir);
  if (explicitUrl) {
    if (!isAllowedBrowserCdpUrl(explicitUrl)) {
      return {
        error: `${OFFICIAL_CDP_URL_ENV} must be http://localhost:* or http://127.0.0.1:*`,
      };
    }
    return { url: explicitUrl };
  }

  for (const candidate of buildCdpCandidates(mode, isolatedPort)) {
    if (await hasCdpEndpoint(candidate, fetchLike)) {
      return { url: candidate };
    }
  }

  if (!options.autoStartOnMissing) {
    return {
      error: `Missing ${OFFICIAL_CDP_URL_ENV}. ${manualStartHint}`,
    };
  }

  const launchChrome = options.launchChrome ?? autoStartChromeWithCdp;
  const sleep = options.sleep ?? sleepMs;
  const autoRestartOnUnavailable = options.autoRestartOnUnavailable ?? false;
  const restartChrome = options.restartChrome ?? restartChromeWithCdp;
  const retryCount = options.retryCount ?? 6;
  const retryIntervalMs = options.retryIntervalMs ?? 400;
  try {
    await launchChrome(isolatedPort, launchConfig);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      error: `Missing ${OFFICIAL_CDP_URL_ENV}. Tried to auto-start isolated Chrome but failed: ${reason}. ${manualStartHint}`,
    };
  }

  for (let i = 0; i < retryCount; i += 1) {
    if (await hasCdpEndpoint(isolatedBrowserBaseUrl, fetchLike)) {
      return { url: isolatedBrowserBaseUrl };
    }
    if (i < retryCount - 1) {
      await sleep(retryIntervalMs);
    }
  }

  if (!autoRestartOnUnavailable) {
    return {
      error: `Missing ${OFFICIAL_CDP_URL_ENV}. Tried to auto-start isolated Chrome, but CDP endpoint is still unavailable. ${manualStartHint}`,
    };
  }

  try {
    await restartChrome(isolatedPort, sleep, launchConfig);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      error: `Missing ${OFFICIAL_CDP_URL_ENV}. Tried to auto-start and restart Chrome but failed during restart: ${reason}. ${manualStartHint}`,
    };
  }

  for (let i = 0; i < retryCount; i += 1) {
    if (await hasCdpEndpoint(isolatedBrowserBaseUrl, fetchLike)) {
      return { url: isolatedBrowserBaseUrl };
    }
    if (i < retryCount - 1) {
      await sleep(retryIntervalMs);
    }
  }

  return {
    error: `Missing ${OFFICIAL_CDP_URL_ENV}. Tried to auto-start and restart Chrome, but CDP endpoint is still unavailable. ${manualStartHint}`,
  };
}

export function shouldAutoStartBrowserForOfficialRefresh(
  requestBody: unknown,
  autoStartEnvValue: string | undefined = process.env[AUTO_START_BROWSER_ENV],
): boolean {
  const body = (requestBody ?? {}) as OfficialRefreshRequestBody;
  const interactive = body?.interactive === true;
  if (!interactive) return false;
  return autoStartEnvValue !== '0';
}

// --- Route ---

export async function quotaRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/quota/probes', async () => {
    return {
      probes: listQuotaProbeDescriptors(),
      fetchedAt: new Date().toISOString(),
    };
  });

  // GET: return all cached quota
  app.get('/api/quota', async () => {
    const response: QuotaResponse = {
      claude: claudeCache,
      codex: codexCache,
      gemini: geminiCache,
      antigravity: antigravityCache,
      fetchedAt: new Date().toISOString(),
    };
    return response;
  });

  // GET: compact summary for menu bar / widget clients
  app.get('/api/quota/summary', async () => {
    return buildQuotaSummary();
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
  app.post('/api/quota/refresh/official', async (request, reply) => {
    if (!isTruthyFlag(process.env[OFFICIAL_REFRESH_ENABLED_ENV])) {
      const message = `Official quota refresh is temporarily disabled. Set ${OFFICIAL_REFRESH_ENABLED_ENV}=1 to enable it.`;
      const checkedAt = new Date().toISOString();
      codexCache = {
        ...codexCache,
        error: message,
        lastChecked: checkedAt,
      };
      claudeCache = {
        ...claudeCache,
        error: message,
        lastChecked: checkedAt,
      };
      return reply.status(503).send({ error: message });
    }

    const browserMode = resolveBrowserMode(process.env[BROWSER_MODE_ENV]);
    const cdpPort = resolveCdpPort(process.env[BROWSER_CDP_PORT_ENV]);
    const profileDir = buildProfileDir(process.env[BROWSER_PROFILE_DIR_ENV]);
    const headless = process.env[BROWSER_HEADLESS_ENV] === '1';
    const resolved = await resolveBrowserCdpUrl(process.env[OFFICIAL_CDP_URL_ENV], {
      autoStartOnMissing: shouldAutoStartBrowserForOfficialRefresh(request.body),
      // Restart is dangerous and opt-in only.
      autoRestartOnUnavailable: process.env[AUTO_RESTART_BROWSER_ENV] === '1',
      mode: browserMode,
      isolatedPort: cdpPort,
      profileDir,
      headless,
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
      const statusCode = error instanceof OfficialLoginRequiredError ? 409 : 502;
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
      return reply.status(statusCode).send({ error: message });
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
          poolId: z.string().optional(),
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
          ...(item.poolId != null && { poolId: item.poolId }),
          ...(item.resetsAt != null && { resetsAt: item.resetsAt }),
        })),
        lastChecked: new Date().toISOString(),
      };
    }
    return { codex: codexCache };
  });

  // PATCH: receive Gemini usage data OR error
  const geminiPatchSchema = z.union([codexSuccessSchema, codexErrorSchema]);

  app.patch('/api/quota/gemini', async (request, reply) => {
    const parsed = geminiPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid gemini usage payload',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    if ('error' in parsed.data) {
      geminiCache = {
        platform: 'gemini',
        usageItems: [],
        error: parsed.data.error,
        lastChecked: new Date().toISOString(),
      };
    } else {
      geminiCache = {
        platform: 'gemini',
        usageItems: parsed.data.usageItems.map((item) => ({
          label: item.label,
          usedPercent: item.usedPercent,
          ...(item.percentKind != null && { percentKind: item.percentKind }),
          ...(item.poolId != null && { poolId: item.poolId }),
          ...(item.resetsAt != null && { resetsAt: item.resetsAt }),
        })),
        lastChecked: new Date().toISOString(),
      };
    }
    return { gemini: geminiCache };
  });

  // PATCH: receive Antigravity usage data OR error
  const antigravityPatchSchema = z.union([codexSuccessSchema, codexErrorSchema]);

  app.patch('/api/quota/antigravity', async (request, reply) => {
    const parsed = antigravityPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid antigravity usage payload',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    if ('error' in parsed.data) {
      antigravityCache = {
        platform: 'antigravity',
        usageItems: [],
        error: parsed.data.error,
        lastChecked: new Date().toISOString(),
      };
    } else {
      antigravityCache = {
        platform: 'antigravity',
        usageItems: parsed.data.usageItems.map((item) => ({
          label: item.label,
          usedPercent: item.usedPercent,
          ...(item.percentKind != null && { percentKind: item.percentKind }),
          ...(item.poolId != null && { poolId: item.poolId }),
          ...(item.resetsAt != null && { resetsAt: item.resetsAt }),
        })),
        lastChecked: new Date().toISOString(),
      };
    }
    return { antigravity: antigravityCache };
  });
}
