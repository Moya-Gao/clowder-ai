/**
 * Mode-specific System Prompts
 *
 * Builds supplemental system prompt sections injected during mode execution.
 * Each builder returns a string that gets appended to the standard identity prompt.
 */

import type {
  BrainstormConfig,
  BrainstormState,
  CatId,
  DebateConfig,
  DebateState,
  DevLoopConfig,
} from '@cat-cafe/shared';
import { CAT_CONFIGS, catRegistry } from '@cat-cafe/shared';
import type { ReviewResult } from './dev-loop-parser.js';

function catDisplayName(catId: CatId): string {
  const entry = catRegistry.tryGet(catId as string);
  if (entry) return entry.config.displayName;
  return CAT_CONFIGS[catId as string]?.displayName ?? (catId as string);
}

/** Build brainstorm-specific prompt section */
export function buildBrainstormPrompt(config: BrainstormConfig, state: BrainstormState, catId: CatId): string {
  const lines: string[] = [];
  const otherNames = config.participants.filter((p) => p !== catId).map((p) => catDisplayName(p as CatId));

  lines.push(`## 🧠 头脑风暴模式`);
  lines.push(`议题：${config.topic}`);
  lines.push(`参与者：${config.participants.map((p) => catDisplayName(p as CatId)).join('、')}`);
  lines.push('');

  if (!state.roundOneComplete) {
    // Round 1: independent thinking
    lines.push('**第一轮：独立思考**');
    lines.push('你和其他参与者正在并行独立思考。');
    lines.push('要求：');
    lines.push('- 给出你自己对议题的独立观点和分析');
    lines.push('- 不要预测或参考其他猫的想法');
    lines.push('- 大胆提出新颖的角度');
  } else {
    // Round 2+: discussion
    lines.push(`**第 ${state.currentRound} 轮：讨论**`);
    lines.push(`前面的轮次中，${otherNames.join('、')}已经分享了各自的观点。`);
    lines.push('要求：');
    lines.push('- 回应和讨论已有的观点');
    lines.push('- 指出共识和分歧');
    lines.push('- 提出新的综合思路或挑战现有假设');
    lines.push('- 如果你需要铲屎官的意见或决策，在回复中写 @铲屎官');
  }

  return lines.join('\n');
}

/** Build debate-specific prompt section */
export function buildDebatePrompt(config: DebateConfig, state: DebateState, catId: CatId): string {
  const lines: string[] = [];
  const maxRounds = config.rounds ?? 3;
  const isPositive = catId === config.catA;
  const opponentName = catDisplayName((isPositive ? config.catB : config.catA) as CatId);

  lines.push(`## ⚔️ 辩论模式`);
  lines.push(`议题：${config.topic}`);
  lines.push(`第 ${state.currentRound}/${maxRounds} 轮`);
  lines.push('');
  lines.push(`你的立场：**${isPositive ? '正方' : '反方'}**`);
  lines.push(`对手：${opponentName}`);
  lines.push('');
  lines.push('要求：');
  lines.push('- 坚持你的立场，提出有力论据');
  lines.push('- 回应对手的论点，指出漏洞');
  lines.push('- 引用事实和例子支撑你的观点');
  lines.push('- 保持理性和尊重，不要人身攻击');

  return lines.join('\n');
}

// ─── Dev-Loop Prompts ──────────────────────────────────

/**
 * 开发阶段 system prompt
 * iteration=0 → 首次开发；>0 → 修复
 */
export function buildDevLoopDevPrompt(config: DevLoopConfig, iteration: number): string {
  const lines: string[] = [];
  lines.push(`## 🔄 开发自闭环模式`);
  lines.push(`需求：${config.requirement}`);
  lines.push('');

  if (iteration === 0) {
    lines.push('**阶段：开发**');
    lines.push('你是主开发猫。请根据上面的需求进行开发。');
    lines.push('用户消息中包含具体的需求描述和上下文。');
  } else {
    lines.push(`**阶段：修复（第 ${iteration + 1} 轮）**`);
    lines.push('你是主开发猫。上一轮 review 发现了问题，请修复。');
    lines.push('用户消息中包含需要修复的内容。');
  }

  return lines.join('\n');
}

/**
 * Review 阶段 system prompt
 * 用户消息 = 主开发猫的输出
 */
export function buildDevLoopReviewPrompt(config: DevLoopConfig): string {
  const lines: string[] = [];
  lines.push(`## 🔄 开发自闭环模式 — Review`);
  lines.push(`需求：${config.requirement}`);
  lines.push('');
  lines.push('**阶段：Review**');
  lines.push('你是 review 猫。请审查主开发猫的输出（在用户消息中）。');
  lines.push('');
  lines.push('按以下格式分类发现：');
  lines.push('- `[P1] 描述` — 必须修复的严重问题');
  lines.push('- `[P2] 描述` — 必须修复的一般问题');
  lines.push('- `[P3] 描述` — 建议优化，不阻断合入');
  lines.push('');
  lines.push('最后必须以下面一行结尾：');
  lines.push('- 通过：`VERDICT: APPROVED`');
  lines.push('- 需要修复：`VERDICT: NEEDS_FIX`');

  return lines.join('\n');
}

/**
 * 修复阶段 system prompt
 * 包含 review 发现的 P1/P2 问题列表
 */
export function buildDevLoopFixPrompt(config: DevLoopConfig, result: ReviewResult): string {
  const lines: string[] = [];
  lines.push(`## 🔄 开发自闭环模式 — 修复`);
  lines.push(`需求：${config.requirement}`);
  lines.push('');
  lines.push('**阶段：修复**');
  lines.push('Review 猫发现了以下问题，请修复：');
  lines.push('');

  for (const issue of result.p1) {
    lines.push(`[P1] ${issue}`);
  }
  for (const issue of result.p2) {
    lines.push(`[P2] ${issue}`);
  }

  if (result.p3.length > 0) {
    lines.push('');
    lines.push('以下 P3 已记录，无需修复：');
    for (const issue of result.p3) {
      lines.push(`[P3] ${issue}`);
    }
  }

  return lines.join('\n');
}

/** Instruction appended to mode prompts for cat-initiated mode switching */
export function buildModeSwitchInstruction(): string {
  return [
    '',
    '---',
    '如果你觉得当前讨论适合切换到其他模式（比如从头脑风暴切到辩论），',
    '可以在回复末尾另起一行写 `@mode:模式名`，例如 `@mode:debate`。',
    '铲屎官会决定是否切换。',
  ].join('\n');
}
