/**
 * Rich Block Usage Rules (Progressive Disclosure)
 *
 * F-BLOAT: Extracted from SystemPromptBuilder.MCP_TOOLS_SECTION and
 * McpPromptInjector.buildMcpCallbackInstructions to avoid duplicating
 * ~950 chars in every single invocation prompt.
 *
 * Full rules available via (in priority order):
 *   1. Skill: cat-cafe-skills/using-rich-blocks/SKILL.md (primary SOT)
 *   2. MCP tool: cat_cafe_get_rich_block_rules (fallback for Claude)
 *   3. HTTP endpoint: GET /api/callbacks/rich-block-rules (fallback for Codex/Gemini)
 *
 * System prompts contain only a short reference.
 */

export const RICH_BLOCK_RULES = `### 富消息块使用规则（B 风格：平衡）

**核心原则**：结构化信息默认用富块，普通对话不用。先写 1-2 句自然语言摘要，再发富块。

**何时使用**（默认触发）：
- **card** (tone: info/success/warning/danger)
  - review 结论（P1/P2 列表 + 放行/阻塞决策）
  - 任务/阶段状态报告（当前进度、关键指标）
  - 决策摘要（What/Why/Tradeoff）
  - 游戏状态面板（角色信息、回合状态）
- **diff**
  - 代码修改建议（具体的补丁片段）
  - 重构前后对比
- **checklist**
  - 待办事项 / 下一步行动
  - review 要点清单
  - 验证步骤 / 测试计划
- **media_gallery**
  - 截图、设计稿展示
  - 多图对比
- **audio**（语音消息 — 你"说出来"的话）
  - 打招呼、表达情感、庆祝、鼓励
  - 只填 \`text\`，系统会自动合成语音
  - 不要每条消息都发语音，只在你觉得"说出来比打字更好"时用

**何时不用**（保持纯文本）：
- 日常聊天、闲聊、打招呼
- 简短回答（一两句话能说清的）
- 技术讨论、长篇回复
- 提问和讨论（除非需要结构化选项）
- 不确定用哪种 → 不用

**字段要求**（⚠️ 注意 kind 不是 type！）：
- 每个 block 必须有 \`"kind"\`（不是 \`"type"\`！）和 \`"v": 1\`，以及唯一 \`id\`
- card: \`title\` 必填，\`bodyMarkdown\`/\`tone\`/\`fields\` 可选
- diff: \`filePath\` + \`diff\` 必填，\`languageHint\` 可选
- checklist: \`items\` 必填（每项需 \`id\` + \`text\`），\`title\` 可选
- media_gallery: \`items\` 必填（每项需 \`url\`），\`title\`/\`alt\`/\`caption\` 可选
- audio: \`text\` 必填（你想说的话，简短口语化，1-2 句）`;

/**
 * Condensed rich block reference for injection into system prompts.
 * Full rules: load `using-rich-blocks` skill (primary).
 * Fallback: MCP tool `cat_cafe_get_rich_block_rules` or HTTP endpoint.
 */
export const RICH_BLOCK_SHORT = `富消息块：结构化信息用富块，普通对话不用。先写 1-2 句摘要再发。
⚠️ 字段名是 "kind"（不是 "type"！），必须有 "v": 1 和唯一 id。
支持: card / diff / checklist / media_gallery / audio。`;
