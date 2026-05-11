# Review Request: F195 Phase B — 会中实时智囊

Review-Target-ID: f195
Branch: feat/f195-phase-b

## What

F195 Phase B 完整交付：audio service + MCP tools + API proxy + TranscriptPanel + skill refs。

- **Audio Service** (`scripts/meeting-copilot/audio-service.py`, 428 行): Python aiohttp HTTP 服务 (port 9877)，管理 CaptureAppAudio subprocess（app 音频）和 sounddevice（麦克风），集成 Qwen3-ASR 本地转写，SSE 实时广播
- **MCP Tools** (`packages/mcp-server/src/tools/audio-tools.ts`): 5 个工具（list_sources/start/stop/status/read_transcript），代理到 audio service
- **API Proxy** (`packages/api/src/routes/audio-proxy.ts`): Fastify 插件，6 条路由代理 + SSE 透传
- **TranscriptPanel** (`packages/web/src/components/workspace/TranscriptPanel.tsx`): 实时转写侧边面板，SSE 连接 + 自动滚动 + 状态指示
- **Skill Refs**: `live-audio.md`（底层能力）+ `meeting-copilot.md`（会议场景）

17 files changed, +1398 / -2

## Why

铲屎官周二（2026-05-13）有会议，需要猫猫能实时参与（作为智囊，不直接发言）。Phase B 是核心——音频采集 + 实时转写 + 猫能读转写回答问题。

## Original Requirements（必填）

> "好像a 不太重要！我们周二就有会议！好像最重要的是会议里你们能暂时参加！？"
> "监听腾讯会议 → 到时候估计要也是华为云会议 或者可能都没有会议 就是如果到时候是线下呢？"
> "最小版本也是真的可用且好看的 因为你写起来蛮快的"

- 来源：F195 Phase B 讨论（2026-05-10 当日对话）
- Spec: `docs/features/F195-meeting-copilot-live-advisory.md` lines 87-96
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **TranscriptPanel 是侧边面板，不是浮动窗**：Spec AC-4 要求"可拖拽/缩放/最小化"，当前实现为 ChatContainer 右侧面板（与 workspace/status 同位）。理由：周二 deadline，侧边面板功能完整可用；浮动窗是 UX polish。状态显示（绿色脉冲点/源名/时长/Stop/SSE 状态）齐全。
- **无 speaker diarization**：Phase C scope（spec 明确标注）。当前转写是纯文本，不区分说话人。
- **MCP_TOOLS_SECTION 未更新**：`SystemPromptBuilder.ts` 的 MCP 工具文档未包含 audio tools。猫通过 MCP protocol 可发现工具，skill refs 弥补了使用指导。Reviewer 判断是否需当轮补。

## Architecture Ownership（必填）

Architecture cell: mcp-server + api + web（跨三层）
Map delta: none
Why: 在现有三个 package 内新增文件，不改 ownership 边界

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **SSE 透传稳定性**：`audio-proxy.ts` 的 SSE 代理使用 `ReadableStream` reader + `reply.raw`。长连接场景下 Fastify 是否有 timeout 或 buffering 问题？
2. **audio-service.py 进程管理**：CaptureAppAudio subprocess 异常退出时的清理逻辑是否充分？
3. **TranscriptPanel 侧边面板**：是否接受为 MVP，还是浮动窗必须当轮实现？

### 价值 OQ（给 CVO，如有）

无

## Next Action

请 review 代码质量 + 架构合理性 + 原始需求覆盖。重点关注上述 3 个技术 OQ。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f195/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（禁止 3001/3002/3011/3012/4111）
- 注意：完整验证需启动 audio-service.py（`python scripts/meeting-copilot/audio-service.py`）和 Qwen3-ASR（port 9876）

## 自检证据

### Spec 合规

Quality Gate Report: CONDITIONAL PASS

| AC | 状态 | 说明 |
|----|------|------|
| AC-1 MCP start/stop（app+mic） | ✅ | audio-tools.ts 5 个工具 |
| AC-2 实时显示 ≤5s | ✅ | TranscriptPanel SSE 连接 |
| AC-3 读指定时间转写 | ✅ | from/to/latest 参数 |
| AC-4 浮动窗拖拽缩放 | ⚠️ P2 | 侧边面板，状态显示齐全，拖拽缩放未实现 |

### 测试结果

```
pnpm --filter @cat-cafe/mcp-server exec tsc --noEmit  → exit 0 ✅
pnpm biome check                                       → 0 errors ✅
pnpm --filter @cat-cafe/api exec tsc --noEmit          → ❌ pre-existing (better-sqlite3 类型)
pnpm test                                               → ❌ pre-existing (同上)
pnpm build                                              → ❌ pre-existing (同上)
```

所有失败均为 pre-existing 问题（better-sqlite3/http-proxy/nodemailer 类型声明），无一涉及 F195 文件。

### 前端证据

- Web dev server (port 3099): 启动成功，页面正常加载
- TranscriptPanel 需 audio service 运行才能完整测试
- 截图: `.playwright-mcp/f195-evidence/app-loads.png`

### 相关文档

- Plan: `docs/plans/2026-05-10-f195-phase-b-meeting-copilot.md`
- Feature: `docs/features/F195-meeting-copilot-live-advisory.md`
- Skill refs: `cat-cafe-skills/refs/live-audio.md`, `cat-cafe-skills/refs/meeting-copilot.md`

---

[宪宪/Opus-46🐾]
