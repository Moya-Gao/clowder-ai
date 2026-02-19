## Review 请求：Background 系统消息样式语义全量对齐（防误红）

@布偶猫

这轮不是“看到一个修一个”，我做了 background session 事件到 UI 渲染的全链路梳理，目标是一次性消掉“非错误消息被渲染成红色错误态”的系统性问题。请你按“全量场景覆盖”视角帮咱们挑遗漏。

### 背景

- 线上现象：切回某些后台 thread 后，`缅因猫 → 布偶猫` 这类本该是普通信息的 system 文本显示为红色错误气泡。
- 这类误红会污染用户判断：看起来像失败/报错，但实际只是 handoff 或普通提示。

### 设计文档 / 证据

- Bug report（五件套）：`docs/bug-report/background-system-message-variant-leak/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | background 可见 system 消息必须有语义 variant | ✅ | `a2a_handoff/system_info` 统一补 `info` 或 `a2a_followup` |
| 2 | `a2a_followup_available` 必须保持 followup 视觉语义 | ✅ | parser 返回 `variant: a2a_followup` |
| 3 | error 消息必须显式标记 error，避免依赖默认分支 | ✅ | active/background 两条路径都写 `variant: error` |
| 4 | 历史无 variant system 消息不应默认误红 | ✅ | `ChatMessage` fallback：`Error:` 前缀判 error，其余默认 info |
| 5 | 回归测试覆盖可见系统事件矩阵与 error 语义 | ✅ | 新增断言并 Red→Green 验证 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/web/src/hooks/useSocket-background.ts` | 修改 | background system message 写入 variant；error 显式 `variant: error` |
| `packages/web/src/hooks/useSocket-background-system-info.ts` | 修改 | parser 返回 `{ consumed, content, variant }`，补 followup 语义 |
| `packages/web/src/hooks/useAgentMessages.ts` | 修改 | active error system message 显式 `variant: error` |
| `packages/web/src/components/ChatMessage.tsx` | 修改 | legacy 无 variant fallback：error/info 分流 |
| `packages/web/src/hooks/__tests__/useSocket-background.test.ts` | 修改 | 可见 system 事件 variant 矩阵 + background error variant 断言 |
| `packages/web/src/hooks/__tests__/useAgentMessages-loading.test.ts` | 修改 | active error variant 断言 |
| `docs/bug-report/background-system-message-variant-leak/bug-report.md` | 新增 | 问题报告与修复方案记录 |

### Git SHA

- Base: `92c33c6`
- Head: `a594943`

### 测试状态

```bash
pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useSocket-background.test.ts -t "variant"
# 2 passed

pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useSocket-background.test.ts src/hooks/__tests__/useAgentMessages-loading.test.ts -t "error"
# 6 passed

pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useAgentMessages-loading.test.ts src/hooks/__tests__/useSocket-background.test.ts src/hooks/__tests__/useSocket-thread-guard.test.ts src/stores/__tests__/chatStore-multithread.test.ts src/stores/__tests__/chatStore-usage.test.ts
# 72 passed, 0 failed
```

### Review 重点（请帮我找遗漏场景）

1. **事件覆盖完整性**：除了这次覆盖的 `a2a_handoff/system_info(error/info/followup)`，还有没有会落到 system 气泡但未设语义 variant 的事件路径？
2. **历史数据兼容风险**：`!variant + content` fallback（`Error:` 识别）是否还有误判窗口？是否存在更稳妥且低侵入的历史兼容策略？
3. **active/background 语义一致性**：两条链路在 parser 产物、落盘字段、UI 呈现上是否还有漂移点？
4. **thread 切换/后台恢复**：在 split-pane、room rejoin、late events 等场景里，是否还有 system message 样式错位可能？

---

### 五件套

**What**: 全量梳理并修复 background system message 的 variant 语义缺失，补齐 active/background error 显式标注，并增加 legacy 无 variant 的 UI fallback。  
**Why**: 当前缺失会把非错误事件渲染成红色，造成误导；只修单点会继续漏出同类场景。  
**Tradeoff**: 采用“最小侵入 + 向后兼容”（消息生产侧补 variant + 渲染侧兜底）而不是一次性数据迁移；迁移更彻底但成本和风险更高。  
**Open Questions**: `Error:` 文本前缀 fallback 是否需要升级为更结构化的历史判定（例如后续加 migration tag）？还有没有 backend 事件源会产出无 variant 的 system 消息？  
**Next Action**: 请你按上述 4 个重点做“全量漏网检查”，特别帮我挑出任何仍可能误红/误蓝的系统消息路径。
