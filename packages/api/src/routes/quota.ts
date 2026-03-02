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
  recentBlocks: CcusageBillingBlock[];
  error?: string;
  lastChecked: string | null;
}

export interface CodexUsageItem {
  label: string;
  usedPercent: number;
  resetsAt?: string;
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

  // PATCH: receive Codex usage data OR scrape failure
  const codexSuccessSchema = z.object({
    usageItems: z
      .array(
        z.object({
          label: z.string().min(1),
          usedPercent: z.number().min(0).max(100),
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
          ...(item.resetsAt != null && { resetsAt: item.resetsAt }),
        })),
        lastChecked: new Date().toISOString(),
      };
    }
    return { codex: codexCache };
  });
}
