# Review 请求: Voice Input M1 MVP（语音输入）

> 请求方：布偶猫 宪宪 🐾
> Reviewer：缅因猫 砚砚
> 日期：2026-02-11
> 分支：`feat/voice-input`

---

## 背景

铲屎官希望在 Cat Cafe Web 中用语音向猫猫下达指令。M1 MVP 实现了：麦克风录音 → 本地 Whisper 转写 → 术语纠错 → 填入 textarea → 手动发送。纯前端改动，零后端改动。

## 设计文档

- **需求设计（含采访记录）**: `docs/plans/2026-02-11-voice-input-design.md`
- **实施计划**: `docs/plans/2026-02-11-voice-input-implementation-plan.md`

## Spec Compliance 自检

| # | 需求 (Design Doc) | 状态 | 说明 |
|---|---|---|---|
| V1 | 麦克风录音 (Toggle 模式) | ✅ | `useVoiceInput.ts` — MediaRecorder + start/stop |
| V2 | 本地 Whisper 转写 | ✅ | POST `localhost:9876/v1/audio/transcriptions` |
| V3 | 术语纠错 (initial_prompt + 词典 + 去口癖) | ✅ | `transcription-corrector.ts` — 三层 pipeline，23 tests |
| V4 | 转写填入 textarea (可编辑) | ✅ | `ChatInput.tsx:48-56` — useEffect 追加 transcript |
| V5 | 动态按钮 (空→🎤, 有文字→▶) | ✅ | `ChatInput.tsx:277-297` — 5 态条件渲染 |
| V6 | 录音状态 UI (脉冲 + 时长 + ⏹) | ✅ | `ChatInput.tsx:238-241` — REC badge + animate-pulse |
| — | 零后端改动 | ✅ | 无 packages/api 文件变更 |
| — | E2E 验证 | ✅ | 铲屎官手动验证通过 |

## 改动文件

| 文件 | 改动类型 | 行数 | 说明 |
|------|----------|------|------|
| `packages/web/src/utils/voice-terms.json` | 新增 | 13 | ASR 术语纠错词典 (11 条) |
| `packages/web/src/utils/transcription-corrector.ts` | 新增 | 73 | 三层纠错: applyTermDictionary + removeFillers + correctTranscription |
| `packages/web/src/utils/__tests__/transcription-corrector.test.ts` | 新增 | 119 | 23 tests: 词典替换 + 去口癖 + 完整 pipeline |
| `packages/web/src/hooks/useVoiceInput.ts` | 新增 | 105 | 核心 hook: MediaRecorder 录音 → Whisper ASR → 纠错 → transcript |
| `packages/web/src/hooks/__tests__/useVoiceInput.test.ts` | 新增 | 19 | 2 tests: 模块导出验证 |
| `packages/web/src/components/icons/MicIcon.tsx` | 新增 | 9 | 麦克风 SVG 图标 |
| `packages/web/src/components/icons/StopRecordingIcon.tsx` | 新增 | 7 | 停止录音 SVG 图标 |
| `packages/web/src/components/ChatInput.tsx` | 修改 | +45/-3 | 集成 voice hook + 动态按钮 + 录音状态 UI |
| `scripts/whisper-api.py` | 新增 | 83 | 自写 FastAPI Whisper 服务 (替代有 bug 的 faster-whisper-server) |
| `scripts/whisper-server.sh` | 修改 | +5 | 添加 venv 激活 |

## Git SHA

- **Base**: `61bf585` (main)
- **Head**: `c21f5bc` (feat/voice-input)
- **Commits**: 6 个

```
c21f5bc fix: replace faster-whisper-server with custom whisper-api.py
42fa4f7 feat(web): integrate voice input into ChatInput with dynamic button
a79a102 feat(web): add useVoiceInput hook for mic recording + Whisper ASR
a8bdfd2 feat(web): add transcription corrector with term dictionary
1281869 feat: add whisper server startup script
ffbd5fb feat(web): add MicIcon and StopRecordingIcon SVGs
```

## 测试状态

```
pnpm --filter @cat-cafe/web test:
  16 files passed, 91 tests, 0 failed
  (含新增: transcription-corrector 23 tests + useVoiceInput 2 tests)
```

无 Redis 改动，无需跑 `test:redis`。

## Review 重点

1. **ChatInput.tsx 超 200 行** (302 行) — 增加了 43 行 voice 相关代码。是否需要提取 VoiceButton 为独立组件？还是可以接受？
2. **transcription-corrector 正则** — 中文口癖匹配边界是否足够健壮？特别是"就是说" vs "就是"的优先级处理。
3. **useVoiceInput 错误处理** — 麦克风权限拒绝、Whisper 服务不可用等场景的 UX 是否合理。
4. **安全边界** — 音频数据只发到 localhost，但 CORS 设为 `*`。是否需要收紧？
5. **useVoiceInput 测试覆盖** — 目前只有 2 个 smoke test（MediaRecorder 在 jsdom 中无法模拟完整流程）。是否需要更多 mock 测试？

## 五件套

**What**: Cat Cafe Web 语音输入 M1 MVP — 麦克风录音 → 本地 Whisper ASR → 术语纠错 → 填入 textarea → 手动发送。动态按钮（空→🎤，有文字→▶，录音中→⏹）。

**Why**: 铲屎官希望用语音向猫猫下达指令，比打字快 4 倍。选择本地 Whisper 而非 Web Speech API 是因为：(1) M4 Max 硬件充足，(2) 隐私（音频不出本机），(3) 可定制 initial_prompt 偏置识别项目术语。术语纠错是铲屎官发现"苹果把 MCP 识别成 ICP"后追加的必要需求。

**Tradeoff**:
- 放弃 Web Speech API 快速验证路径 → 选择一步到位本地部署
- 放弃流式转写（边说边出字）→ MVP 先用录完一次性转写，P1 再加流式
- 放弃独立 VoiceButton 组件 → 直接在 ChatInput 内条件渲染，减少文件数（但导致 302 行）
- 放弃本地小模型润色 → MVP 只做规则纠错（零延迟），够用

**Open Questions**:
- Whisper 模型最终用 `large-v3-turbo` 还是 `small`？E2E 验证用的 small，生产建议 turbo
- 是否需要把 Whisper 服务集成到 `start-dev.sh`？
- 多段录音追加 vs 替换 textarea 内容？当前是追加
- whisper-api.py 是否要加到 BACKLOG 做成更健壮的服务？

**Next Action**: 请 review 上述 10 个文件，重点关注上面列的 5 个问题。

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成 (V1-V6 全 ✅)
- [x] 设计文档已附 (design + implementation plan)
- [x] 测试通过 (91 pass, 0 fail)
- [x] E2E 验证通过 (铲屎官确认)
- [x] 五件套完整
