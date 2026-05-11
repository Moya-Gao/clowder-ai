---
feature_ids: [F195]
topics: [meeting-copilot, turn-taking, diarization, meeting-context, floating-window, push-advisory]
doc_kind: plan
created: 2026-05-11
---

# F195 Phase C: 会中主动增强 — Implementation Plan

**Feature:** F195 — `docs/features/F195-meeting-copilot-live-advisory.md`
**Goal:** 从 pull-based 升级到 push-based：猫主动提供实时辅助（插话时机、论点提醒），加 speaker identity、meeting context 隔离注入、浮动转写窗
**Acceptance Criteria:**
- [ ] AC-C1: Turn-taking 检测 → 主动推"现在可以插话"信号（频率限制，防 AUDHD 注意力过载）
- [ ] AC-C2: Speaker identity 映射（会前 enrollment → 实时归因，置信度 <0.6 降级为"有人说"）
- [ ] AC-C3: 会议中主动推论点提醒（检测到高价值插话点时）
- [ ] AC-C4a: MeetingSession 绑定当前 thread，明确"会议上下文跟哪个 thread 走"
- [ ] AC-C4b: 转写上下文 rolling window + event summary + 显式拉取（不做原文堆积）
- [ ] AC-C4c: MeetingContextBlock 隔离不可信输入（带 provenance/speaker confidence/timestamp）
- [ ] AC-C5: 浮动转写窗（可拖拽/缩放/最小化，不抢聊天输入焦点）
- [ ] AC-C6: Speaker label 手动修正
**Architecture cell:** transport (extending existing audio/meeting scope)
**Map delta:** none
**Map delta why:** Phase C 扩展 Phase B 的音频管线 + 前端面板，不改变 transport cell 边界。MeetingSession 绑定 thread 是 thread-navigation cell 的消费者，不是 owner
**Architecture:** MeetingSession 作为 thread 元数据，AudioSession 扩展 speaker tracking + turn-taking 信号。MeetingContextBlock 在 invocation context assembly 时注入，标记 provenance=transcript + untrusted。浮动窗用 React Portal 脱离 workspace 布局
**Tech Stack:** pyannote.audio (diarization), Pipecat Smart Turn (turn-taking candidate), React Portal + react-rnd (floating window), existing Qwen3-ASR + Python audio-service
**前端验证:** Yes — 浮动转写窗 + speaker label UI 必须实测

---

## Scope Assessment

Phase C 是 ⭐⭐⭐⭐⭐ 难度，8 ACs 跨 4 领域。建议拆为 **2 个 spike + 2 个 PR**：

| 批次 | 内容 | ACs | 依赖 |
|------|------|-----|------|
| **Spike 2** | Turn-taking 方案评估（Pipecat Smart Turn） | 为 AC-C1 | 无 |
| **Spike 3** | pyannote diarization 评估（M4 Max 实时性） | 为 AC-C2 | 无 |
| **PR 1: C-foundation** | Context 架构 + 浮动窗 | AC-C4a/b/c + AC-C5 | 无 |
| **PR 2: C-intelligence** | Speaker identity + push advisory + label editing | AC-C1/C2/C3/C6 | Spike 2/3 + PR 1 |

Spike 2/3 可与 PR 1 并行。PR 2 依赖 spike 结论 + PR 1 合入。

**价值 OQ — 需铲屎官确认**：
Phase C 要拆成 2 PR 还是 1 个大 PR？建议拆——PR 1 (context + UI) 独立可用，能在 spike 跑完前先合入。

---

## Spike 2: Turn-Taking Detection 方案评估

**Time box:** 2 小时
**Output:** 技术结论 + benchmark 数字
**What we're NOT building:** 生产代码，只要结论

**评估项：**
1. Pipecat Smart Turn 能否在 M4 Max 上实时运行（<100ms per frame）？
2. 与现有 3s chunk ASR 管线如何集成（VAD 在 chunk 前还是 chunk 后）？
3. Turn boundary 精度：能否区分"自然停顿"vs"真正的话轮切换"？
4. 备选方案：纯 VAD (webrtcvad/silero) + silence threshold 够不够用？

**判断标准：**
- Smart Turn 延迟 <100ms + 准确率 >80% → 采用
- 延迟高或准确率低 → 降级为 silero-VAD + 3s silence = turn change
- 两者都不行 → AC-C1 降级为纯手动触发（铲屎官说"我想插话"）

---

## Spike 3: pyannote Diarization 评估

**Time box:** 2 小时
**Output:** 技术结论 + benchmark 数字
**What we're NOT building:** 生产代码，只要结论

