// biome-ignore lint/correctness/noUnusedImports: React must be in scope for SSR JSX runtime in tests.
import React from 'react';

// --- Types (mirror backend QuotaResponse) ---

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

// --- Sub-components ---

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function barColor(percent: number, percentKind: 'used' | 'remaining' = 'used'): string {
  const usedSignal = percentKind === 'remaining' ? 100 - percent : percent;
  if (usedSignal >= 95) return 'bg-red-500';
  if (usedSignal >= 80) return 'bg-amber-500';
  return 'bg-green-500';
}

export function ClaudeCard({ data }: { data: ClaudeQuota }) {
  if (data.error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">布偶猫 (Claude)</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-red-600 text-white">ccusage CLI</span>
        </div>
        <div className="text-xs text-red-600">抓取失败: {data.error}</div>
      </div>
    );
  }

  const block = data.activeBlock;
  const officialUsage = data.usageItems ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-800">布偶猫 (Claude)</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-red-600 text-white">ccusage CLI</span>
      </div>
      <div className="h-px bg-gray-200" />
      {officialUsage.length > 0 ? (
        <div className="space-y-2">
          {officialUsage.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">{item.label}</span>
                <span className={`font-semibold ${item.usedPercent >= 95 ? 'text-red-600' : 'text-gray-900'}`}>
                  {item.usedPercent}% used
                </span>
              </div>
              <ProgressBar percent={item.usedPercent} color={barColor(item.usedPercent, 'used')} />
              {item.resetsText && <div className="text-[10px] text-gray-400">{item.resetsText}</div>}
              {!item.resetsText && item.resetsAt && (
                <div className="text-[10px] text-gray-400">重置: {new Date(item.resetsAt).toLocaleString()}</div>
              )}
            </div>
          ))}
        </div>
      ) : block ? (
        <>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">当前窗口费用</span>
              <span className="font-semibold text-gray-900">${block.costUSD.toFixed(2)}</span>
            </div>
            {block.burnRate && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">消耗速率</span>
                <span className="text-gray-900">${block.burnRate.costPerHour.toFixed(2)}/hr</span>
              </div>
            )}
            {block.projection && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">预计窗口总计</span>
                <span className="text-gray-900">${block.projection.totalCost.toFixed(2)}</span>
              </div>
            )}
          </div>
          <div className="text-[11px] text-gray-500">模型: {block.models.join(', ')}</div>
          <div className="text-[11px] text-gray-500">
            窗口: {new Date(block.startTime).toLocaleTimeString()} — {new Date(block.endTime).toLocaleTimeString()}
          </div>
        </>
      ) : (
        <div className="text-xs text-gray-500">暂无活跃计费窗口</div>
      )}
      {data.lastChecked && (
        <div className="text-[10px] text-gray-400">更新: {new Date(data.lastChecked).toLocaleString()}</div>
      )}
    </div>
  );
}

export function CodexCard({ data }: { data: CodexQuota }) {
  if (data.error) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">缅因猫 (Codex + GPT-5.2)</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white">浏览器抓取</span>
        </div>
        <div className="text-xs text-red-600">抓取失败: {data.error}</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-800">缅因猫 (Codex + GPT-5.2)</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 text-white">浏览器抓取</span>
      </div>
      <div className="h-px bg-gray-200" />
      {data.usageItems.length > 0 ? (
        <div className="space-y-2">
          {data.usageItems.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">{item.label}</span>
                <span
                  className={`font-semibold ${
                    item.percentKind === 'remaining'
                      ? item.usedPercent <= 5
                        ? 'text-red-600'
                        : 'text-gray-900'
                      : item.usedPercent >= 95
                        ? 'text-red-600'
                        : 'text-gray-900'
                  }`}
                >
                  {item.usedPercent}% {item.percentKind === 'remaining' ? '剩余' : 'used'}
                </span>
              </div>
              <ProgressBar percent={item.usedPercent} color={barColor(item.usedPercent, item.percentKind ?? 'used')} />
              {item.resetsText && <div className="text-[10px] text-gray-400">{item.resetsText}</div>}
              {!item.resetsText && item.resetsAt && (
                <div className="text-[10px] text-gray-400">重置: {new Date(item.resetsAt).toLocaleString()}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-500">暂无额度数据（点击获取会启动隔离浏览器，首次需登录后再重试）</div>
      )}
      {data.lastChecked && (
        <div className="text-[10px] text-gray-400">更新: {new Date(data.lastChecked).toLocaleString()}</div>
      )}
    </div>
  );
}

export function AntigravityCard({ data }: { data: AntigravityQuota }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-800">暹罗猫 (Antigravity)</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-gray-500 text-white">待接入</span>
      </div>
      <div className="h-px bg-gray-200" />
      <div className="flex flex-col items-center py-4 gap-1">
        <span className="text-2xl">🚧</span>
        <span className="text-xs text-gray-500">{data.hint}</span>
      </div>
    </div>
  );
}
