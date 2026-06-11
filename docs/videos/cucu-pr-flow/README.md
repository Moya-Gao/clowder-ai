---
title: 醋醋喵的标准 PR 流程 — Production Workspace
doc_kind: index
created: 2026-06-10
status: active
related_features: [F138]
---

# 醋醋喵的标准 PR 流程（cucu-pr-flow）

60-90 秒猫咖 chibi 工程喜剧短片的 production workspace：只是给宪宪加一张头像，砚砚把它走成了标准 PR 流程，最后被定罪"醋醋喵"。

真相源链：

- 剧情：[avatar-pr-flow-absolutism](../../stories/avatar-pr-flow-absolutism/README.md)
- 调研包 + production plan：[2026-06-10-cat-cafe-anime-pipeline](../../research/2026-06-10-cat-cafe-anime-pipeline/README.md)

## 已落产物

- [episode-brief.md](./episode-brief.md) — **EP01 立项书（CVO signoff 2026-06-10）**：Why/路线/Scope/Non-goals/预算护栏/DoD——本项目唯一 scope 真相源
- [shot-plan-v0.1.md](./shot-plan-v0.1.md) — 11 镜头可执行分镜表（宪宪/Fable-5，导演层；方法列待按立项书路线重标 v0.2）
- [review-protocol-v0.1.md](./review-protocol-v0.1.md) — roll 判定、FM canonical taxonomy、继续 roll / 拆镜 / 换 lane 决策规则（砚砚/Codex）
- [deterministic-spike/](./deterministic-spike/README.md) — Wave D 信息/状态镜头原型（S03/S04/S06/S07a/S08/S10），dependency-free HTML/Web Animations + shared timeline spec
- [animatic/](./animatic/README.md) — Animatic v0 builder（宪宪/Fable-5，E lane）：D 帧 + V 占位卡 + 软字幕 → 54s 节奏验证 mp4（产物 gitignored，跑脚本再生）

## 系列候选（登记不立项——立项需 CVO charter，LL-071）

- **EP02 候选：「醋醋喵专访」**（CVO 创意 2026-06-11）：伪纪录片采访形态，砚砚面对镜头一本正经解释自己不是醋，越解释越实锤（动机自白素材见 story「真实原因」段）。形态便宜：单场景、3-4 镜头、~30s。**台词由砚砚本猫自己写**——他演自己，出演权归他。EP01 收片后 CVO 点头再立 charter。

## 计划中产物（owner 见 production plan §6，未落不假装存在）

- `voice-script-v0.1.md` — 从 shot-plan §3 字幕锚点表提取（animatic 验证后）
- `manifests/` — 进入剪辑期后建（character-bible / shot-list / subtitle-track / EDL；animatic/edl-v0.mjs 是其雏形）
- `assets/` — references / generated-clips / deterministic-renders / audio（大文件遵守 large-asset policy）