**评估项：**
1. pyannote 3.1 在 M4 Max 上能否做实时 diarization（RTF < 0.3）？
2. 与 3s chunk 管线集成方式（逐 chunk vs 滑窗 vs batch-then-assign）？
3. speaker embedding 提取 + enrollment 的可行路径？
4. 对中文音频 DER 如何？

**判断标准：**
- 实时 RTF <0.3 + DER <25% → 实时 diarization，AC-C2 全量做
- 实时不行但 batch 可以 → 实时只用 VAD change-point（快但粗糙），会后 batch diarization 补精确标注
- 都不行 → AC-C2 降级为纯手动标注（用户在 UI 上标"这是张三"）

---

## Task 1: MeetingSession 类型 + Thread 绑定 (AC-C4a)

**Files:**
- Create: `packages/shared/src/types/meeting.ts`
- Modify: `packages/mcp-server/src/tools/audio-tools.ts` — 扩展 start/stop 绑定 meeting session
- Modify: `packages/api/src/routes/audio-proxy.ts` — 透传 meeting session metadata
- Modify: `scripts/meeting-copilot/audio-service.py` — AudioSession 持有 meeting metadata
- Test: `packages/shared/src/types/__tests__/meeting.test.ts`

**Terminal schema:**

```typescript
// packages/shared/src/types/meeting.ts
export interface MeetingSession {
  meetingId: string;
  threadId: string;
  startedAt: number;
  participants: MeetingParticipant[];
  status: 'active' | 'paused' | 'ended';
}

export interface MeetingParticipant {
  id: string;
  name: string;
  role?: 'host' | 'participant';
  speakerEmbeddingId?: string;
}
```

**Step 1:** Write type definitions + validation tests
**Step 2:** Extend `audio_capture_start` MCP tool with optional `meetingId` + `threadId` params
**Step 3:** Extend Python `AudioSession` to track `meeting_id` + `thread_id`
**Step 4:** Add `/api/audio/meeting` endpoint for getting/setting meeting metadata
**Step 5:** Commit

---

## Task 2: Rolling Window + Event Summary (AC-C4b)

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py` — transcript windowing + summary generation
- Modify: `packages/mcp-server/src/tools/audio-tools.ts` — `audio_read_transcript` 增加 summary mode
- Test: integration test for windowing behavior

**Design:**

```
Transcript lifecycle:
  Raw chunks (last 5 min) → kept in full
  Older chunks → summarized into event records every 5 min
  Events: { timeRange, speakerSummary, topicSummary, keyQuotes[] }

MCP tool modes:
  audio_read_transcript(latest=20)          → raw lines (existing)
  audio_read_transcript(from=X, to=Y)      → raw lines in range (existing)
  audio_read_transcript(mode='summary')     → event summaries only (new)
  audio_read_transcript(mode='full')        → events + raw recent (new)
