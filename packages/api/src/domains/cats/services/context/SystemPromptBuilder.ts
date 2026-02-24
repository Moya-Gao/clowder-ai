/**
 * System Prompt Builder
 * 为每次 CLI 调用构建身份注入 prompt（~150-200 tokens）
 *
 * 纯函数，无副作用。读取 CAT_CONFIGS 生成身份上下文。
 */

import { catRegistry, CAT_CONFIGS } from '@cat-cafe/shared';
import type { CatId, CatConfig } from '@cat-cafe/shared';
import { RICH_BLOCK_SHORT } from './rich-block-rules.js';

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

/** Get all cat configs — registry first, fallback to static CAT_CONFIGS */
function getAllConfigs(): Record<string, CatConfig> {
  const registryConfigs = catRegistry.getAllConfigs();
  return Object.keys(registryConfigs).length > 0 ? registryConfigs : CAT_CONFIGS;
}

/** Get a single cat config by ID */
function getConfig(catId: string): CatConfig | undefined {
  const entry = catRegistry.tryGet(catId);
  if (entry) return entry.config;
  return CAT_CONFIGS[catId];
}

interface CallableCatEntry {
  readonly id: string;
  readonly config: CatConfig;
}

interface CallableMentionsResult {
  readonly mentions: string[];
  readonly hasDuplicateDisplayNames: boolean;
  readonly uniqueHandleExample: string | null;
}

function pickVariantMention(id: string, config: CatConfig): string {
  const expected = `@${id}`.toLowerCase();
  const byId = config.mentionPatterns.find((p) => p.toLowerCase() === expected);
  if (byId) return byId;
  if (config.mentionPatterns.length > 0) {
    return [...config.mentionPatterns].sort((a, b) => a.length - b.length)[0]!;
  }
  return `@${id}`;
}

