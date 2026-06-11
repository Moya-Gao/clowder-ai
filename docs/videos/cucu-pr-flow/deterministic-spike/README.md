---
title: 醋醋喵 D Lane Deterministic Spike
doc_kind: prototype
created: 2026-06-10
status: spike
author: 砚砚/Codex
topics: [catcafe, short-animation, deterministic-motion, html, timeline, s03, s04]
related_docs:
  - ../shot-plan-v0.1.md
  - ../review-protocol-v0.1.md
---

# 醋醋喵 D Lane Deterministic Spike

This folder proves the first D lane pair without adding app dependencies:

- **S03**: `avatar.png -> PR -> CI -> Review`
- **S04**: wrong-avatar evidence card with left/right comparison and red X

The point is not final polish. The point is that information shots can be made readable, timed by labels, and inserted into an animatic without video-model text drift.

## Files

| File | Purpose |
|---|---|
| `s03-s04-info-pair.html` | Openable prototype, 9:16 stage. |
| `s03-s04-info-pair.css` | Visual system and responsive 720x1280 layout. |
| `s03-s04-info-pair.js` | Web Animations driver. |
| `timeline-spec.mjs` | Shared timing/spec truth source for browser and verifier. |
| `verify.mjs` | Dependency-free structural verifier. |

## Run

```bash
node docs/videos/cucu-pr-flow/deterministic-spike/verify.mjs
# ES module 走 file:// 会被 CORS 拦（页面空白），必须经本地 server：
cd docs/videos/cucu-pr-flow/deterministic-spike && python3 -m http.server 8098
# 浏览器打开 http://127.0.0.1:8098/s03-s04-info-pair.html
```

The verifier checks dimensions, shot durations, required labels, file references, and D lane acceptance hooks. Browser playback uses the same `timeline-spec.mjs`.

## Pass Criteria

- Text remains readable at mobile size.
- S03 communicates the four-node flow in one pass.
- S04 communicates wrong-avatar proof without subtitles.
- S04 red X lands after the 0.8s static comparison hold from `shot-plan-v0.1.md` §4.
- Timing can be adjusted from labels/spec, not by rerolling.

## Current Limit

This is an HTML/Web Animations spike, not a rendered mp4. If it passes animatic review, the next engineering step is a renderer wrapper: Playwright frame capture, Remotion, or ffmpeg image sequence.

## Cross-Review v0.1（2026-06-10，宪宪/Fable-5，非作者复现）

**Verdict: APPROVE** — 五条 Pass Criteria 全过，D lane 方法成立，可进 Wave D 批量。

复现证据（reviewer 独立跑，非转述作者结论）：

- `node verify.mjs` ok；`node --check` ×3 ok
- 本地 server + headless Chrome 虚拟时间抓帧（S03@3.6s / S04@7.4s）：S04 左右对比 + 红叉不看字幕一眼懂；S03 四节点链路可读；中文代码渲染清晰无模型伪字
- `timeline-spec.mjs` 的 S04 label 链与 `shot-plan-v0.1.md` §4 帧级拍点逐项吻合（0.5/0.5/0.8 静止/duang+shake/hold）；所有动画 delay/duration 均从 spec label 取值，"改 label 不重抽"结构成立

非阻塞 findings（进 Wave D 必须收口，不阻塞本 spike 验收）：

1. **导出净化 gate（对应 D-04）**：当前页面含 demo chrome（标题条/时钟/控制条）+ 底部烤入 caption。caption 是演示装饰且内容有串台：S03 烤了"图片是二进制文件…"（该台词属 S05），S04 烤了"证据自己说话。"（这是 shot-plan §3 对"无字幕"的解释语）。字幕真相源 = shot-plan §3 → 未来 `subtitle-track.json`，烤入字幕会与 E lane 双轨。**任何帧进 animatic 前必须有 stage-only 导出形态**（如 `?export=1` 隐藏 `data-layer="demo"` 元素，或导出时裁切）。
2. **猫爪占位微调（对应 D-01）**：S03 猫爪 rest 位遮住 PR 节点副标签（作者自查亦有记录）；建议 offset 右下移，爪点节点角而非文字区。CSS/keyframe offset 级修改，不动结构。

*[宪宪/Fable-5🐾]*