```

**Step 1:** Add `TranscriptWindow` class to audio-service.py with rolling buffer
**Step 2:** Add periodic summarization task (every 5 min, summarize oldest batch)
**Step 3:** Extend `audio_read_transcript` MCP tool schema with `mode` param
**Step 4:** Wire summary endpoint through API proxy
**Step 5:** Integration test: capture 10 min of audio, verify window behavior
**Step 6:** Commit

**技术 OQ:** Summarization 用什么模型？选项：
- A) 现有猫脑（调用 invocation）— 重量级，但质量好
- B) 本地 Qwen3-1.7B 做 extractive summary — 轻量，可能质量不够
- C) 简单 heuristic（每 5 分钟取前 3 行 + 末 3 行 + keyword extraction）— 最轻，MVP 够用

**推荐 C 起步**（可逆，回滚成本低），后续升级到 B。

---

## Task 3: MeetingContextBlock 隔离注入 (AC-C4c)

**Files:**
- Create: `packages/shared/src/types/meeting-context-block.ts`
- Modify: `packages/mcp-server/src/tools/audio-tools.ts` — 读取 transcript 时生成 MeetingContextBlock
- Test: `packages/shared/src/types/__tests__/meeting-context-block.test.ts`

**Terminal schema:**

```typescript
export interface MeetingContextBlock {
  type: 'meeting_context';
  meetingId: string;
  provenance: 'transcript' | 'user_note' | 'system_event';
  speakerId?: string;
  speakerLabel: string;
  speakerConfidence: number;
  timestamp: number;
  content: string;
}
```

**设计原则（来自 spec 安全边界）：**
- MeetingContextBlock 放在 invocation data 区，不进 system prompt
- 带 provenance 标记（transcript = 不可信外部输入）
- speakerConfidence <0.6 时 speakerLabel = "有人说"
- content 不能包含控制符 / injection-suspicious patterns（strip on ingestion）

**Step 1:** Write type + validation function（含 sanitize 逻辑）
**Step 2:** Test: confidence threshold → graceful degradation
**Step 3:** Test: content sanitization strips control chars
**Step 4:** Extend `audio_read_transcript` 返回值增加 MeetingContextBlock 格式选项
**Step 5:** Commit

---

## Task 4: 浮动转写窗 (AC-C5)

**Files:**
- Create: `packages/web/src/components/workspace/FloatingTranscriptWindow.tsx`
- Modify: `packages/web/src/components/ChatContainer.tsx` — Portal mount point
- Modify: `packages/web/src/stores/chat-store.ts` — floating window state
- Test: Playwright visual test

**设计：**
- React Portal 渲染到 `document.body`（脱离 workspace 布局）
- 用 `react-rnd`（Resize and Drag）做拖拽/缩放
- 最小化时折叠为状态条（显示监听状态 + 时长）
- 不抢聊天输入焦点（`tabIndex=-1` + 点击不 blur 输入框）
- 位置/尺寸 persist 到 localStorage

**State:**
```typescript
// chat-store.ts additions
floatingTranscript: {
  visible: boolean;
  minimized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
}
```

**Step 1:** Install `react-rnd` (or verify existing drag/resize lib)
**Step 2:** Create `FloatingTranscriptWindow` component — SSE + transcript rendering (extract from TranscriptPanel)
**Step 3:** Add Portal mount + store state
**Step 4:** Wire minimize/maximize/close actions
**Step 5:** Add focus guard (no chat input blur)
**Step 6:** Persist position/size to localStorage
**Step 7:** Playwright test: open → drag → resize → minimize → restore
**Step 8:** Commit

**交互切换逻辑：**
- Phase B 的 TranscriptPanel（右侧面板）保留作为默认
- 用户可切换到浮动窗模式（按钮在 TranscriptPanel header）
- 两种模式互斥：切换到浮动窗时关闭右侧面板，反之亦然

---

## Task 5: Speaker Identity Mapping (AC-C2) — 依赖 Spike 3

**Files:**
- Create: `scripts/meeting-copilot/diarization-service.py` (或扩展 audio-service.py)
- Modify: `scripts/meeting-copilot/audio-service.py` — diarization 集成
- Modify: `packages/shared/src/types/meeting.ts` — speaker types
- Create: `packages/mcp-server/src/tools/speaker-tools.ts` — enrollment MCP tools
- Test: integration test

**设计（取决于 Spike 3 结论）：**

**方案 A — 实时 diarization：**
- pyannote pipeline 在 audio-service.py 中 alongside ASR
- 每个 3s chunk 输出 speaker_id + confidence
- Enrollment: 会前猫要求铲屎官录 10s 样本 per participant → 提取 embedding → 保存

**方案 B — 降级方案：**
- 实时用 VAD change-point（speaker transition 检测，不识别 who）
- speaker_id = 自增 counter (SPEAKER_0, SPEAKER_1, ...)
- 会后 batch diarization 补精确标注
- 用户手动在 UI 标注 "SPEAKER_0 = 张三"

**新 MCP 工具（方案 A）：**
```
cat_cafe_speaker_enroll — 录制 enrollment 样本
cat_cafe_speaker_list — 列出已注册的 speaker
cat_cafe_speaker_identify — 手动触发 identification
```

**Step 1-2:** 取决于 Spike 3 结论，选方案 A 或 B
**Step 3:** 扩展 TranscriptLine 增加 speaker_id + speaker_label + speaker_confidence
**Step 4:** 扩展 SSE 事件增加 speaker 字段
**Step 5:** 前端 TranscriptPanel / FloatingTranscriptWindow 显示 speaker label
**Step 6:** Commit

---

## Task 6: Speaker Label 手动修正 (AC-C6) — 依赖 Task 5

**Files:**
- Modify: `packages/web/src/components/workspace/FloatingTranscriptWindow.tsx`
- Modify: `packages/web/src/components/workspace/TranscriptPanel.tsx`
- Modify: `scripts/meeting-copilot/audio-service.py` — speaker label update endpoint
- Modify: `packages/api/src/routes/audio-proxy.ts` — 透传

**Step 1:** Add `PUT /api/audio/speaker-label` endpoint (speakerId → new label)
**Step 2:** Frontend: 点击 speaker label → inline edit → save
**Step 3:** 修正后的 label 反映到后续所有 transcript lines (同 speaker_id)
**Step 4:** Commit

---

## Task 7: Turn-Taking Detection (AC-C1) — 依赖 Spike 2

**Files:**
- Modify: `scripts/meeting-copilot/audio-service.py` — turn-taking 检测逻辑
- Create: `packages/shared/src/types/turn-taking.ts` — 事件类型
- Modify: `packages/mcp-server/src/tools/audio-tools.ts` — turn-taking 状态查询
- Test: integration test

**Terminal schema:**

```typescript
export interface TurnChangeEvent {
  type: 'turn_change';
  fromSpeaker?: string;
  toSpeaker: string;
  ts: number;
  silenceDurationMs: number;
  confidence: number;
}

