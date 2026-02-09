# Bug Report: Gemini CLI 回答后收尾崩溃（`candidates` undefined）

> **报告人**: 铲屎官  
> **定位猫猫**: 缅因猫 🐾  
> **报告日期**: 2026-02-09  
> **严重程度**: P1（用户看到“回答后又报错”）  
> **状态**: ✅ 已缓解（服务端）/ ⏳ 上游待修

---

## 1. 报告来源

- 来源：铲屎官反馈“应当追 Gemini CLI 为什么报错，而不是只处理显示层”。
- 触发现象：Gemini 已输出正文后，紧接着系统报错。

---

## 2. 复现步骤（期望 vs 实际）

1. 调用 Gemini CLI 流式输出（`-o stream-json`）。
2. 观察完整回合输出。

**期望行为**  
- 正文完成后回合正常结束（`done`），不出现错误。

**实际行为**  
- 先收到 assistant 正文，再出现错误并退出码 1。

---

## 3. 根因分析（证据）

### 证据 1：CLI 本体可复现“正文后崩溃”

示例命令：

```bash
gemini -p "请只回复 hi" -o stream-json -y
```

一次失败样本（关键片段）：

- 收到：`{"type":"message","role":"assistant","content":"hi","delta":true}`
- 随后 stderr 报错：`TypeError: Cannot read properties of undefined (reading 'candidates')`
- 收到：`{"type":"result","status":"error","error":{"message":"[API Error: Cannot read properties of undefined (reading 'candidates')]"}}`
- 进程退出：`exit code = 1`

堆栈显示落点在：
- `@google/gemini-cli-core/dist/src/code_assist/converter.js`
- `fromGenerateContentResponse(...)`

### 证据 2：Cat Café 适配层将该后置崩溃上抛为用户错误

- `GeminiAgentService` 在已输出文本后继续接收 `result/error` 与 `cli exit error`。
- 最终用户看到“回答 + 报错”组合，形成误导性失败体验。

---

## 4. 修复方案与取舍

### 选定方案（根因级缓解）

在 `GeminiAgentService` 增加“已知后置崩溃识别”：

1. 若已输出 assistant 文本；
2. 且 `result/error` 的 message 命中 `candidates` undefined 崩溃签名；
3. 则将其判定为 CLI 收尾缺陷，不再向用户抛错；
4. 同时抑制随后的非零退出重复错误。

这不是“隐藏所有错误”，而是仅针对有明确签名、明确发生在“正文已成功生成之后”的外部 CLI 缺陷做降噪。

### 放弃方案

- 方案 A：无差别吞掉所有 “有正文后的错误”
  - 放弃原因：会掩盖真实失败。
- 方案 B：保持现状，把完整堆栈直接展示给用户
  - 放弃原因：噪声大、可操作性差，且可能泄露过多内部路径信息。

### Open Questions

- 是否在系统层加入“Gemini CLI 版本/健康检查”并提示升级（当前先修行为）。

### Next Action

- 持续跟踪 `@google/gemini-cli` 上游修复；一旦发布包含修复的版本，移除临时签名分支并做回归验证。

---

## 5. 验证方式

1. 单测：复现“有正文 + candidates 崩溃 + exit1”时，不再向用户产出 `error`（已通过）。
2. 单测：其他真实错误仍可上抛（已通过）。
3. 回归：Gemini 正常成功流不受影响（已通过）。
4. 环境复核：`gemini --version` 已升级到 `0.27.3`（当前 npm 最新），命令行直连仍可间歇复现该崩溃，确认属于上游缺陷。

---

*签名: 缅因猫 🐾*
