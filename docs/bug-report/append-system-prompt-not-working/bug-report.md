---
feature_ids: []
topics: [append, system, prompt]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: --append-system-prompt 不生效，猫猫新 session 缺失身份/队友/MCP

**报告人**: 铲屎官（在某只布偶猫的 session 中观察到）
**发现方式**: 铲屎官打开猫的 session 详情，发现第一条消息只有"当前模式：独立回答"+增量对话历史，完全没有身份/队友/MCP 信息
**日期**: 2026-02-26

## 复现步骤

### 期望行为
- 新 session 第一次调用时，猫收到完整 prompt：身份认同 + 队友花名册 + MCP 工具列表 + A2A 格式说明 + 当前模式 + 增量对话历史

### 实际行为
- 新 session 第一次调用时，猫只收到：`当前模式：独立回答` + 增量对话历史
- 缺失：身份认同、队友花名册、MCP 工具列表、A2A 格式、铲屎官说明、工作流触发器
- 结果：猫猫"非常懵逼，根本不知道他有什么 MCP、什么队友"

## 根因分析

### 定位过程

1. 铲屎官提供两张截图对比——bug 版 vs 期望版
2. 检查 `route-serial.ts` prompt 组装逻辑——发现 `parts` 数组不包含 `staticIdentity`
3. 追踪 `staticIdentity` 的流向：`buildStaticIdentity()` → `systemPrompt` param → `invoke-single-cat.ts` → `ClaudeAgentService.ts` → `--append-system-prompt` CLI flag
4. 确认 `--append-system-prompt` flag 的内容没有传达给猫

### 根因

Commit `14c40f3`（MCP tool instruction 优化）将 `staticIdentity` 从 `-p`（user prompt，每条消息都有）移到 `--append-system-prompt`（CLI system prompt slot，只注入一次）。

**`route-serial.ts:155`**（incremental mode）:
```typescript
const parts = [invocationContext, catModePrompt, bootstrapContext, mcpInstructions].filter(Boolean);
// ❌ staticIdentity 不在 parts 里！它走单独的 systemPrompt 参数
```

**`ClaudeAgentService.ts:119-121`**:
```typescript
if (options?.systemPrompt) {
  args.push('--append-system-prompt', options.systemPrompt);
}
```

`--append-system-prompt` 虽然把内容传给了 Claude CLI，但猫猫实际上没有接收到这些内容。可能原因：
1. `--append-system-prompt` 在新 session 中的行为不如预期（可能只对 `--resume` 有效？）
2. 内容进入了 system prompt slot 但对猫猫的感知不如 user prompt 显著
3. Claude CLI 版本差异导致 flag 行为不一致

### 影响范围

- **所有猫（Claude/Codex/Gemini）的新 session 第一次调用**都受影响
- 既有 session 的 resume 调用也受影响（F-BLOAT gate 跳过 systemPrompt 注入，而 `-p` 里也没有 staticIdentity）
- Session chain 猫（Claude/Codex）：从来不会在 `-p` 里看到身份信息
- 非 session chain 猫（Gemini）：systemPrompt 可能通过其他方式注入，影响待确认

## 修复方案

**Belt and suspenders（双重注入）**：将 `staticIdentity` 加回 `parts` 数组（进入 `-p` 内容），同时保留 `systemPrompt` 参数传递（进入 `--append-system-prompt`）。

理由：
- `-p` 是经过验证的可靠注入通道，猫猫一定能看到
- 保留 `systemPrompt` 作为防御性冗余，未来 `--append-system-prompt` 修复后可以优化
- 最小化测试修改（F-BLOAT 相关测试不需要改）

### 放弃的方案

- **只修 `--append-system-prompt` 的使用方式**：需要理解 Claude CLI 内部行为，调查时间不确定
- **完全移除 systemPrompt 参数**：需要修改 8+ 个测试，且丢失 F-BLOAT 门控优化（未来可用）
- **条件性注入（只在新 session 时放入 parts）**：route 层不知道是否 resume，需要重构

### Token 开销评估

staticIdentity 约 1500 chars（含身份+队友+MCP）。在 incremental mode 下每次调用都会包含在 `-p` 中，相比优化前的行为（也是每次都包含），无额外开销。

## 验证方式

1. 跑现有测试确认无回归
2. 检查 agent-router identity injection 测试仍然通过
3. 如果可能，启动一个新 session 观察猫的第一条消息是否包含完整身份信息
