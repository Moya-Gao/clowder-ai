---
feature_ids: [F002]
topics: [gpt52, mention, alias]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: `@gpt5.2` 无法命中 `gpt52` 变体

## 1. 报告人
- 报告人：铲屎官（会话反馈）
- 定位：缅因猫（砚砚）
- 发现方式：用户反馈 `@gpt5.2` 仍无法触发，只有 `@gpt52` 可用

## 2. 复现步骤（期望 vs 实际）
1. 在 A2A 消息里输入行首 mention：`@gpt5.2 请帮我 review`
2. 观察 mention 解析结果

期望：
- 结果包含 `gpt52`

实际：
- 结果为空数组 `[]`

补充对照：
- `@gpt52` 可被正确解析为 `gpt52`

## 3. 根因分析
- `parseA2AMentions` 只会匹配 `mentionPatterns` 显式配置的 alias。
- 当前 `cat-config.json` 中 `codex-gpt52` 的 alias 只有 `@gpt52/@gpt-52/@缅因gpt52`。
- 因此 `@gpt5.2` 没有匹配项，导致路由无法触发。

## 4. 修复方案（含取舍）
选定方案：
- 在 `codex-gpt52` 的 `mentionPatterns` 增加 `@gpt5.2` 和 `@gpt-5.2`。
- 同时补两类测试：
  - 运行时解析测试（`parseA2AMentions`）
  - 配置回归测试（`cat-config-loader`）

放弃方案：
- 在解析层做模糊归一化（如自动处理小数点）：
  - 风险：扩大误匹配面，与现有“显式 alias 驱动”策略冲突。

## 5. 验证方式（Red → Green）
Red（已执行）：
- 命令：
  - `pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api build && pnpm --filter @cat-cafe/api exec node --test test/a2a-mentions.test.js test/cat-config-loader.test.js`
- 结果：
  - `63 tests` 中 `2 fail`
  - 失败 1：`test/a2a-mentions.test.js` 断言 `@gpt5.2 -> ['gpt52']`，实际 `[]`
  - 失败 2：`test/cat-config-loader.test.js` 未包含 `@gpt5.2/@gpt-5.2`

Green（已执行）：
- 修改：
  - `cat-config.json`：`gpt52` 增加 `@gpt5.2`、`@gpt-5.2`
- 命令（与 Red 相同）：
  - `pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api build && pnpm --filter @cat-cafe/api exec node --test test/a2a-mentions.test.js test/cat-config-loader.test.js`
- 结果：
  - `63 pass, 0 fail`
  - 新增两个用例均转绿。
