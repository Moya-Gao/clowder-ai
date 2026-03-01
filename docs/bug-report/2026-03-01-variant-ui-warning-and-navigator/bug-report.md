---
feature_ids: []
debt_ids: [TD105, TD106]
topics: [variants, ui, warning, navigator, system_info]
doc_kind: bug-report
created: 2026-03-01
---

# Bug Report: 多分身（variant）导致 UI 误显示「系统」+ warning JSON 直出

## 1. 报告人
- 报告人：铲屎官（会话截图反馈，2026-03-01）
- 定位/修复：缅因猫（砚砚）

## 2. 复现步骤（期望 vs 实际）

### 2.1 warning JSON 直出（图 1）
前置条件：
- Codex CLI 在 `exec resume` 时输出 `system_info` 警告（`{ type: "warning", message: "This session was recorded with model ..."}`

复现：
1. 触发一次 Codex resume（或任何会产生 item-level warning 的场景）
2. 观察 Web Chat 中的 system bubble

期望：
- UI 以可读文本展示 warning（例如 `⚠️ ...`），而不是打印整段 JSON

实际：
- system bubble 显示 raw JSON：`{"type":"warning","catId":"gpt52","message":"..."}`（可读性差）

### 2.2 右侧圆点导航把猫当「系统」（图 2）
复现：
1. 让 `opus-45` / `codex-spark` 等变体发出一条 assistant 消息
2. hover 右侧圆点导航 tooltip

期望：
- tooltip 显示正确发送者（例：`布偶猫（4.5）` / `缅因猫（Spark）`），圆点颜色匹配对应猫

实际：
- tooltip fallback 为「系统」或灰色点，导致“谁说的话”不可追溯

## 3. 根因分析
- **warning 直出**：前端 `useAgentMessages.ts` 对 `system_info` 的 JSON 解析覆盖了 `thinking/task_progress/...`，但遗漏 `type: "warning"` 分支，导致解析成功却走默认渲染，把 JSON 当成普通文本显示。
- **导航误显示系统**：`MessageNavigator.tsx` 写死了 `opus/codex/gemini` 三猫映射（颜色与名字），遇到 `opus-45/codex-spark/gpt52/...` 等变体 id 时无法命中，降级到灰色/「系统」。

## 4. 修复方案（含取舍）
选定方案：
- `useAgentMessages.ts`：补齐 `system_info` 的 `warning` 分支，将 `{message}` 渲染为 `⚠️ ${message}`。
- `MessageNavigator.tsx`：改为基于 `useCatData()` 的动态 cat registry 渲染名字/颜色；并增加一个轻量 fallback：当变体 id 未加载时，尝试用 `baseId = catId.split('-')[0]` 映射到基础猫（例如 `opus-45 → opus`），至少保证“不是系统 + 颜色正确”。

放弃方案：
- 在 UI 层硬编码更多变体（`opus-45/sonnet/gpt52/...`）：
  - 缺点：维护成本高，新增变体必漏；与 F32-b 的动态 cat data 方向相悖。

## 5. 验证方式（Red → Green）
Red（改动前）：
- 新增测试会失败：
  - `useAgentMessages-warning.test.ts`：断言 warning JSON 应渲染为 `⚠️ ...`（旧逻辑会输出 raw JSON）
  - `message-navigator.test.ts`：断言 `opus-45` tooltip/颜色应正确（旧逻辑会降级为「系统」+ 灰点）

Green（已执行）：
- 命令：
  - `pnpm --filter @cat-cafe/web test`
- 结果：
  - `567 pass, 0 fail`

