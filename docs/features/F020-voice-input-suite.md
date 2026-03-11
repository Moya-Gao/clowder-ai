---
feature_ids: [F020]
related_features: []
topics: [voice, input, suite]
doc_kind: note
created: 2026-02-26
---


# F020: 语音输入 M1 MVP

> **Status**: done | **Owner**: 三猫
> **Created**: 2026-02-26

## Why
- 铲屎官需求 2026-02-11
- Voice Input design
- Voice Input design + 铲屎官 2026-02-15
- 铲屎官 2026-02-15

## What
- **F20**: 麦克风录音 → 本地 Whisper ASR → 术语纠错 → 填入 textarea → 手动发送。动态按钮 (🎤/▶/⏹/⏳)。缅因猫 2 轮 review 通过 (P1 安全边界 + P1 启动入口 + P2 stream 泄露)。设计: 2026-02-11-voice-input-design.md，commit 965b569
- **F20b**: 1ec0910 + 23a5c30 — requestData() 轮询 + partialTranscript + streamSeqRef 竞态保护。
- **F20c**: 已独立实现为 relay-station 平级项目（非 cat-cafe 子包）。macOS 全局热键（⌥Space）+ Whisper 转写 + 术语纠正 + 打字到任意 app。
- **F20d**: CatCafeHub "语音设置" tab：可编辑术语纠正表 + initial_prompt 编辑 + 语言选择。内置词典 + localStorage 用户自定义合并。计划: 2026-02-15-voice-accuracy-and-system-whisper.md Phase B

## Acceptance Criteria
- [x] AC-A1: 本文档已补齐模板核心结构（Status/Why/What/Dependencies/Risk/Timeline）。

## Links
- [Whisper ASR 迁移 Apple Silicon 原生方案调研（替代 faster-whisper / CPU int8）](../research/whisper-asr-apple-silicon-migration.md)
- [`2026-02-11-voice-input-design.md`](./archive/2026-02/plans/2026-02-11-voice-input-design.md)
- [`2026-02-15-voice-accuracy-and-system-whisper.md`](./plans/2026-02-15-voice-accuracy-and-system-whisper.md)

## Key Decisions
- Phase B

## Dependencies
- **Related**: 无
- 无显式依赖声明

## Risk
| 风险 | 缓解 |
|------|------|
| 历史文档口径与当前实现可能漂移 | 在 F094 批次里持续复跑审计脚本并按批次回填 |

## Timeline
- 从历史 BACKLOG 归档恢复（`be27a44^`）。
- 关联 commit：`965b569`，`1ec0910`，`23a5c30`.
