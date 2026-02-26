---
feature_ids: []
topics: [a2a, prompt, variant]
doc_kind: bug-report
created: 2026-02-23
---

# Bug Report: A2A 系统提示词在多 variant 下 @队友歧义

## 1. 报告人
- 报告人：铲屎官（会话反馈）
- 定位：缅因猫（砚砚）
- 发现方式：在双缅因（`codex` + `gpt52`）场景下，系统提示词出现重复 `@缅因猫`，无法区分到底 @ 哪只

## 2. 复现步骤（期望 vs 实际）
1. 在运行时加载 `cat-config.json`（含多个同品种 variant，如 `codex` 与 `gpt52`）
2. 调用 `buildStaticIdentity('opus')` 或 `buildSystemPrompt({...catId:'opus'})`
3. 查看“你可以 @队友”这一行

期望：
- 提示词给出**可区分**且可触发的 @ 目标（例如 default 与 variant 使用不同句柄）
- 不出现重复的同名 `@缅因猫 / @缅因猫`

实际：
- 使用 `displayName` 直接拼接，出现重复名称（如 `@布偶猫 / @布偶猫 / @缅因猫 / @缅因猫 / ...`）
- 读者无法判断 `@缅因猫` 指向默认缅因还是 `gpt52` 变体

## 3. 根因分析
- `SystemPromptBuilder.buildStaticIdentity()` 在生成可 @ 队友列表时，逻辑是：
  - 遍历 registry configs
  - 过滤 self
  - 仅提取 `cfg.displayName`
  - 直接渲染成 `@${displayName}`
- 多 variant 共用同 `displayName`（例如都叫“缅因猫”）时，列表天然重复。
- 该逻辑忽略了 variant 级可区分信息（`variantLabel` / `catId` / `mentionPatterns`），因此提示词层面丢失了路由可判别性。

## 4. 修复方案（含取舍）
选定方案：
- 在提示词构建阶段新增“可区分句柄”规则：
  - 若某 `displayName` 仅对应一个队友：继续用 `@显示名`
  - 若同名队友有多个：
    - 默认 variant 优先用 `@显示名`（保持历史习惯）
    - 其他 variant 使用 `@catId`（如 `@gpt52`）进行显式区分
- 同时去重，避免重复句柄进入“你可以 @队友”列表。
- `McpPromptInjector` 文案补充“同名队友并存时请使用唯一句柄（如 `@gpt52`）”，避免静态示例误导。

放弃方案：
- 修改 A2A 解析器做“模糊同名路由”：
  - 会把“提示词歧义”转成“路由歧义”，风险更高。
- 强制所有 variant 改 displayName：
  - 影响 UI 与既有语义，改动面过大。

## 5. 验证方式（Red → Green）
Red（已执行）：
- 命令：
  - `pnpm --filter @cat-cafe/api build && node --test test/system-prompt-builder.test.js`
- 结果：
  - `28 tests` 中 `1 fail`
  - 失败点：`buildStaticIdentity disambiguates duplicate display names in runtime multi-variant config`
  - 断言：`@缅因猫` 在队友行应只出现 1 次，实际出现 2 次（证实同名歧义）

Green（已执行）：
- 修改：
  - `SystemPromptBuilder`：同名 displayName 场景下，默认 variant 保留 `@显示名`，非默认 variant 使用唯一句柄（优先 `@catId`）
  - `McpPromptInjector`：示例文案补充“同名并存时使用唯一句柄（如 @gpt52）”
  - 新增/更新测试：`system-prompt-builder.test.js`、`mcp-prompt-injector.test.js`
- 命令：
  - `pnpm --filter @cat-cafe/api build && node --test test/system-prompt-builder.test.js test/a2a-mentions.test.js test/mcp-prompt-injector.test.js`
- 结果：
  - `45 pass, 0 fail`
  - 新增的多 variant 歧义用例转绿，A2A mention 与 callback 注入回归全绿。
