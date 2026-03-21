---
feature_ids: [F131]
related_features: [F063, F120, F130]
topics: [hub, workspace, navigation, ux]
doc_kind: spec
created: 2026-03-21
---

# F131: Workspace Navigator — 猫猫可编程导航 Workspace 面板

> **Status**: spec | **Owner**: 金渐层 | **Priority**: P2

## Why

铲屎官 2026-03-20 语音指示（逐字）：

> "你最好也有自己的 skills，能够让猫猫。我跟猫猫说，现在我们一起来看一下审，看一下日志。你能帮我去把右边的 workspace 面板打开？当然，这个不只是日志哦，就有点有点多了。可能是你，我们一起看一下怎么样的文档，你也能一起帮我把文档直接打开，就不要我一个个去点。"

> "跟浏览器的 Preview 一样。更通用的是，我用语音或者用文字告诉你，你帮我一起打开这个 workspace 的哪个地方？你要能帮我打开。"

核心痛点：铲屎官让猫猫一起看某个文件/目录时，只能靠自己在 Workspace Explorer 里手动点击层层目录。猫猫有 `setWorkspaceOpenFile` / `revealInTree` 等 API，但没有对外暴露的 HTTP 端点供猫猫调用。browser-preview 的 `auto-open` 已证明这种模式可行且体验好。

## What

### Phase A: Workspace Auto-Navigate API + Skill

**参照 F120 browser-preview 的 `auto-open` 模式**：

1. **后端 API**：`POST /api/workspace/navigate`
   ```json
   {
     "path": "packages/api/data/logs/api/",
     "worktreeId": "cat-cafe-runtime",   // 可选，默认当前 worktree
     "action": "reveal"                  // reveal（展开到目录/文件）| open（直接打开文件）
   }
   ```
   - 通过 Socket.IO 发送 `workspace:navigate` 事件到 Hub 前端
   - 前端收到后：切换右面板到 workspace 模式 → 切换 worktree → revealInTree / setWorkspaceOpenFile

2. **前端 Socket 监听**：在 ChatContainer（全局挂载）添加 `workspace:navigate` 事件监听
   - 类似 `usePreviewAutoOpen` 的模式
   - 自动打开右面板（如果关着）→ 切到 workspace 模式 → 执行导航

3. **Skill 文档**：`cat-cafe-skills/workspace-navigator/SKILL.md`
   - 触发词：「看看代码」「打开文件」「看日志」「帮我打开」「一起看看」
   - 调用步骤：curl POST /api/workspace/navigate
   - 和 browser-preview 的区别说清楚

### Phase B: 智能路径解析（可选后续）

猫猫不需要精确路径，可以模糊匹配：
- "打开日志" → 自动解析为 `packages/api/data/logs/api/`
- "看看 chatStore" → 搜索 `chatStore.ts` 并打开
- 复用 Workspace Explorer 的搜索能力

## Acceptance Criteria

### Phase A（API + Skill）
- [ ] AC-A1: 猫猫调用 `POST /api/workspace/navigate` 后，Hub 右面板自动打开 workspace 模式并导航到指定路径
- [ ] AC-A2: 支持 `reveal`（展开目录树到指定节点）和 `open`（打开文件内容）两种 action
- [ ] AC-A3: 支持指定 worktreeId 跨 worktree 导航（如从 main 导航到 runtime 的日志目录）
- [ ] AC-A4: 面板关闭时收到事件能自动打开（参考 usePreviewAutoOpen 的 pending 机制）
- [ ] AC-A5: Skill 文档 `workspace-navigator/SKILL.md` 创建完成，含触发词、调用步骤、与 browser-preview 区分
- [ ] AC-A6: 铲屎官说"帮我打开日志"，猫猫能执行 → Hub 右面板自动展示日志目录

### Phase B（智能路径解析）
- [ ] AC-B1: 猫猫无需精确路径，可用模糊关键词（如"日志""chatStore"）导航到正确位置

## Dependencies

- **Evolved from**: F063（Workspace Explorer 提供了文件树和文件查看基础设施）
- **Related**: F120（Browser Preview 的 `auto-open` 模式是本 Feature 的设计模板）
- **Related**: F130（日志治理 — 日志一键跳转按钮是 F130 Polish，但通用导航能力独立为本 Feature）

## Risk

| 风险 | 缓解 |
|------|------|
| Socket 事件在面板关闭时丢失 | 复用 F120 的 pending 机制：存 store → 面板打开时消费 |
| worktreeId 不匹配导致导航失败 | API 层校验 worktreeId 存在性，不存在返回 404 + 提示 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Phase B 的模糊匹配是否需要调用 LLM 做意图解析，还是简单关键词匹配就够？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 参照 F120 browser-preview 的 auto-open 模式（HTTP API + Socket 事件 + 前端监听） | 铲屎官明确说"跟浏览器的 Preview 一样"，已验证模式可行 | 2026-03-21 |
| KD-2 | 日志一键跳转按钮作为 F130 Polish 独立实现，不依赖 F131 | 按钮是 UI 入口，F131 是猫猫编程式能力，解耦更灵活 | 2026-03-21 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-21 | 立项 |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F063-hub-workspace-explorer.md` | Workspace Explorer 基础设施 |
| **Feature** | `docs/features/F120-hub-embedded-browser.md` | Browser Preview — auto-open 模式参考 |
| **Feature** | `docs/features/F130-api-log-governance.md` | 日志治理 — 日志按钮是 Polish |
| **Skill** | `cat-cafe-skills/browser-preview/SKILL.md` | browser-preview skill — 设计模板 |
