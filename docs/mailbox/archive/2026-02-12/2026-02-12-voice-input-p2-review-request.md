# Review 请求: Voice Input P2 — 拆分 + 测试 + 健壮性 + 流式转写

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-12

## 背景

Voice Input M1 合入后 (commit `965b569`)，BACKLOG 登记了 4 项 P2 技术债务/功能：
- **#59**: ChatInput.tsx 超标 (302 行 > 200 行限制)，需拆分语音按钮
- **#60**: useVoiceInput 只有 2 个 smoke test，需要全面覆盖
- **#61**: whisper-api.py 缺少上传限制、错误处理、日志
- **F20b**: M2 流式转写 — 录音过程中实时显示部分转写结果

本次 PR 一次性闭环所有 4 项。

## 设计文档

- BACKLOG: `docs/BACKLOG.md` (#59, #60, #61, F20b)
- M1 设计: `docs/plans/2026-02-11-voice-input-m1-plan.md`
- 无新 ADR（均为 M1 架构内的增强/重构）

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | ChatInput < 200 行 | ✅ | 302 → 176 行 (review P2 修复后)，提取 ChatInputActionButton + ChatInputMenus + chat-input-options |
| 2 | useVoiceInput 全面测试 | ✅ | 2 → 17 tests (初始态/录音/停止/mimeType/权限拒绝/构造失败+流清理/计时/完整转写/释放/短录音/HTTP错误/网络错误/空操作/FormData/错误清除/流式) |
| 3 | whisper-api.py 健壮性 | ✅ | 25MB 限制(413)、空文件(400)、模型未加载(503)、try/except、logging、SIGTERM、exit(1) |
| 4 | 流式转写 (边说边出字) | ✅ | 每 3s `requestData()` → Whisper REST → `partialTranscript` 显示 |
| 5 | 流式错误不影响最终转写 | ✅ | catch 静默吞错，final transcription 独立运行 |
| 6 | 版本保护防竞态 | ✅ | `versionRef` 确保旧录音结果不覆盖新录音 |
| 7 | 现有测试不回归 | ✅ | 所有 108 frontend + 907 backend tests 通过 |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/web/src/components/ChatInputActionButton.tsx` | 新增 → 修改 | #59 提取 5 态按钮 + 语音覆盖层；F20b 添加 partialTranscript 显示 |
| `packages/web/src/components/ChatInput.tsx` | 修改 | #59 移除语音 imports/hook/overlay/按钮，用 `<ChatInputActionButton>` 替代 |
| `packages/web/src/hooks/useVoiceInput.ts` | 修改 | F20b 添加 `partialTranscript`/`streamTimerRef`/`versionRef`，提取 `transcribeBlob()` |
| `packages/web/src/hooks/__tests__/useVoiceInput.test.ts` | 修改 | #60 从 2→13 tests；F20b 新增 4 streaming tests (共 17) |
| `scripts/whisper-api.py` | 修改 | #61 上传限制/空文件/503/日志/SIGTERM/model load failure |

## Git SHA

- Base: `c891cb4` (main)
- Head: `1ec0910` (feat/voice-input-p2)
- Commits: 4 (dfb0a00, 8e11f96, 4343a66, 1ec0910)

## 测试状态

```
pnpm --filter @cat-cafe/web test:  108 passed, 0 failed (16 test files)
pnpm --filter @cat-cafe/api test:  907 passed, 0 failed, 1 skipped
```

## Review 重点

1. **ChatInputActionButton 提取边界** — 是否遗漏了应该提取的状态/逻辑？ChatInput 仍保留 `handleTranscript` callback
2. **流式转写竞态保护** — `versionRef` + `recorder.state === 'recording'` 双重检查是否足够？
3. **requestData() 时序** — 修复了 chunk 长度检查在 requestData 之前的 bug，移到之后。逻辑是否正确？
4. **whisper-api.py 安全** — M1 review 修过 `0.0.0.0`→`127.0.0.1` 和 CORS，本次新增 413/400/503，是否还有遗漏？
5. **MockMediaRecorder 测试基础设施** — 新增 `requestData()` mock 和流式测试，mock 是否足够真实？

## 五件套

**What**: 4 项 P2 闭环 — 拆分语音按钮组件、全面测试 useVoiceInput (17 tests)、whisper-api.py 健壮性、流式转写功能

**Why**: M1 技术债务清理 + 用户体验提升（录音时能看到实时转写，知道"系统在听"）

**Tradeoff**:
- 流式方案选择 `requestData()` 轮询而非 WebSocket 流式推送 — 复用现有 REST 端点，避免新协议；代价是 3s 延迟
- 未引入 `@testing-library/react`（项目未安装）— 用 `createRoot` + `act` 原生 API
- `partialTranscript` 每次发送完整累积音频（非增量） — 简单可靠，Whisper 处理短音频很快

**Open Questions**:
- 流式间隔 3s 是否需要用户可配置？当前硬编码
- 长录音（>1min）的流式 transcription 性能如何？每次重发完整音频

**Next Action**: 请 review 上述 5 个文件（重点关注竞态保护和 requestData 时序修复）

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成
- [x] 设计文档已附 (BACKLOG #59/#60/#61/F20b)
- [x] 测试通过 (108 frontend + 907 backend)
- [x] 五件套完整
