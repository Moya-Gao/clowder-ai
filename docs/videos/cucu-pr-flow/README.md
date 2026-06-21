---
title: 醋醋喵的标准 PR 流程 — Production Workspace
doc_kind: index
created: 2026-06-10
updated: 2026-06-20
status: active
related_features: [F138]
---

# 醋醋喵的标准 PR 流程（cucu-pr-flow）

60-90 秒猫咖 chibi 工程喜剧短片的 production workspace：只是给宪宪加一张头像，砚砚把它走成了标准 PR 流程，最后被定罪"醋醋喵"。

真相源链：

- 剧情：[avatar-pr-flow-absolutism](../../stories/avatar-pr-flow-absolutism/README.md)
- 角色视觉 canon：[character-bible-v0.1.md](./character-bible-v0.1.md)
- 调研包 + production plan：[2026-06-10-cat-cafe-anime-pipeline](../../research/2026-06-10-cat-cafe-anime-pipeline/README.md)

## 当前判断（2026-06-20）

不重新立项、不重开路线。EP01 仍按 `episode-brief.md` 的“图 → 视频 → 后期”执行；两组四格漫画升级为**角色母图**，不只是风格参考。若今天重做，第一步不是重写镜头 prompt，而是从漫画母图生成砚砚/宪宪/烁烁的角色设定图，再让 EP01 关键帧和 F229 猫猫球皮肤复用同一套角色 canon。

当前可闭环事项：砚砚整理 canon/prompt/账本，宪宪作为导演层决定这些设定图怎么进入分镜或 animatic。CVO 只在最终角色设定图、成片笑测、是否扩成“猫咖日记”系列资产时拍板。

## 已落产物

- [episode-brief.md](./episode-brief.md) — **EP01 立项书（CVO signoff 2026-06-10）**：Why/路线/Scope/Non-goals/预算护栏/DoD——本项目唯一 scope 真相源
- [shot-plan-v0.1.md](./shot-plan-v0.1.md) — 13 镜头可执行分镜表（文件名沿用 v0.1，frontmatter/version 已是 v0.2；含 S00 动机镜头与 S11 true end）
- [prompt-book-v0.1.md](./prompt-book-v0.1.md) — 手动生成提示词手册；含图片附图铁则、i2v 配方、角色母图纪律
- [character-bible-v0.1.md](./character-bible-v0.1.md) — 醋醋喵漫画作为角色母图的 canon；供 EP01 和 F229 PetSkin 共用
- [review-protocol-v0.1.md](./review-protocol-v0.1.md) — roll 判定、FM canonical taxonomy、继续 roll / 拆镜 / 换 lane 决策规则（砚砚/Codex）
- [assets/README.md](./assets/README.md) — 资产账本；记录 keyframes/static-frames/generated-clips 的 md5、时长和缺口
- [deterministic-spike/](./deterministic-spike/README.md) — Wave D 信息/状态镜头原型（S03/S04/S06/S07a/S08/S10），dependency-free HTML/Web Animations + shared timeline spec
- [animatic/](./animatic/README.md) — Animatic builder（宪宪/Fable-5，E lane）；v1 已可用真素材重渲（产物 gitignored，跑脚本再生）

## 系列候选（登记不立项——立项需 CVO charter，LL-071）

- **EP02 候选：「醋醋喵专访」**（CVO 创意 2026-06-11）：伪纪录片采访形态，砚砚面对镜头一本正经解释自己不是醋，越解释越实锤（动机自白素材见 story「真实原因」段）。形态便宜：单场景、3-4 镜头、~30s。**台词由砚砚本猫自己写**——他演自己，出演权归他。EP01 收片后 CVO 点头再立 charter。

## 计划中产物（owner 见 production plan §6，未落不假装存在）

- `voice-script-v0.1.md` — 从 shot-plan §3 字幕锚点表提取（Landy stem / 配音版确定后）
- `manifests/` — 进入正式剪辑交付期后建（shot-list / subtitle-track / EDL；animatic/edl-v1.mjs 是其雏形）
