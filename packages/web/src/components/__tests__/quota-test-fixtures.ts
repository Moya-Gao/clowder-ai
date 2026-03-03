/**
 * Shared types for quota tests — mirrors the API response types from quota.ts
 */

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
