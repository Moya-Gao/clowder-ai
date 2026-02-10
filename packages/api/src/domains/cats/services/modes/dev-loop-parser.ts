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
 * 从 review 猫的文本输出中提取 verdict 和 P 级问题
 *
 * 格式约定：
 * - `VERDICT: APPROVED` 或 `VERDICT: NEEDS_FIX`
 * - `[P1] 描述` / `[P2] 描述` / `[P3] 描述`
 */
export function parseReviewResult(text: string): ReviewResult {
  const lines = text.split('\n');

  const p1: string[] = [];
  const p2: string[] = [];
  const p3: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const p1Match = trimmed.match(/^\[P1\]\s*(.+)/);
    if (p1Match?.[1]) { p1.push(p1Match[1].trim()); continue; }
    const p2Match = trimmed.match(/^\[P2\]\s*(.+)/);
    if (p2Match?.[1]) { p2.push(p2Match[1].trim()); continue; }
    const p3Match = trimmed.match(/^\[P3\]\s*(.+)/);
    if (p3Match?.[1]) { p3.push(p3Match[1].trim()); continue; }
  }

  // VERDICT line — default to NEEDS_FIX if P1/P2 found but no explicit verdict
  const verdictMatch = text.match(/VERDICT:\s*(APPROVED|NEEDS_FIX)/i);
  let approved = false;
  if (verdictMatch) {
    approved = verdictMatch[1]!.toUpperCase() === 'APPROVED';
  } else {
    // Fallback: if no P1/P2 issues, treat as approved
    approved = p1.length === 0 && p2.length === 0;
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
