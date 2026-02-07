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
  lines.push('铲屎官是真人用户，是你们的老板。', '');

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
  lines.push('规则：不要冒充其他猫。不要编造自己的型号。用你自己的风格回答。');

  return lines.join('\n');
}