export interface InterventionWindow {
  type: 'intervention_window';
  ts: number;
  durationMs: number;
  reason: 'extended_silence' | 'topic_shift' | 'question_detected';
  confidence: number;
}
```

**设计（取决于 Spike 2 结论）：**

**方案 A — Pipecat Smart Turn：**
- Smart Turn 模型运行在 VAD 后，判断当前 silence 是否真正的 turn boundary
- 输出 turn_change event 到 SSE stream

**方案 B — VAD + silence threshold：**
- silero-VAD 检测 speech activity
- silence > 1.5s = potential turn change
- silence > 3s = definite turn change
- 简单但误报多（停顿 ≠ 话轮切换）

**Step 1:** 根据 Spike 2 结论选方案
**Step 2:** 实现 turn-change 检测 + SSE 事件发布
**Step 3:** 新 SSE 事件类型 `turn_change` + `intervention_window`
**Step 4:** Commit

---

## Task 8: 主动推送论点提醒 (AC-C3) — 依赖 Task 2 + Task 7

**Files:**
- Create: `cat-cafe-skills/refs/meeting-copilot-proactive.md` — proactive advisory skill ref
- Modify: existing `cat-cafe-skills/refs/meeting-copilot.md` — 加 proactive section

**设计：**

猫的 proactive push 不是代码层面的自动化——是 skill ref 告诉猫"看到这些信号时主动回复"：

1. **Trigger 信号**（来自 SSE stream / MCP status）：
   - `intervention_window` 事件（turn-taking 检测到插话机会）
   - 转写中出现 keyword match（与会前应对牌的关键词）
   - 长时间沉默（>30s 没人说话）

2. **频率限制**（防 AUDHD 注意力过载）：
   - 每 5 分钟最多 1 条主动推送
   - 铲屎官可说"别打扰我"暂停 15 分钟
   - 紧急级别（检测到铲屎官被直接提问）不受频率限制

3. **推送格式**：
   - 简短卡片（rich block）："现在可以插话 → [建议论点]"
   - 不打断铲屎官正在打字

**Step 1:** 更新 meeting-copilot.md skill ref 加 proactive advisory section
**Step 2:** 定义 trigger → action mapping
**Step 3:** 定义频率限制规则
**Step 4:** Commit

**注意：** AC-C3 的"主动推送"是猫在 invocation 中的行为策略，不是新代码模块。
Skill ref 告诉猫何时 + 如何主动发消息，猫用现有 `post_message` MCP 工具推送。
真正需要新代码的是 Task 7 的 turn-taking 信号生成。

---

## Open Questions

### 技术 OQ（实现过程中自行解决）

1. **react-rnd vs 自研拖拽**：先调研 react-rnd bundle size + API。如果太重，用 pointer events 自研（~100 行）
2. **Transcript summarization 模型**：MVP 用 heuristic（首尾行 + keyword），后续可升级
3. **Speaker embedding 存储位置**：本地 SQLite（evidence.sqlite 旁）vs 文件系统 JSON

### 价值 OQ（需铲屎官确认）

1. **Phase C 拆 PR？**
   - TL;DR: Phase C 8 ACs 跨 4 领域，建议拆成 2 PR（foundation + intelligence）
   - 回滚成本: 低（两个 PR 各自独立可测试）
   - 真正需要判断的问题: PR 1 (context + floating window) 可独立交付还是必须和 intelligence 一起？

---

## Execution Order

```
Spike 2 (turn-taking) ─────┐
                            ├→ Task 7 (turn-taking) → Task 8 (proactive)
Spike 3 (diarization) ─────┤
                            ├→ Task 5 (speaker identity) → Task 6 (label edit)
                            │
Task 1 (MeetingSession) ───→ Task 2 (rolling window) → Task 3 (MeetingContextBlock)
                            │
Task 4 (floating window) ──┘ (independent, can parallel with Tasks 1-3)
```

**Critical path:** Task 1 → Task 2 → Task 3 → Task 7 → Task 8
**Parallelizable:** Task 4 alongside Tasks 1-3; Spikes alongside Task 1-4

---

*[宪宪/Opus-46🐾]*
