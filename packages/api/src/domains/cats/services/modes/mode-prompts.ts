/**
 * Mode-specific System Prompts
 *
 * Builds supplemental system prompt sections injected during mode execution.
 * Each builder returns a string that gets appended to the standard identity prompt.
 */

import type { CatId, BrainstormConfig, BrainstormState, DebateConfig, DebateState } from '@cat-cafe/shared';
import { CAT_CONFIGS } from '@cat-cafe/shared';

function catDisplayName(catId: CatId): string {
  return CAT_CONFIGS[catId as keyof typeof CAT_CONFIGS]?.displayName ?? (catId as string);
}

/** Build brainstorm-specific prompt section */
export function buildBrainstormPrompt(
  config: BrainstormConfig,
  state: BrainstormState,
  catId: CatId,
): string {
  const lines: string[] = [];
  const otherNames = config.participants
    .filter((p) => p !== catId)
    .map((p) => catDisplayName(p as CatId));

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
  }

  return lines.join('\n');
}

/** Build debate-specific prompt section */
export function buildDebatePrompt(
  config: DebateConfig,
  state: DebateState,
  catId: CatId,
): string {
  const lines: string[] = [];
  const maxRounds = config.rounds ?? 3;
  const isPositive = catId === config.catA;
  const opponentName = catDisplayName(
    (isPositive ? config.catB : config.catA) as CatId,
  );

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
