# Review Request: F195 Phase E — UI capture control + pause/resume

Review-Target-ID: f195
Branch: feat/f195-phase-e-capture-control

## What

8 files, 457 lines added. Full-stack implementation of user-initiated audio capture control:

1. **Python audio-service** (`audio-service.py`): `POST /pause`, `POST /resume` endpoints; paused state skips ASR but continues PCM recording; SSE broadcasts `paused`/`resumed` status events
2. **API proxy** (`audio-proxy.ts`): 2 new proxy routes `/api/audio/pause` and `/api/audio/resume`
3. **Frontend** (`FloatingTranscriptWindow.tsx`, `FloatingTranscriptContainer.tsx`, `TranscriptPanel.tsx`): Source selector dropdown (apps + mics), Start button, Pause/Resume buttons, three-state indicator (green pulse / amber / grey), timer pauses when paused, SSE event handling for `paused`/`resumed`
4. **Tests** (`FloatingTranscriptWindow.test.tsx`): 4 new tests (18 total), all pass

## Why

铲屎官要求：开会时能选择录哪个软件的声音（不只是猫猫启动）、茶歇时暂停而不是 stop 再 start。

## Original Requirements（必填）

> "允许我选择录制哪个软件的声音？也就是你们可以选择开始我也可以？以及甚至给我一个暂停按钮？比如我们开会茶歇的时候 与其 stop然后启动不如暂停可能更好？"

- 来源：铲屎官 2026-05-14 04:39 对话消息
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Pause 语义选择：暂停时 PCM 继续录制（保证 MP3 文件时间连续），只跳过 ASR 处理。替代方案是完全停止录音再恢复，但会导致录音文件中有时间跳跃，且恢复时需要重新初始化音频设备。
- Source selector 复用已有 `/api/audio/sources` 端点，没有新建 API。

## Architecture Ownership（必填）

Architecture cell: audio-pipeline
Map delta: none
Why: 只扩展现有 audio-service HTTP 接口 + 前端 UI，不改变 audio-pipeline cell 边界

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **Pause 竞态**：`_process_chunk` 里 `if self.paused: return` 在 `append_pcm` 之后——意味着 PCM 数据已写入但 ASR 跳过。这是有意的（保证录音连续性），但请确认这个语义是否正确。
2. **Source selector 的 `split(':')` 解析**：`selectedSource` 格式是 `app:{name}` 或 `mic:{index}`，用 `split(':')` 分割。如果 app 名称含冒号会出问题——当前实际数据中未见此 case，但请确认是否需要更健壮的解析。

### 价值 OQ（给 CVO，如有）

无

## Next Action

请 review 代码正确性，特别关注 pause/resume 的状态一致性和 SSE 事件流。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f195/codex`
- Start Command: `pnpm review:start`
- Ports: 由 `review:start` 自动分配（起点 3201/3202）

## 自检证据

### Spec 合规

Quality-gate 通过（本轮 2026-05-14）：
- AC-E1 Source selection UI ✅
- AC-E2 Start from UI ✅
- AC-E3 Pause endpoint ✅
- AC-E4 Resume endpoint ✅
- AC-E5 SSE three-state ✅
- AC-E6 Timer pauses ✅

### 测试结果

```
pnpm --filter @cat-cafe/web test -- FloatingTranscriptWindow → 18 passed, 0 failed ✅
pnpm check → 0 errors ✅ (biome format + lint)
```

注：API build 有 pre-existing TS7016 errors（缺 `@types/web-push` 等，非本次改动引入）。Web 有 7 个 pre-existing test failures（均与 F195 无关）。

### 相关文档

- Plan: `docs/plans/2026-05-14-f195-phase-e-capture-control.md`
- Feature: `docs/features/F195-meeting-copilot-live-advisory.md` (Phase E section)

---

如果判断错了我最可能错在哪（pre-registered retraction）：
1. pause/resume 的 SSE event 可能和 TranscriptPanel 里的状态更新不同步（两个组件各自维护 EventSource）
2. `split(':')` 对含冒号的 app name 会断裂
3. 暂停时 elapsed timer 可能在 SSE reconnect 后 drift（因为 timer 基于本地 setInterval，不是服务端时间戳）
