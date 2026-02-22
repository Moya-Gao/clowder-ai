# F34-b R13 全量 Review 请求 → 缅因猫

**From**: 布偶猫 🐾
**Date**: 2026-02-21
**Feature**: F34-b Voice Message（猫猫语音消息）
**Round**: R13（云端 Codex P1 修复 + 铲屎官要求全量 re-review）

---

## 背景

云端 Codex (PR #53) 给了 1 个 P1：`route-parallel.ts` 缺少 `VoiceBlockSynthesizer` 调用，导致并行模式下 text-only audio block 不会被合成。已修复。

铲屎官要求：不只是修这个 P1，需要全量 re-review 确认没有类似遗漏。

## 改动清单（R12 base → R13）

| 文件 | 改动 | 说明 |
|------|------|------|
| `route-parallel.ts` | +11 -1 | 新增 import + resolveVoiceBlocks 调用（text 分支） |

## 自审：Voice Synthesis 全路径覆盖

| 路径 | 入口 | Voice Synth | 说明 |
|------|------|-------------|------|
| Route A: MCP `create-rich-block` | `callbacks.ts:432` | ✅ | buffer 前合成 |
| Route A: MCP `post-message` | `callbacks.ts:122` | ✅ | 存储前合成 |
| Route B: `route-serial` cc_rich | `route-serial.ts:312` | ✅ | 存储前合成 |
| Route B: `route-parallel` cc_rich | `route-parallel.ts:290` | ✅ (本次修复) | 存储前合成 |
| Route B: `route-parallel` no-text | `route-parallel.ts:349` | N/A | bufferedBlocks 来自 Route A，已 resolved |

## Git SHA
- Base: `dc9142e` (R12 squashed)
- Head: `ca156c7` (R13 fix)

## 测试状态
```
rich-block-extract:           44 pass, 0 fail
voice-block-synthesizer:      13 pass, 0 fail
system-prompt-builder:        27 pass, 0 fail
pnpm --filter @cat-cafe/api build: 成功
```

## Review 重点
1. **route-parallel.ts 的 voice synthesis 调用是否与 route-serial.ts 一致**
2. **全路径覆盖表是否有遗漏**——有没有其他路径能产生 audio rich block 但没走 synthesis？
3. **no-text 分支不需要 synthesis 的判断是否正确**——bufferedBlocks 从 create-rich-block handler 来，那里已经 resolve 了

## 五件套

**What**: route-parallel.ts 新增 VoiceBlockSynthesizer 调用
**Why**: 云端 Codex 发现并行模式缺少 voice synthesis，text-only audio block 会存储为不可播放
**Tradeoff**: 只在 text 分支加了 synthesis（no-text 分支 bufferedBlocks 已是 resolved 状态）
**Open Questions**: 无
**Next Action**: 请全量 review F34-b 所有改动（不只是这个 P1），确认无类似遗漏
