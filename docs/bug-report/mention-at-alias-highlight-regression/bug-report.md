# Bug Report: 语音 `at` 与昵称别名在 mention 路由/高亮不一致

## 1. 报告人
- 报告人：铲屎官（对话内反馈）
- 定位猫猫：缅因猫
- 发现方式：实测语音输入会把 `@` 识别成 `at`，并观察到消息气泡 mention 未高亮

## 2. 复现步骤（期望 vs 实际）
1. 发送包含语音风格 mention 的文本（例如：`at砚砚 和宪宪 你们出来了` 或 `@宪宪 @砚砚`）。
2. 观察目标猫路由与消息气泡高亮效果。

期望行为：
- `at + 别名` / `@ + 别名` 都能稳定识别为 mention。
- 别名（含昵称、英文别名）在消息气泡中按猫猫颜色高亮。

实际行为：
- 后端路由仅按 `@` 前缀匹配；`at` 形态存在漏识别风险。
- 前端 `MarkdownContent` 高亮只覆盖主称呼（如 `@缅因猫`、`@codex`），未覆盖 `@砚砚`、`@宪宪`、`@maine`、`@ragdoll` 等别名。

## 3. 根因分析
- 根因 1（路由层）：`packages/api/src/domains/cats/services/AgentRouter.ts` 的 mention 解析依赖 `indexOf('@...')`，缺少对语音常见 `at` 前缀的兼容。
- 根因 2（渲染层）：`packages/web/src/components/MarkdownContent.tsx` 使用独立硬编码正则，仅包含少量别名，和 `CAT_CONFIGS.mentionPatterns` 已发生语义漂移。
- 根因 3（输入标准化）：`packages/web/src/utils/transcription-corrector.ts` 目前只做术语替换/口头词清理，未把 `at + 别名` 规范化为统一 mention 形式。

## 4. 修复方案（含取舍）
选定方案：
- 路由层：增加对 `at + 别名`（含中英文、昵称）的识别，兼容语音输入。
- 输入层：在 transcription 纠正阶段把 `at + 别名` 归一化为 `@别名`，降低后续链路分叉。
- 渲染层：扩展 mention 高亮词表，覆盖 `CAT_CONFIGS` 全量别名（昵称 + 英文别名）。

放弃方案：
- 方案 A：只改前端高亮，不改路由和输入层
  - 放弃原因：只能“看起来像修好”，实际仍会漏路由。
- 方案 B：只改路由，不改高亮
  - 放弃原因：功能可用但反馈不一致，用户无法直观看到 mention 命中。

## 5. 验证方式（Red → Green）
Red（已执行）：
- API 失败用例：
  - 新增：`packages/api/test/agent-router-speech-mentions.test.js`
  - 命令：`pnpm --filter @cat-cafe/api exec node --test test/agent-router-speech-mentions.test.js`
  - 失败点：`expected ['codex', 'opus'], actual ['opus']`
- Web 失败用例：
  - 新增：`packages/web/src/utils/__tests__/transcription-corrector.test.ts`（`at` 规范化断言）
  - 新增：`packages/web/src/components/__tests__/markdown-content-mentions.test.ts`
  - 命令：`pnpm --filter @cat-cafe/web test -- src/utils/__tests__/transcription-corrector.test.ts src/components/__tests__/markdown-content-mentions.test.ts`
  - 失败点：
    - transcription：`at咱的砚砚 和 at 宪宪...` 未转换为 `@...`
    - markdown：HTML 不含 `text-codex-primary/text-opus-primary/text-gemini-primary`

Green（已执行）：
- API：
  - 命令：`pnpm --filter @cat-cafe/api build && pnpm --filter @cat-cafe/api exec node --test test/agent-router-speech-mentions.test.js`
  - 结果：`1 passed, 0 failed`
- Web：
  - 命令：`pnpm --filter @cat-cafe/web test -- src/utils/__tests__/transcription-corrector.test.ts src/components/__tests__/markdown-content-mentions.test.ts`
  - 结果：`29 passed, 0 failed`
- 关联回归：
  - 命令：`pnpm --filter @cat-cafe/api exec node --test --test-name-pattern "handles all English mention patterns correctly|handles all Chinese mention patterns correctly|case insensitive mention matching|routes to codex when Chinese mention @缅因猫 is used" test/agent-router.test.js`
  - 结果：`4 passed, 0 failed`