function buildCallableMentions(currentCatId: CatId): CallableMentionsResult {
  const entries: CallableCatEntry[] = Object.entries(getAllConfigs())
    .filter(([id]) => id !== currentCatId)
    .map(([id, config]) => ({ id, config }));

  if (entries.length === 0) {
    return { mentions: [], hasDuplicateDisplayNames: false, uniqueHandleExample: null };
  }

  const byDisplayName = new Map<string, CallableCatEntry[]>();
  for (const entry of entries) {
    const group = byDisplayName.get(entry.config.displayName);
    if (group) {
      group.push(entry);
    } else {
      byDisplayName.set(entry.config.displayName, [entry]);
    }
  }

  const hasDuplicateDisplayNames = Array.from(byDisplayName.values()).some((group) => group.length > 1);
  const mentions: string[] = [];
  const seen = new Set<string>();
  let uniqueHandleExample: string | null = null;

  for (const entry of entries) {
    const group = byDisplayName.get(entry.config.displayName) ?? [];
    const mention = group.length <= 1 || entry.config.isDefaultVariant
      ? `@${entry.config.displayName}`
      : pickVariantMention(entry.id, entry.config);
    if (group.length > 1 && !entry.config.isDefaultVariant && uniqueHandleExample == null) {
      uniqueHandleExample = mention;
    }
    if (!seen.has(mention)) {
      seen.add(mention);
      mentions.push(mention);
    }
  }

  return { mentions, hasDuplicateDisplayNames, uniqueHandleExample };
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

/**
 * Skills-as-source-of-truth: MCP tools section is minimal.
 * Full specs live in cat-cafe-skills/ (using-rich-blocks, using-mcp-callbacks).
 */
const MCP_TOOLS_SECTION = `
⚠️ **@队友的正确方式**：直接在回复文本里另起一行、行首写 \`@猫名\`（免费、永不过期）。
下面的 MCP 工具用于**异步中途汇报**等高级场景，token 有生命周期限制。

你可以使用以下 Cat Cafe MCP 工具：
- cat_cafe_post_message: 任务中途主动发送异步消息（简单 @队友请用回复文本行首 @猫名）
- cat_cafe_get_pending_mentions: 获取待处理的 @提及
- cat_cafe_get_thread_context: 获取当前对话上下文
- cat_cafe_update_task: 更新自己负责的任务状态
- cat_cafe_create_rich_block: 创建富消息块（card/diff/checklist/media_gallery/audio）
- cat_cafe_get_rich_block_rules: 获取富消息块完整使用规范（skill 不可用时的 fallback）

${RICH_BLOCK_SHORT}
首次使用富消息块前，加载 \`using-rich-blocks\` skill 查阅完整规范。`;

/** Per-breed workflow triggers: when to proactively @ other cats.
 *  Keyed by breedId so all variants of a breed share the same workflow. */
const WORKFLOW_TRIGGERS: Record<string, string> = {
  ragdoll: [
    '## 工作流（主动 @ 触发点）',
    '- 完成开发/修复 → @缅因猫 请 review',
    '- 修完 review 意见 → @缅因猫 确认修复',
    '- 遇到视觉/体验问题 → @暹罗猫 征询',
    '- Review 别人代码：每个发现必须有明确立场，禁止说"修不修都行"',
  ].join('\n'),
  'maine-coon': [
    '## 工作流（主动 @ 触发点）',
    '- 完成 review → @布偶猫 通知结果',
    '- 修完 bug/feature → @布偶猫 请 review',
    '- Review 布偶猫代码：每个发现必须有明确立场，禁止说"修不修都行"',
    '- 收到 review 意见：独立判断，认为自己对就 push back，不全盘接受',
  ].join('\n'),
  siamese: [
    '## 工作流（主动 @ 触发点）',
    '- 完成设计/视觉资产 → @布偶猫 + @缅因猫 请确认',
    '- 遇到技术实现问题 → @布偶猫 征询',
  ].join('\n'),
};

/**
 * Build static identity prompt — persistent across invocations.
 * Includes: identity, personality, rules, A2A format, workflow triggers.
 * Suitable for --system-prompt / --append-system-prompt injection.
 */
export function buildStaticIdentity(catId: CatId): string {
  const config = getConfig(catId as string);
  if (!config) return '';

  const providerLabel = PROVIDER_LABELS[config.provider] ?? config.provider;
  const lines: string[] = [];

  // Identity
  const nameLabel = config.nickname
    ? `${config.displayName}/${config.nickname}（${config.name}）`
    : `${config.displayName}（${config.name}）`;
  lines.push(
    `你是 ${nameLabel}，由 ${providerLabel} 提供的 AI 猫猫。`,
    ...(config.nickname ? [`昵称 "${config.nickname}" 的由来见 docs/stories/cat-names.md。`] : []),
    `角色：${config.roleDescription}`,
    `性格：${config.personality}`,
    '',
  );

  // A2A collaboration format (always included — cats should know how to @ even in single-cat mode)
  const {
    mentions: callableMentions,
    hasDuplicateDisplayNames,
    uniqueHandleExample,
  } = buildCallableMentions(catId);
  if (callableMentions.length > 0) {
    const exampleTarget = callableMentions[0]!;
    lines.push('## 协作');
    lines.push(`你可以 @队友: ${callableMentions.join(' / ')}`);
    if (hasDuplicateDisplayNames) {
      const example = uniqueHandleExample ?? '@opus';
      lines.push(`同族多分身时：默认 \`@显示名\`，其它用**唯一句柄**（例如 \`${example}\`）。`);
      lines.push(`同名队友并存时，请优先使用唯一句柄（例如 \`${example}\`）避免歧义。`);
    }
    lines.push('格式：另起一行，在行首写 @猫名（行中间的 @ 无效）。');
    lines.push(`✅ 正确：另起一行 ${exampleTarget}`);
    lines.push(`❌ 错误：怎么样 ${exampleTarget}？ ← 行中间无效`);
    lines.push('');
  }

  // Per-breed workflow triggers (fallback to catId for legacy configs without breedId)
  const triggers = WORKFLOW_TRIGGERS[config.breedId ?? ''] ?? WORKFLOW_TRIGGERS[catId as string];
  if (triggers) {
    lines.push(triggers, '');
  }

  // Rules
  lines.push('规则：不要冒充其他猫。不要编造自己的型号。不确定时明确说"我不确定"或"我需要查证"，绝不编造信息。用你自己的风格回答。');
  lines.push('');

  // Identity contract
  lines.push('身份契约：你是 Cat Café 家庭成员。讨论团队时用"我们/咱们"，不用"你们/他们"指代三猫团队（引用外部评价除外）。');

  return lines.join('\n');
}

/**
 * Build dynamic invocation context — changes per call.
 * Includes: teammates, mode, chain position, MCP tools, prompt tags.
 */
export function buildInvocationContext(context: InvocationContext): string {
  const config = getConfig(context.catId as string);
  if (!config) return '';

  const lines: string[] = [];

  // Teammates — only list cats actually in this invocation
  if (context.teammates.length > 0) {
    lines.push('你的队友：');
    for (const id of context.teammates) {
      const c = getConfig(id as string);
      if (c) {
        const tmName = c.nickname ? `${c.displayName}/${c.nickname}` : c.displayName;
        lines.push(`- ${tmName}（${c.name}）：${c.roleDescription}`);
      }
    }
  }
  lines.push('铲屎官是真人用户，是团队的共创伙伴。重要决策时由铲屎官拍板。', '');

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

  return lines.join('\n');
}

/**
 * Build identity system prompt for a cat invocation.
 * Backward-compatible: returns staticIdentity + invocationContext combined.
 * Pure function — same inputs always produce same output.
 */
export function buildSystemPrompt(context: InvocationContext): string {
  const staticPart = buildStaticIdentity(context.catId);
  if (!staticPart) return '';
  const dynamicPart = buildInvocationContext(context);
  return dynamicPart ? `${staticPart}\n\n${dynamicPart}` : staticPart;
}
