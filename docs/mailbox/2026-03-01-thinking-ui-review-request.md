---
feature_ids: []
debt_ids: []
topics: [web, ux, review]
doc_kind: mailbox
created: 2026-03-01
---

## Review 请求: Thinking 默认折叠 + 一键到达底部

### 背景

铲屎官反馈 Web 聊天界面两点疲劳：
1) Thinking/CLI stream 输出太长，默认展开导致滚动负担。
2) thread 切换/阅读历史后，缺少明确“一键到达对话底部”的入口。

### 铲屎官原始需求（🔴 必填）

- Discussion/Interview: `docs/discussions/2026-03-01-ux-thinking-collapse-scroll-bottom/README.md`
- 原始需求摘录（≤5 行）：
  > “thinking需要默认折叠… thinking只有必要的时候…进行问题定位才需要。”  
  > “thread 切换…提供一键到达对话底部的按钮…每次翻的我好累”
- 核心痛点：减少滚动疲劳；需要时再快速展开/回到底部。
- 关键澄清：
  - **Thinking 默认折叠**：全局默认 + 记住全局偏好
  - **心里话气泡（thinkingMode）**：按 thread 记忆（语义：跨猫可见性），不应驱动 UI 折叠/展开

### 设计文档

- Plan: `docs/plans/2026-03-01-thinking-collapse-and-scroll-bottom.md`

### Spec Compliance 自检

#### 愿景覆盖度（Step 0）

| # | 铲屎官原始需求 | 实现覆盖？ | 说明 |
|---|---------------|-----------|------|
| 1 | Thinking 默认折叠 | ✅ | 默认折叠由全局 UI 偏好控制 |
| 2 | 一键展开（需要时） | ✅ | 右侧面板新增“Thinking 默认展开/折叠”全局开关；每条消息仍可单独展开 |
| 3 | 心里话气泡按 thread 记忆 | ✅ | 保留 thread `thinkingMode`（RightStatusPanel 仍是 thread 级切换 + PATCH 持久化） |
| 4 | 一键到对话底部 | ✅ | 不在底部时显示“↓ 到最新”浮动按钮 |

#### 功能验收

| # | Spec 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|-----------|------|----------|----------|
| 1 | Thinking 默认折叠 | ✅ | `packages/web/src/stores/chatStore.ts` + `packages/web/src/components/ChatMessage.tsx` | `packages/web/src/components/__tests__/thinking-content-mode.test.ts` |
| 2 | 全局偏好持久化 | ✅ | `packages/web/src/stores/chatStore.ts`（localStorage） | `packages/web/src/components/__tests__/thinking-mode-toggle.test.ts` |
| 3 | thinkingMode 不再驱动折叠 | ✅ | `packages/web/src/components/ChatContainer.tsx` / `packages/web/src/components/ChatMessage.tsx` | 同上 |
| 4 | 到对话底部按钮 | ✅ | `packages/web/src/components/ScrollToBottomButton.tsx` + `packages/web/src/components/ChatContainer.tsx` | `packages/web/src/components/__tests__/scroll-to-bottom-button.test.ts` |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/web/src/stores/chatStore.ts` | 修改 | 新增全局 UI 偏好 `uiThinkingExpandedByDefault`（localStorage） |
| `packages/web/src/components/ChatMessage.tsx` | 修改 | Thinking 默认展开逻辑改为读取全局偏好 |
| `packages/web/src/components/RightStatusPanel.tsx` | 修改 | 增加全局开关 + 修复 hooks 规则违规（build blocker） |
| `packages/web/src/components/ScrollToBottomButton.tsx` | 新增 | 浮动“↓ 到最新”按钮 |
| `packages/web/src/components/ChatContainer.tsx` | 修改 | 接入 `ScrollToBottomButton` |
| `packages/web/src/components/__tests__/thinking-content-mode.test.ts` | 修改 | 更新断言：默认折叠 + 全局开关 |
| `packages/web/src/components/__tests__/thinking-mode-toggle.test.ts` | 修改 | 更新断言：全局开关可驱动已渲染块展开/折叠 |
| `packages/web/src/components/__tests__/scroll-to-bottom-button.test.ts` | 新增 | scroll-to-bottom 行为测试 |
| `docs/plans/2026-03-01-thinking-collapse-and-scroll-bottom.md` | 新增 | 实现 plan |
| `docs/discussions/2026-03-01-ux-thinking-collapse-scroll-bottom/README.md` | 新增 | 需求摘录 + 澄清落盘 |

### Git SHA

- Base: `3019a44d`
- Head: `e70a78a2`

### 测试状态

```
pnpm --filter @cat-cafe/web test: 562 passed, 0 failed
pnpm --filter @cat-cafe/web build: success (ESLint warnings only)
```

### Review 重点

1) `thinkingMode` 语义是否保持为“跨猫可见性”，并且 UI 折叠逻辑彻底与之解耦？  
2) 全局偏好 localStorage 读写是否安全（SSR/隐私模式）？  
3) Scroll-to-bottom 按钮位置/出现逻辑是否符合预期（不遮挡 MessageNavigator）？

### 五件套

**What**: Thinking 默认折叠改为全局 UI 偏好 + 增加“↓ 到最新”按钮  
**Why**: 降低滚动疲劳，提升 thread 切换与调试效率  
**Tradeoff**: 未做 per-thread 的展开记忆（保持简单，避免状态膨胀）  
**Open Questions**: 是否需要把“全局偏好”提升为后端用户设置（跨设备同步）？  
**Next Action**: 请 @opus review 上述改动与测试
