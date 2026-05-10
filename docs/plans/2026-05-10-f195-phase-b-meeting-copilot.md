---
feature_ids: [F195]
topics: [meeting-copilot, live-audio, MCP, frontend, skill]
doc_kind: plan
created: 2026-05-10
---

# F195 Phase B: Meeting Copilot — 会中实时智囊 Implementation Plan

**Feature:** F195 — `docs/features/F195-meeting-copilot-live-advisory.md`
**Goal:** 铲屎官能在 Hub 中说"开始监听 XX"，猫启动音频采集+实时转写，浮动窗显示转写，猫能基于转写回答铲屎官的问题
**Type:** Feature implementation（Phase B 会中最小可用版）
**Deadline:** 2026-05-13（周二有会议）
**Architecture cell:** mcp-server + api + web (跨三层)
**Map delta:** none
**Map delta why:** 在现有 mcp-server/api/web 三个 package 内新增文件，不改 ownership 边界
**Tech Stack:** Python (audio service) + TypeScript (MCP/API/Frontend) + Swift (CaptureAppAudio, spike 复用)
**前端验证:** Yes — 浮动转写窗必须实测

---

## Finish Line

**B definition:** 铲屎官在 Hub 聊天中说"开始监听腾讯会议"→ 猫调用 MCP 工具启动音频采集 → 浮动转写窗实时显示转写文本 → 铲屎官问"他们在聊什么"→ 猫读转写回答 → 铲屎官说"停"→ 采集结束。

**Acceptance Criteria:**
- AC-1: 猫能通过 MCP 工具启动/停止音频采集（支持 App 名 + 麦克风两种模式）
- AC-2: 转写文本在 Hub 浮动窗内 ≤5s 延迟实时显示
- AC-3: 猫能读取指定时间区间的转写文本
- AC-4: 浮动转写窗可拖拽位置、可缩放大小、可最小化、显示监听状态
- AC-5: Skill ref 教猫完整流程（启动→响应问题→停止）

