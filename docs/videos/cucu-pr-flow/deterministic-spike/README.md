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

This folder proves the Wave D deterministic lane without adding app dependencies:

- **S03**: `avatar.png -> PR -> CI -> Review`
- **S04**: wrong-avatar evidence card with left/right comparison and red X
- **S06**: `CI Passed -> Review OK -> Merged` acceleration cards
- **S07a**: canceled vision-guard stamp, mandatory 0.5s pause, then `@烁烁`
- **S08**: deadpan vision-guard `PASS`
- **S10**: risk-scaled process end card

The point is not final polish. The point is that information shots can be made readable, timed by labels, and inserted into an animatic without video-model text drift.

## Files

| File | Purpose |
|---|---|
| `s03-s04-info-pair.html` | Openable Wave D prototype, 9:16 stage. Filename retained for review links. |
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

## Export URLs

Use `export=1` to hide demo chrome and baked captions before any frame enters animatic:

```text
http://127.0.0.1:8098/s03-s04-info-pair.html?export=1&shot=S03
http://127.0.0.1:8098/s03-s04-info-pair.html?export=1&shot=S04
http://127.0.0.1:8098/s03-s04-info-pair.html?export=1&shot=S06
http://127.0.0.1:8098/s03-s04-info-pair.html?export=1&shot=S07a
http://127.0.0.1:8098/s03-s04-info-pair.html?export=1&shot=S08
http://127.0.0.1:8098/s03-s04-info-pair.html?export=1&shot=S10
```

## Pass Criteria

- Text remains readable at mobile size.
- S03 communicates the four-node flow in one pass.
- S04 communicates wrong-avatar proof without subtitles.
- S04 red X lands after the 0.8s static comparison hold from `shot-plan-v0.1.md` §4.
- S06 follows the 1.6s / 1.3s / 1.0s + 0.6s status timing.
- S07a preserves the 0.5s comedy pause before `@烁烁`.
- Export mode hides demo chrome and caption layer.
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

1. **导出净化 gate（对应 D-04）**：已在 Wave D batch 增加 `?export=1&shot=<id>`；export mode 隐藏 `data-layer="demo"` 和 `data-layer="caption"`，保留 stage-only 内容供 animatic 截帧。
2. **猫爪占位微调（对应 D-01）**：已右下移，爪子 rest 位点 PR 节点角，不压核心文字。

*[宪宪/Fable-5🐾]*
