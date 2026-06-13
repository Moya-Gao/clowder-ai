---
title: 醋醋喵 Animatic v0 — E Lane 节奏验证
doc_kind: prototype
created: 2026-06-10
status: animatic-v0
author: 宪宪/Fable-5
related_docs:
  - ../shot-plan-v0.1.md
  - ../review-protocol-v0.1.md
  - ../deterministic-spike/README.md
---

# 醋醋喵 Animatic v0（E Lane 节奏验证）

shot-plan §5 step 2 的强制检查点：在烧任何视频模型 roll 之前，用最便宜的方式验证全片 54s 节奏和笑点 timing。

构成：D lane 镜头（S03/S04/S06/S07a/S08/S10）从 deterministic-spike export 模式抓喜剧拍点帧；V lane 镜头（S01/S02/S05/S07b/S09）用显式占位卡（斜纹边 + V LANE PLACEHOLDER 标签，防误当成片），**对白直接烤在占位卡上**（Chrome 渲染中文，不依赖 ffmpeg 文字滤镜）；完整字幕轨（`edl-v0.mjs` = shot-plan §3 的机器可读形态）以 **mov_text 软字幕** mux 进 mp4，播放器可开关。**无 SFX/BGM**——音频是下一层（open issue #3）。

## Run（v1 真素材版，2026-06-12）

```bash
node docs/videos/cucu-pr-flow/animatic/build-animatic.mjs
# 产物: animatic/out/animatic-v1.mp4 (78.4s, 1280x720 横屏, 字幕+BGM/SFX+砚砚 TTS 已混音)
# out/ 不进 git（large-asset policy）；脚本可随时重跑再生
```

v1 = 全真素材（8 视频 + 7 静帧卡 + S10 后 0.5s 黑场 + S11 true end）。builder 自动探测素材画幅：同向直通，异向 blur-pad（竖素材进横屏 = 背景模糊填充）。字幕走 Chrome 透明 PNG 条 + ffmpeg overlay 烧制（本机无 libass 的绕行，subtitle.html 渲染中文完美）。

音频层（2026-06-12）由 `audio/audio-plan-v0.1.mjs` + `audio/build-audio.mjs` 生成：砚砚本猫 `codex` 声线走家里 `/api/tts/synthesize`，BGM/SFX 为本地程序化合成（无外部素材授权风险），并自动把每个 i2v 源视频的原始音轨按 EDL 时间线铺成低音量环境声 bed（保留键盘声/房间声这类 diegetic texture）。Landy 录音到位后作为新 stem 加入 audio plan；当前不是让 Landy 念完整字幕。若只想重渲无声视频，可临时 `CUCU_SKIP_AUDIO=1 node docs/videos/cucu-pr-flow/animatic/build-animatic.mjs`。

⚠️ **画幅 DECISION-PENDING**：素材分裂（6 视频横屏 / 2 视频 + 8 图竖屏）。当前输出 1280×720 横屏（保 6 个主力镜头原画质）；CVO 若拍竖屏，改 `edl-v1.mjs` 的 width/height 重跑即可（builder 已参数化，pad 方向自动反转）。v0 占位卡版见 git 历史 `6693646da`。

依赖本机 Chrome + ffmpeg/ffprobe + python3，零 npm 依赖。

## 文件

| File | Purpose |
|---|---|
| `edl-v0.mjs` | 镜头顺序/时长/字幕真相源（来自 shot-plan §2/§3） |
| `build-animatic.mjs` | 抓帧 → 拼段 → concat → 烧字幕 → 时长校验 |
| `audio/audio-plan-v0.1.mjs` | 音频 cue 真相源：砚砚 TTS / BGM / SFX / 源视频环境声 bed 音量 / 后续 Landy stem 插入点 |
| `audio/build-audio.mjs` | 调 Cat Café TTS 合成 codex 声线 + 生成程序化 BGM/SFX + 抽取源视频音轨 + ffmpeg 混音 |
| `placeholder.html` | V 镜头占位卡（standalone，file:// 直开安全） |
| `out/` | 生成产物，gitignored |

## 验收（Landy 笑测清单）

1. 54s 总节奏：前半铺垫慢、S06 起机关枪加速、S09 最长 hold——曲线对吗？
2. S04 红叉前的 0.8s 静止 + S07a 的 0.5s 停顿——笑点 timing 成立吗？
3. 字幕四句名场面读得舒服吗？
4. target vibe / final joke 是否对味（shot-plan open issue #4 的 CVO approve 项）

节奏不对 → 改 `edl-v0.mjs` / `timeline-spec.mjs` 的数字重跑，不烧 V roll。

## Limits（诚实声明）

- D 镜头是静帧采样不是动效连续帧——拍点可感但动画细节以 spike 实时播放为准。
- V 镜头占位卡无表演信息，只占节奏位。
- 本机 ffmpeg 无 libass/freetype（无 `subtitles`/`drawtext` 滤镜），硬字幕烧制留给 E lane 精修阶段（届时换带 libass 的构建或走 Remotion）；当前 D 镜头段的台词只在软字幕轨上（S07a 画面有 "@烁烁" chip 承载信息）。
- v1（V 素材到位后）应把帧采样升级为逐帧序列渲染（spike README 的 renderer wrapper 方向）。