**What we're NOT building:**
- 不做 speaker diarization（双路天然分离就够）
- 不做 turn-taking / 主动推送
- 不做 overlap 去重（后续优化）
- 不做 meeting context injection 到 system prompt
- 不做 consent/privacy UI（铲屎官说"不允许就不用"）
- 不做会前/会后（Phase A 后补）

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  Hub Frontend (packages/web)                           │
│  ┌──────────────────┐  ┌───────────────────────────┐   │
│  │ Chat (existing)  │  │ TranscriptPanel (new)     │   │
│  │ 铲屎官说"监听XX" │  │ 浮动转写窗 + 状态 + 控制  │   │
│  └────────┬─────────┘  └────────────┬──────────────┘   │
│           │                         │ SSE /api/audio   │
│  ─────────┼─────────────────────────┼──────────────── │
│  API Server (packages/api)          │                  │
│  ┌────────┴─────────┐  ┌───────────┴──────────────┐   │
│  │ MCP callback     │  │ /api/audio/* proxy       │   │
│  │ (audio tools)    │  │ → localhost:9877         │   │
│  └────────┬─────────┘  └───────────┬──────────────┘   │
│           │                         │                  │
│  ─────────┼─────────────────────────┼──────────────── │
│  MCP Server (packages/mcp-server)   │                  │
│  ┌────────┴─────────┐               │                  │
│  │ audio-tools.ts   │───────────────┘                  │
│  │ audio_capture_*  │  HTTP localhost:9877              │
│  └──────────────────┘                                  │
│                                                        │
│  ──────────────────────────────────────────────────── │
│  Audio Service (scripts/meeting-copilot/audio-service) │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Python HTTP :9877                                │  │
│  │ ├─ POST /start  {source, app_name?}              │  │
│  │ ├─ POST /stop                                    │  │
│  │ ├─ GET  /status                                  │  │
│  │ ├─ GET  /transcript?from=&to=&latest=            │  │
│  │ └─ GET  /events  (SSE stream)                    │  │
│  │                                                  │  │
│  │ Subprocess: CaptureAppAudio stream | ASR pipeline│  │
│  │ Subprocess: sounddevice mic → ASR pipeline       │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

## Task 1: Audio Capture Service (Python)

独立 Python HTTP 服务，管理音频采集进程 + ASR 转写。

**Files:**
- Create: `scripts/meeting-copilot/audio-service.py`

**API:**
```
POST /start     {source: "app"|"mic", app_name?: string}
POST /stop
GET  /status    → {running, source, app_name, duration_s, chunk_count, started_at}
GET  /transcript?from=0&to=999&latest=10  → {lines: [{ts, chunk_num, latency, text}]}
GET  /events    SSE stream → data: {type: "transcript", ...} | {type: "status", ...}
```

**Step 1:** Create audio service with start/stop/status (no ASR yet)
- HTTP server on port 9877
- Start spawns CaptureAppAudio or sounddevice mic capture subprocess
- Stop kills subprocess
- Status returns running state

**Step 2:** Add ASR pipeline to audio service
- Read PCM chunks from capture subprocess
- Convert to WAV, send to ASR (localhost:9876)
- Store transcript lines in memory (list of dicts)

**Step 3:** Add /transcript endpoint
- Return lines filtered by time range or latest N
- Each line: {ts, elapsed_s, chunk_num, asr_latency, text}

**Step 4:** Add SSE /events endpoint
- Stream new transcript lines as SSE events
- Stream status changes (started/stopped)

**Step 5:** Test manually — start capturing Chrome audio, verify transcript output

## Task 2: MCP Tools (TypeScript)

**Files:**
- Create: `packages/mcp-server/src/tools/audio-tools.ts`
- Modify: `packages/mcp-server/src/server-toolsets.ts` — register audio toolset

**Tools:**

| Tool | Input | Output |
|------|-------|--------|
| `cat_cafe_audio_list_sources` | none | Available app names |
| `cat_cafe_audio_capture_start` | {source, app_name?} | Success/error |
| `cat_cafe_audio_capture_stop` | none | Summary |
| `cat_cafe_audio_capture_status` | none | Current state |
| `cat_cafe_audio_read_transcript` | {from?, to?, latest?} | Transcript lines |

**Step 1:** Write audio-tools.ts with tool schemas and handlers (HTTP calls to localhost:9877)

**Step 2:** Register in server-toolsets.ts — add `registerAudioToolset()`

**Step 3:** Verify tools appear in MCP tool list

## Task 3: API Audio Proxy (TypeScript)

**Files:**
- Create: `packages/api/src/routes/audio-proxy-routes.ts`
- Modify: `packages/api/src/routes/index.ts` — mount audio routes

Frontend 不能直连 localhost:9877（CORS），通过 API 代理。

**Step 1:** Create proxy routes — /api/audio/status, /api/audio/transcript, /api/audio/events(SSE), /api/audio/start, /api/audio/stop

**Step 2:** Mount in routes index

**Step 3:** Test from browser — fetch /api/audio/status

## Task 4: Frontend Transcript Panel (React)

**Files:**
- Create: `packages/web/src/components/workspace/TranscriptPanel.tsx`
- Modify: `packages/web/src/stores/chatStore.ts` — add 'transcript' to rightPanelMode
- Modify: `packages/web/src/components/ChatContainer.tsx` — render TranscriptPanel

**设计要求**（铲屎官："最小版本也是真的可用且好看的"）：

```
┌─────────────────────────────────────┐
│ 🎙 正在监听：腾讯会议  00:05:32  ⏸ ✕ │
├─────────────────────────────────────┤
│                                     │
│ [09:15:02] 问题想咨询一下宾客。       │
│ [09:15:05] 对，嗯，我现在呢是。       │
│ [09:15:08] 是一个北京的语言大学。     │
│ [09:15:11] 的研究生，我现在演艺，     │
│            我是。                    │
│ [09:15:14] ▌                        │  ← 最新行 auto-scroll
│                                     │
├─────────────────────────────────────┤
│ 4 chunks · avg 0.13s · 16kHz mono   │
└─────────────────────────────────────┘
```

**Step 1:** Extend chatStore — add 'transcript' to rightPanelMode union

**Step 2:** Create TranscriptPanel component
- Header: 监听状态（App 名 + 时长 + 暂停/关闭按钮）
- Body: 转写文本列表，时间戳 + 文本，auto-scroll to bottom
- Footer: 统计信息（chunk 数、平均延迟）
- 使用 SSE 连接 /api/audio/events 获取实时更新
- 样式跟随 workspace 现有设计语言（cocreator-* / cafe-* classes）

**Step 3:** Update ChatContainer — conditional render TranscriptPanel

**Step 4:** Add workspace navigation trigger
- 当 audio_capture_start 被调用时，API 发 workspace navigate event 打开 transcript panel
- 或者通过 MCP post_message 触发前端打开

**Step 5:** 实测 — 启动采集，观察浮动窗实时滚动转写

## Task 5: Skill Refs

**Files:**
- Create: `cat-cafe-skills/refs/live-audio.md`
- Create: `cat-cafe-skills/refs/meeting-copilot.md`

**Step 1:** Write live-audio.md — 底层能力 skill，教猫使用 audio_* MCP 工具

**Step 2:** Write meeting-copilot.md — 会议场景 skill ref，引用 live-audio，加会议特有逻辑

**Step 3:** `pnpm sync:skills` 同步 symlinks

## Implementation Order

```
Task 1 (audio service)  ──→  Task 2 (MCP tools)  ──→  Task 5 (skills)
                         └──→  Task 3 (API proxy)  ──→  Task 4 (frontend)
```

Task 1 是一切基础。Task 2+3 可并行。Task 4 依赖 Task 3。Task 5 可最后写。

## Risks

| 风险 | 缓解 |
|------|------|
| ASR 服务（:9876）未运行 | audio service 启动时检查，未运行则返回清晰错误 |
| CaptureAppAudio 权限问题 | .app bundle 方案已验证，spike 1 的 bundle 直接复用 |
| 前端 SSE 断连 | 自动重连 + fallback 到轮询 |
| 周二来不及做前端 | 降级方案：猫直接读转写文件，无浮动窗也能 work |

---

*[宪宪/Opus-46🐾]*
