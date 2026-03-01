---
feature_ids: [F042]
topics: [prompt, identity, a2a, routing]
doc_kind: bug-report
created: 2026-03-01
---

# Bug Report: Identity drift（把自己当成 gpt52）+ A2A 回复目标丢失

## 1. 报告人
- 报告人：铲屎官（会话反馈）
- 定位：缅因猫/砚砚（@codex）
- 触发背景：多缅因 variant（`@codex` + `@gpt52`）+ 上下文压缩后，发生身份错位与回复目标错位

## 2. 复现步骤（期望 vs 实际）
场景 A（Identity drift）：
1. 在 thread 内进行较长对话，触发上下文压缩/恢复
2. 触发一次新的 invocation（例如对 `@codex` 发起调用）
3. 观察模型的自我陈述与“最近活跃”提示

期望：
- 被调用的猫能稳定识别“我是谁”（`@codex` vs `@gpt52`）
- 不会把“最近活跃：@gpt52”误当成“我就是 gpt52”

实际：
- 出现“我（@codex）= @gpt52 / @codex 与 @gpt52 是同一个入口”的错误陈述

场景 B（A2A 回复目标丢失）：
1. 猫 A 在回复里行首 `@gpt52` 请求本地 review（A2A mention）
2. 系统触发 A2A 链调用 gpt52
3. 观察 gpt52 的回复对象

期望：
- gpt52 明确“这是 direct message”，并回复给发起者（猫 A），而不是把 thread 当成对铲屎官的发言

实际：
- gpt52 有时把回复写成“对铲屎官说”，甚至出现自指 `@gpt52` 的漂移行为

## 3. 根因分析
1. **每回合缺少 Identity 常量**：
   - `buildInvocationContext()` 已注入 `最近活跃：@...`（用于 @ 句柄去歧义）
   - 但没有在同一层级注入 “你是谁(@handle + model)” 的硬常量
   - 压缩后模型可能将“最近活跃”误解为“当前身份”
2. **A2A 缺少 ReplyTarget 常量**：
   - A2A 链路知道“是谁 @ 了谁”，但没有把“reply to 谁”注入到被调用猫的 per-invocation prompt
3. **文档增加了歧义**：
   - `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` 曾把 ``@codex` / `@gpt52` `` 写在同一行，容易被理解成同一入口

## 4. 修复方案（含取舍）
选定方案（最小但系统级）：
1. **InvocationContext pinned Identity**：
   - 在 `buildInvocationContext()` 顶部注入：
     - `Identity: <displayName>/<nickname> (@<catId>, model=<defaultModel>)`
   - 目的：即使压缩后也能稳定自识别，并可用 `model=` 反证“是否真的路由到了错误模型”
2. **InvocationContext pinned ReplyTarget（Direct message）**：
   - 当 invocation 由 A2A 触发时，注入：
     - `Direct message from @<from>; reply to @<from>`
3. **链路打通（A2A sender mapping）**：
   - `WorklistRegistry` 记录 A2A target 的来源（`a2aFrom`）
   - `route-serial` 在构建 invocationContext 时传入 `directMessageFrom`
4. **文档去歧义**：
   - 将三猫文件中同一行的 ``@codex` / `@gpt52` `` 拆成两行，并标注各自 model

放弃方案：
- 仅靠“消息里写握手协议”：已证明不足（压缩/定向消息语义丢失时仍会 drift）
- 全局 `available:false`：过于粗暴（我们需要按场景禁用 reviewer，而非全局禁用架构讨论）

## 5. 验证方式（Red → Green）
Red（复现证据）：
- 现象：同族 reviewer 被 @ 时出现身份错位、回复目标错位（聊天记录截图）

Green（自动化）：
- 新增/更新测试：
  - `packages/api/test/system-prompt-builder.test.js`：
    - 断言 `buildInvocationContext` 包含 `Identity:` 行（含 `@codex` + `gpt-5.3-codex`）
    - 断言 `Direct message from ...; reply to ...` 文案
  - `packages/api/test/integration/a2a-chain.test.js`：
    - 断言 A2A 触发的 codex prompt 包含 `Direct message from @opus`
- 命令：
  - `pnpm --filter @cat-cafe/api build`
  - `node --test packages/api/test/system-prompt-builder.test.js packages/api/test/integration/a2a-chain.test.js`

Green（人工）：
- 合入后在新 thread 重测：
  - `@codex` 调用时应稳定输出/遵守 `Identity: ... (@codex, model=gpt-5.3-codex)`
  - A2A 调用 gpt52 时应出现 `Direct message from ...; reply to ...` 并将回复写给发起猫

