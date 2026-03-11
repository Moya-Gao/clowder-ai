/**
 * Dev-Loop Review Parser
 *
 * 解析 review 猫的输出，提取 VERDICT 和 P 级问题列表。
 * 设计文档：docs/plans/2026-02-10-f11-mode-system-design.md §2.3
 */

import type { DevLoopConfig } from '@cat-cafe/shared';

export interface ReviewResult {
  /** Review 通过 */
  approved: boolean;
  /** P1 问题列表（必须修复） */
  p1: string[];
  /** P2 问题列表（必须修复） */
  p2: string[];
  /** P3 问题列表（记录但不阻断） */
  p3: string[];
}

/**
 * Regex for P-level items. Handles common markdown list formats:
 *   [P1] text, - [P1] text, * [P1] text, 1. [P1] text
 * Also handles backtick-wrapped: `[P1]` text
 */
const P_ITEM_REGEX = /^(?:[-*]|\d+\.?)?\s*`?\[P([123])\]`?\s*(.+)/;

/**
 * 从 review 猫的文本输出中提取 verdict 和 P 级问题
 *
 * 格式约定：
 * - `VERDICT: APPROVED` 或 `VERDICT: NEEDS_FIX`
 * - `[P1] 描述` / `[P2] 描述` / `[P3] 描述`
 *
 * Fail-closed: 无 VERDICT 且无 P 项时，非空文本默认 NOT approved。
 */
export function parseReviewResult(text: string): ReviewResult {
  const lines = text.split('\n');

  const p1: string[] = [];
  const p2: string[] = [];
  const p3: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(P_ITEM_REGEX);
    if (match?.[1] && match[2]) {
      const level = match[1];
      const desc = match[2].trim();
      if (level === '1') p1.push(desc);
      else if (level === '2') p2.push(desc);
      else p3.push(desc);
    }
  }

  // VERDICT lines — scan ALL occurrences. If ANY says NEEDS_FIX, fail-closed.
  const allVerdicts = [...text.matchAll(/VERDICT:\s*(APPROVED|NEEDS_FIX)/gi)];
  let approved = false;
  if (allVerdicts.length > 0) {
    const hasNeedsFix = allVerdicts.some(m => m[1]!.toUpperCase() === 'NEEDS_FIX');
    approved = !hasNeedsFix;
  }
  // No VERDICT → always fail-closed (approved stays false).
  // P1/P2 items override VERDICT: APPROVED — blocking issues can't be skipped.
  if (p1.length > 0 || p2.length > 0) {
    approved = false;
  }

  return { approved, p1, p2, p3 };
}

/**
 * 生成 dev-loop 最终报告文本
 */
export function buildDevLoopSummary(
  config: DevLoopConfig,
  iterations: number,
  p3Issues: string[],
): string {
  const lines: string[] = [
    `🔄 开发自闭环完成`,
    `需求：${config.requirement}`,
    `开发猫：@${config.leadCat} · Review 猫：@${config.reviewCat}`,
    `修复迭代：${iterations} 轮`,
  ];

  if (p3Issues.length > 0) {
    lines.push('');
    lines.push(`以下 ${p3Issues.length} 个 P3 待铲屎官决定：`);
    for (const issue of p3Issues) {
      lines.push(`  • ${issue}`);
    }
  } else {
    lines.push('无 P3 遗留。');
  }

  return lines.join('\n');
}
