---
feature_ids: []
topics: [context, assembler, truncation]
doc_kind: bug-report
created: 2026-02-24
---

# Bug Report: ContextAssembler 截断策略导致猫猫丢失消息结尾关键信息

## 1. 报告人
- 报告人：铲屎官（2026-02-24 实测发现）
- 定位：布偶猫（宪宪）
- 发现方式：铲屎官打开缅因猫的 Codex 终端，发现缅因猫获取到的对话历史被截断，只拿到了消息的前 1500 chars，关键的结论和 review 请求在结尾被丢弃

## 2. 复现步骤

### 复现
1. 在 Cat Café 线程中，布偶猫发送一条长消息（>1500 chars），包含多阶段工作记录 + 结尾的总结/review 请求
2. @缅因猫 触发 Codex 调用
3. ContextAssembler 组装上下文时，该消息被截断到 1500 chars

### 期望
缅因猫能看到消息的关键部分（通常是结尾的结论/请求），不至于"失忆"

### 实际
缅因猫只看到前 1500 chars（工作过程日志），结尾的 review 请求和代码改动总结被丢弃。具体截断位置：
> "Now Phase 4: Simplify route-serial and route-parallel — no more short/full distinction.Line 125 error — there's another reference to..."

## 3. 根因分析

### 代码位置
`packages/api/src/domains/cats/services/context/ContextAssembler.ts`

```typescript
const DEFAULT_MAX_CONTENT_LENGTH = 1500;  // L34

// L69-70: 硬截断 — 保留开头，丢弃结尾
if (options?.truncate && content.length > options.truncate) {
  content = content.slice(0, options.truncate) + '...';
}
```

### 问题
1. **截断策略是"保留开头、丢弃结尾"**：但消息的关键信息（结论、决策、请求）通常在结尾
2. **截断粒度太粗**：1500 chars 对于包含代码块/多阶段记录的工作消息来说不够
3. **无感截断**：猫猫不知道自己看到的消息是截断过的，可能基于不完整信息做出错误判断

### 额外上下文预算
除了 per-message 1500 char 限制，还有 `DEFAULT_MAX_TOTAL_TOKENS = 2000` 的总预算限制（取最近 20 条消息，从新到旧累加直到 token 预算用完）。两层截断叠加会更严重。

## 4. 修复方向

| 方案 | 描述 | 复杂度 | 效果 |
|------|------|--------|------|
| A. 保留首尾 | `head(750) + "...[截断]..." + tail(750)` | 低 | 保住结论 |
| B. 增大限制 | 1500→3000 或 env 可配 | 最低 | 治标不治本 |
| C. 智能摘要 | 超长消息用 LLM 摘要替代截断 | 高 | 最优但贵 |
| D. 标记截断 | 在截断消息末尾加 `[⚠️ 此消息已截断，原始 N chars]` | 低 | 让猫知道信息不完整 |

**建议**：A + D 组合 — 保留首尾 + 标记截断。成本低，效果明显。

## 5. 验证方式
1. 构造一条 >1500 chars 的消息，结尾包含关键信息
2. 通过 ContextAssembler 组装后验证结尾信息保留
3. 验证截断标记存在
