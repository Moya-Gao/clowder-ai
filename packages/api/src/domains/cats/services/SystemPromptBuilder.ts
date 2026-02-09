/**
 * System Prompt Builder
 * 为每次 CLI 调用构建身份注入 prompt（~150-200 tokens）
 *
 * 纯函数，无副作用。读取 CAT_CONFIGS 生成身份上下文。
 */

import { CAT_CONFIGS } from '@cat-cafe/shared';
import type { CatId } from '@cat-cafe/shared';

/**
 * Context for a single cat invocation
 */
export interface InvocationContext {
  /** Which cat is being invoked */
  catId: CatId;
  /** independent = sole responder, serial = part of a chain, parallel = concurrent ideation */
  mode: 'independent' | 'serial' | 'parallel';
  /** 1-based position in chain (only for serial mode) */
  chainIndex?: number;
  /** Total cats in chain (only for serial mode) */
  chainTotal?: number;
  /** Other cats in this invocation (for teammate awareness) */
  teammates: readonly CatId[];
  /** Whether MCP tools are available for this cat */
  mcpAvailable: boolean;
  /** Prompt-level tags like 'critique' (from IntentParser) */
  promptTags?: readonly string[];
  /** Whether A2A collaboration prompt should be injected (only in serial/execute mode) */
  a2aEnabled?: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

const MCP_TOOLS_SECTION = `
你可以使用以下 Cat Cafe MCP 工具：
- cat_cafe_post_message: 主动发送消息到对话
- cat_cafe_get_pending_mentions: 获取待处理的 @提及
- cat_cafe_get_thread_context: 获取当前对话上下文
- cat_cafe_update_task: 更新自己负责的任务状态`;

/**
 * Build identity system prompt for a cat invocation.
 * Pure function — same inputs always produce same output.
 */
export function buildSystemPrompt(context: InvocationContext): string {
  const config = CAT_CONFIGS[context.catId as keyof typeof CAT_CONFIGS];
  if (!config) return '';

  const providerLabel = PROVIDER_LABELS[config.provider] ?? config.provider;
  const lines: string[] = [];

  // Identity
  lines.push(
    `你是 ${config.displayName}（${config.name}），由 ${providerLabel} 提供的 AI 猫猫。`,
    `角色：${config.roleDescription}`,
    `性格：${config.personality}`,
    '',
  );

  // Teammates — only list cats actually in this invocation
  if (context.teammates.length > 0) {
    lines.push('你的队友：');
    for (const id of context.teammates) {
      const c = CAT_CONFIGS[id as keyof typeof CAT_CONFIGS];
      if (c) {
        lines.push(`- ${c.displayName}（${c.name}）：${c.roleDescription}`);
      }
    }
  }
  lines.push('铲屎官是真人用户，是团队的共创伙伴。重要决策时由铲屎官拍板。', '');

  // A2A collaboration (only in serial/execute mode, not parallel/ideate)
  // Callable cats = ALL cats except self (not just current invocation teammates),
  // so single-cat scenarios still teach the cat to @ others (缅因猫 review P1-1).
  if (context.a2aEnabled && context.mode !== 'parallel') {
    const callableNames = Object.entries(CAT_CONFIGS)
      .filter(([id]) => id !== context.catId)
      .map(([, cfg]) => cfg.displayName);
    if (callableNames.length > 0) {
      lines.push('## 🐾 协作');
      lines.push(
        `你可以 @队友 邀请他们一起思考: ${callableNames.map((n) => `@${n}`).join(' / ')}`,
      );
      lines.push('不限场景——技术讨论、创意碰撞、观点征询、甚至讲笑话都可以。');
      lines.push('格式：另起一行，在行首写 @猫名（行中间的 @ 无效！）。每次 @ 只触发一轮。');
      lines.push('✅ 正确：');
      lines.push('我觉得可以这样做！');
      lines.push('@布偶猫 你觉得呢？');
      lines.push('❌ 错误：怎么样，@布偶猫？ ← 行中间，不会触发');
      lines.push('');
    }
  }

  // Mode context
  if (context.mode === 'serial' && context.chainIndex != null && context.chainTotal != null) {
    lines.push(
      `当前模式：你是第 ${context.chainIndex}/${context.chainTotal} 只被召唤的猫，请注意前面猫的回复。`,
      '',
    );
  } else if (context.mode === 'parallel') {
    lines.push('当前模式：独立思考。你和队友各自独立回答同一问题，给出你自己的观点。', '');
  } else {
    lines.push('当前模式：独立回答。', '');
  }

  // Prompt tags
  if (context.promptTags?.includes('critique')) {
    lines.push('思维方式：批判性分析。挑战假设，找出漏洞，提出反例。', '');
  }

  // MCP tools
  if (context.mcpAvailable) {
    lines.push(MCP_TOOLS_SECTION.trim(), '');
  }

  // Rules
  lines.push('规则：不要冒充其他猫。不要编造自己的型号。不确定时明确说"我不确定"或"我需要查证"，绝不编造信息。用你自己的风格回答。');

  return lines.join('\n');
}
