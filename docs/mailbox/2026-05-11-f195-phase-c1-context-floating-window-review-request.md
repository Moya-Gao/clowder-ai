---
doc_kind: review-request
created: 2026-05-11
feature_ids: [F195]
---

# Review Request: F195 Phase C1 — Context Architecture + Floating Transcript Window

Review-Target-ID: f195-phase-c1
Branch: feat/f195-phase-c1-context-floating-window

## What

Phase C 基础架构（PR 1/2）：MeetingSession 类型 + rolling transcript window + MeetingContextBlock 隔离注入 + 浮动转写窗。

4 commits covering 4 ACs:
- AC-C4a: `MeetingSession` 类型 + thread 绑定（`packages/shared/src/types/meeting.ts`）
- AC-C4b: `TranscriptWindow` rolling buffer + heuristic summary（`scripts/meeting-copilot/transcript_window.py`）
- AC-C4c: `MeetingContextBlock` 不可信输入隔离（`packages/shared/src/types/meeting-context-block.ts`）
- AC-C5: 浮动转写窗 drag/resize/minimize（`packages/web/.../FloatingTranscriptWindow.tsx`）

## Why

Phase B 交付了 pull-based 转写面板。Phase C 升级为 push-based 主动增强。PR 1 打地基——类型系统 + 上下文管理 + 浮动 UI，为 PR 2 (speaker identity + turn-taking + push advisory) 做准备。

## Original Requirements（必填）

> "实时转写这个能是一个浮动框那种吗？好像这种比较方便 我可以拖拉拽到我想要的地方 甚至放大 缩小我到底想看的多少。"
> "你们能够快速知道我们正在讨论什么"

- 来源：`docs/features/F195-meeting-copilot-live-advisory.md` Vision > UI 方向
- 安全约束：spec > 安全边界 > "Meeting Context 必须当不可信输入（P1）"
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- TranscriptWindow summarization 用 heuristic（前 3 行 + 末 3 行）而非 LLM，MVP 够用且回滚成本低
- 浮动窗用 `react-rnd` 而非自研 drag/resize — 成熟库，避免造轮子
- FloatingTranscriptWindow 和 TranscriptPanel 互斥（切换时关闭另一个），复杂度可控

## Architecture Ownership（必填）

Architecture cell: transport (extending existing audio/meeting scope)
Map delta: none
Why: Phase C 扩展 Phase B 的音频管线 + 前端面板，不改变 transport cell 边界。MeetingSession 绑定 thread 是 thread-navigation cell 的消费者，不是 owner

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. `MeetingContextBlock.sanitizeContent()` strip 策略是否足够（控制符 + `<|...|>` token markers）？是否需要额外的 injection pattern detection？
2. `TranscriptWindow._build_summary()` heuristic（前 3 + 末 3 行）是否足够？后续升级到 Qwen3-1.7B extractive summary 是否需要在类型层面预留？
3. 浮动窗 `tabIndex=-1` 是否在所有浏览器（Chrome/Safari/Firefox）上都阻止焦点偷取？

### 价值 OQ（给 CVO，如有）

无。所有选择回滚成本低，猫猫自决。

## Next Action

请 review 代码质量 + 安全边界（特别是 MeetingContextBlock 隔离策略）+ 前端浮动窗交互。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f195-phase-c1/codex`
- Start Command: `pnpm review:start`
- Ports: 由 review:start 自动分配（起点 3201/3202），禁止 3001/3002/3011/3012/4111

## 自检证据

### Spec 合规

quality-gate 已通过（本轮 2026-05-11 21:10），4 ACs 逐项验证。

### 测试结果

```
pnpm test                → 2965 vitest passed + 5 node:test passed, 0 failed
tsc --noEmit (shared)    → 0 errors
tsc --noEmit (mcp-server)→ 0 errors
tsc --noEmit (api)       → 0 errors
tsc --noEmit (web)       → 0 new errors (1 pre-existing Next.js layout type)
pnpm -r --if-present run build → exit 0
python3 unittest         → 7/7 passed
```

### 根目录工件闸门

```
git status --short | rg media-pattern → 无匹配
git diff origin/main...HEAD | rg media-pattern → 无匹配
```

### 相关文档

- Feature: `docs/features/F195-meeting-copilot-live-advisory.md`
- Plan: `docs/plans/2026-05-11-f195-phase-c-meeting-copilot-active-augmentation.md`

### 如果判断错了我最可能错在哪

1. `sanitizeContent` 可能漏掉某些 prompt injection pattern（只 strip 了控制符和 token markers，Unicode tricks 可能绕过）
2. `TranscriptWindow` 在 Python 端做 heuristic summary，但 MCP tool 端的 `formatSummaries` 的格式可能跟前端预期不一致（前端目前只直接显示 raw lines，没消费 summary mode）
3. 浮动窗和右侧面板的互斥切换没有 transition animation，可能让铲屎官觉得突兀
4. `react-rnd` 的 `bounds="window"` 在多显示器场景下可能让窗口拖到不可见区域
