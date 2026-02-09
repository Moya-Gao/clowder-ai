# Bug Report: Gemini 重复报错 + Tool Result 过长影响可读性

> **报告人**: 铲屎官  
> **定位猫猫**: 缅因猫 🐾  
> **报告日期**: 2026-02-09  
> **严重程度**: P1（错误反馈噪声 + 交互可读性下降）  
> **状态**: ✅ 已修复

---

## 1. 报告来源

- 来源：铲屎官在会话中反馈“Codex 的 tool 已出现，但 Gemini 报错有两条且 tool 详情太长”。
- 发现方式：前端聊天界面截图对比。

---

## 2. 复现步骤（期望 vs 实际）

### 问题 A：Gemini 重复报错

1. 触发 Gemini CLI 出错（例如 result/error + 进程非零退出）。
2. 观察系统错误气泡。

**期望行为**  
- 每次失败只出现一条明确错误。

**实际行为**  
- 同一失败出现两条错误：
  - `Gemini CLI returned an error`
  - `Gemini CLI: CLI 异常退出 (code: 1, signal: none)`

### 问题 B：Tool Result 详情过长

1. 触发较大输出的工具调用（例如 bootstrap 命令输出）。
2. 观察 tool result 展示区。

**期望行为**  
- 工具结果展示紧凑摘要，不应压缩主体对话阅读区。

**实际行为**  
- tool result 文本过长，消息气泡显著变高，影响阅读。

---

## 3. 根因分析

### 根因 A（Gemini 重复错误）

- `GeminiAgentService` 同时处理两类错误源：
  - NDJSON `result` 非 success → `error`
  - `spawnCli` 非零退出 → `__cliError` → `error`
- 当前缺少去重逻辑，因此同一失败被转发两次。

### 根因 B（Tool 详情过长）

- 前端 `useAgentMessages` 对 `tool_result` 仅按字符截断（300），未按“行数 + 结构”做摘要。
- 多行 CLI 输出即使 300 字符也可能占用大量垂直空间。

---

## 4. 修复方案与取舍

### 选定方案

1. **Gemini 错误去重（后端）**
   - 增加 result-error 与 cli-exit-error 的去重策略。
   - 当 result/error 没有可读错误文案时，优先保留 CLI 退出错误。

2. **Tool Result 紧凑预览（前端）**
   - 增加多行摘要策略（限制行数 + 字符数）。
   - 保留关键信息（如 command/status/exit_code），压缩冗长输出。

### 放弃方案

- 前端仅靠“错误文案去重”处理 Gemini 双错误。
  - 放弃原因：属于症状层补丁，不能修复服务层重复发包。

### Open Questions

- 后续是否给 tool result 增加“展开/收起”交互（当前先做紧凑预览）。

### Next Action

- 在真实会话中再触发一次 Gemini 失败场景与长输出工具场景，确认 UI 观感符合预期。

---

## 5. 验证方式

1. API 单测：Gemini 非零退出 + result/error 场景只产生一条 `error`。
2. 前端验证：tool result 显示为紧凑摘要，不再大面积撑高气泡。
3. 回归：Gemini 正常输出与现有工具流不受影响。

### 本次验证结果

- `pnpm -C packages/api run build && pnpm -C packages/api exec node --test test/gemini-agent-service.test.js`  
  - `18 passed / 0 failed`
- `pnpm -C packages/api run build && pnpm -C packages/api run test`  
  - `571 passed / 0 failed / 1 skipped`
- `pnpm -C packages/web run test`  
  - `19 passed / 0 failed`
- `pnpm -C packages/web run build`  
  - 构建成功（仅既有 `<img>` 优化 warning，无新增错误）

---

*签名: 缅因猫 🐾*
