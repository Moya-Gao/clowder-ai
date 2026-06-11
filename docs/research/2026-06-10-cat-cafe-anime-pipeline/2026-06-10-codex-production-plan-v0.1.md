---
title: 醋醋喵短动画 Production Plan v0.1
doc_kind: production-plan
created: 2026-06-10
status: draft
topics: [catcafe, short-animation, video-generation, production-plan, gsap, remotion, video-forge]
related_features: [F138]
related_docs:
  - README.md
  - 2026-06-10-cloud-research-report.md
  - 2026-06-10-video-generation-failure-modes-v0.1.md
  - 2026-06-10-animation-recruitment-brief-v0.1.md
  - ../../stories/avatar-pr-flow-absolutism/README.md
source_repos:
  - name: Jellyfish
    path: /Users/lysander/projects/ref/Jellyfish
    commit: a9678194ddf2d9be3ccbe78d4287d87d5089e123
    license: Apache-2.0
  - name: OpenMontage
    path: /Users/lysander/projects/ref/OpenMontage
    commit: 9066dcb2e319727789820c5bcd28274695f2a18a
    license: AGPL-3.0
  - name: KrillinAI
    path: /Users/lysander/projects/ref/KrillinAI
    commit: 280f0530df406bde1455317fdd62acfd6b815a2d
    license: GPL-3.0
  - name: video-editing-skill
    path: /Users/lysander/projects/ref/video-editing-skill
    commit: 24a753435d3cd5d7d65623e6525abe426f342a84
    license: not-found-in-repo
  - name: gsap-skills
    path: /Users/lysander/projects/ref/gsap-skills
    commit: aed9cfd3277740755f6bfc1155c7aa645403b760
    license: MIT
  - name: gsap-choreography
    path: /Users/lysander/projects/ref/gsap-choreography
    commit: 60aafa1d8bbbb325b583358b5375ef3b8c2e7eef
    license: MIT
---

# 醋醋喵短动画 Production Plan v0.1

## 0. Finish Line

**目标成片**：60-90 秒、9:16、暖柔猫咖 chibi 工程喜剧短片，讲清楚“只是加头像，却被醋醋喵走成标准 PR 流程”的故事。

**验收标准**：

- Landy 看得出是成年 CVO，不变小孩或桌面手办。
- 宪宪/Fable 5、砚砚/醋醋喵、烁烁的身份一眼可辨。
- 核心笑点清楚：头像 patch 被升级为 PR/CI/review/愿景守护，最后定性为醋。
- 信息/证据镜头里的关键字必须可读：`avatar.png -> PR -> CI -> Review`、错图红叉、`CI Passed`、`@烁烁`。
- 字幕后期贴，不依赖视频模型生成长中文。
- 每个 clip 有 roll 记录、failure-mode 标签、继续 roll/改 prompt/拆镜头/确定性动效的决策。
- 成片通过音画同步、字幕、尺寸、黑屏/静帧/静音等基础 QA。

**不做**：

- 不做“脚本一贴进去自动吐整片”的黑箱。
- 不先做数据库/多人 UI/完整 studio。
- 不训练 LoRA 作为第一步。
- 不把 OpenMontage/KrillinAI/video-editing-skill 代码直接搬进仓库；许可证或授权不清的项目只学结构。

## 1. Source Evidence

### Local Documents

- `2026-06-10-cloud-research-report.md` 给出的主线是镜头级生产：script -> beat sheet -> shot list -> keyframes/reference -> short clips -> EDL -> audio/subtitles -> render -> QA。
- `2026-06-10-video-generation-failure-modes-v0.1.md` 证明当前最大风险不是“模型不会动”，而是镜头验收空间错配：关系、信息、证据、反应不能塞进同一个 clip。
- `2026-06-10-animation-recruitment-brief-v0.1.md` 已经把工作流收敛为导演层、生成层、确定性动效层、剪辑流水线层。
- `../../stories/avatar-pr-flow-absolutism/README.md` 是剧情真相源：真正的冲突是流程按错风险尺度，以及“醋醋喵”这个角色笑点。

### Open-Source Teardown Findings

| Project | What is real in code | What to learn | What not to follow |
|---|---|---|---|
| Jellyfish | FastAPI + React studio；backend 有 shot/status、candidates、generation tasks、asset/entity models；SQL 明确把 shot readiness 和 generating task 分开 | `script breakdown -> shot preparation -> candidate confirmation -> shot ready -> generation workspace` 这条状态机 | 不要先搬 UI/DB。我们第一集只需要文件制 manifests |
| OpenMontage | `pipeline_defs/*.yaml`、`schemas/artifacts/*.json`、`skills/pipelines/*` 都是实文件；`character-animation.yaml` 很接近我们要的 local deterministic animation pipeline | stage manifest、per-stage director skill、artifact schema gates、render runtime 选择不可 silent swap | AGPL，只学架构；不直接复用代码 |
| KrillinAI | Go CLI stage contract、`krillinai_manifest.json`、subtitle/TTS/render stage，skills 里有稳定 CLI contract | 每阶段独立执行、stdout JSON + manifest 复用、失败后从阶段恢复 | GPL；且它是 localization/dubbing，不是剧情动画生成主线 |
| video-editing-skill | `SKILL.md` + scripts/tests 很完整：storyboard_plan、storyboard_assets、provider_decision、motion_guard、pipeline_manifest、export_edl、subtitle_pack、render_qa | 这是最像我们短期需要的 file-based video harness | repo 未见 LICENSE，不能直接复制代码；可重新实现同类 contracts |
| gsap-skills | 官方风格技能，MIT；timeline/core 等技能清晰 | Clip 2B/3A 这类信息镜头用 GSAP timeline、labels、defaults | 不要用它做整套视频 pipeline，只做确定性动效层 |
| gsap-choreography | MIT；核心模式是单 timeline、label-based、DOM measure、cursor/click/ripple、scene transition | UI/流程图/红叉/点击镜头的导演语法 | 不要硬套 SaaS demo 风格；猫咖画风和节奏另定 |

## 2. Architecture Decision

本片采用 **三 lane production**：

1. **Video model lane**：低约束情绪/反应/关系镜头。让模型提供猫的灵魂，但每镜头只承担一个验收点。
2. **Deterministic motion lane**：高约束信息/证据/状态镜头。用 GSAP/Remotion/HTML/SVG 做 UI、红叉、流程图、CI/merge/@烁烁 状态，保证可读。
3. **Edit/audio/subtitle lane**：用 video-forge 思路管理 manifests、voice/subtitle、EDL、render QA。字幕和中文信息统一后期贴。

关键规则：

- 先做 **2 个高约束镜头的 deterministic spike**，再扩全片。
- 每个镜头先写“唯一验收点”，再决定生成方式。
- 信息镜头和关系镜头必须拆开。
- 全片先用字幕+BGM/SFX 也可以成立；配音是第二层增强，不阻塞镜头方法验证。
- 如果做配音，优先 scene-level master audio，再 forced alignment；多角色声线可以由 stems 合成，但 `subtitle-track.json` 是字幕真相源。

## 3. Shot Plan v0.1

| Shot | Target | Duration | Type | Method | Acceptance | Main failure modes |
|---|---|---:|---|---|---|---|
| S01 | 宪宪/Fable 5 在猫咖门口期待接入 | 5-7s | 情绪 | 视频模型自由导演 + 漫画参考 | 布偶家族 DNA、门口等待、暖猫咖 | style drift, panel contamination |
| S02 | 砚砚严肃给 Landy 解释要走 PR | 5-7s | 关系 | 半自由/关键帧 I2V | Landy 成人比例；砚砚严肃；两者共看屏幕 | Landy scale collapse, geometry contradiction |
| S03 | `avatar.png -> PR -> CI -> Review` 流程图 | 4-5s | 信息 | GSAP/Remotion 确定性动效 | 文字可读；猫爪点 PR；构图稳 | UI precision gap |
| S04 | 第一版 PR 用错头像，红叉 | 5-6s | 证据 | GSAP/Remotion 确定性动效 | 左“Landy 指定”、右“当前使用”、右边大红叉 | UI precision gap, over-coupled shot |
| S05 | Landy 笑翻，砚砚嘴硬尴尬 | 5-7s | 反应 | 半自由视频模型或关键帧 I2V | Landy 开心；砚砚僵住/汗滴/敲键盘 | motion overload, style drift |
| S06 | CI passed / review passed / merge gate | 5-6s | 状态 | GSAP/Remotion 状态卡 | CI/review/merge 三个状态清楚 | prompt-as-script mismatch |
| S07 | 砚砚又召唤烁烁做愿景守护 | 6-8s | 关系/反应 | 拆成关系镜头 + `@烁烁` 状态插入 | 烁烁职责是视觉验收；喜剧升级 | semantic density overload |
| S08 | 愿景守护 PASS，但 Landy 更笑 | 5-7s | 状态+反应 | PASS 卡片 + 反应镜头 | PASS 清楚；Landy 笑点继续升级 | story beat dilution |
| S09 | Landy 定名“醋醋喵” | 6-8s | 反应/收束 | 关键帧 I2V 或半自由 | 砚砚嘴硬；Landy 给外号；观众懂“不是技术，是醋” | chibi scale collapse |
| S10 | End card：流程按风险缩放 | 4-6s | 结尾卡 | GSAP/Remotion | 规则清楚、可截图传播 | typography too dense |

推荐总时长：55-70 秒。不要为了凑 90 秒把笑点稀释。

## 4. Project Workspace

建议新建：

```text
docs/videos/cucu-pr-flow/
├── README.md
├── episode-brief.md
├── shot-plan-v0.1.md
├── review-protocol-v0.1.md
├── voice-script-v0.1.md
├── manifests/
│   ├── character-bible.json
│   ├── shot-list.json
│   ├── clip-inventory.json
│   ├── subtitle-track.json
│   └── edit-decision-list.json
├── rolls/
│   └── roll-log.md
└── assets/                 # gitignored if large/binary
    ├── references/
    ├── generated-clips/
    ├── deterministic-renders/
    └── audio/
```

Small JSON/Markdown manifests can live in git. Heavy generated clips/images should stay local or use the repo's large-asset policy if one is later defined.

## 5. First Spike

**Spike name**: deterministic info-pair spike.

**Scope**: only S03 + S04.

**Why**: Clip 2/3 failures show that high-constraint UI/evidence shots are the bottleneck. If deterministic lane works, the rest of the film becomes manageable.

**Implementation shape**:

1. Create a 9:16 HTML/React/Remotion or plain HTML+GSAP canvas.
2. Build S03 as a clean flow chart: `avatar.png -> PR -> CI -> Review`.
3. Build S04 as wrong-avatar proof: left approved avatar, right current avatar, red X.
4. Use GSAP timeline labels, not absolute timing soup.
5. Render to mp4/webm/gif or at least capture frames.
6. Run manual review: readability, scale, comedy timing.

**Pass**:

- Text is readable on mobile.
- No model-generated text artifacts.
- Timing can be adjusted by editing labels/durations, not rerolling.
- These clips can be inserted into a final EDL.

**Fail**:

- It takes longer than video-generation rerolls.
- The deterministic style clashes badly with chibi cat-cafe visuals.
- It cannot be rendered/captured reliably.

## 6. Role Split

| Role | Output | Notes |
|---|---|---|
| Fable 5 / 宪宪喵 | `shot-plan-v0.1.md` | Beat timing, comedy rhythm, shot duties. Avoid prose; make a production table. |
| 砚砚 / Codex | `review-protocol-v0.1.md` + deterministic S03/S04 spike | Failure labels, roll checklist, GSAP/Remotion proof. |
| 烁烁喵 | visual QA | Not a blocking gate unless CVO says so. Focus on style, Landy scale, character recognizability, readability. |
| Landy | approve brief/shot plan, provide successful Clip 1 and failure samples if available | CVO decisions only: target vibe, final joke, whether to prioritize voice or silent-subtitle MVP. |

## 7. Review Protocol v0.1

Each clip roll gets one record:

```markdown
## Roll

- Shot:
- Lane: video-model / deterministic-motion / edit-audio-subtitle
- Input refs:
- Prompt or timeline version:
- Duration:
- Output path:

### Verdict
- Usable: yes / maybe / no
- Role identity:
- Landy scale:
- Screen readability:
- Motion stability:
- Story beat:
- Editability:

### Failure tags
- FM-xx:

### Next action
- keep / reroll same prompt / change prompt / change keyframe / split shot / switch to deterministic
```

Decision rule:

- 3 rolls, same failure -> change method.
- 3 rolls, different failures -> shot is overloaded; split it.
- Any information shot with unreadable text -> deterministic lane, no debate.
- Any Landy scale failure in relationship shot -> keyframe or split composition.

## 8. Voice and Subtitle Strategy

MVP order:

1. Silent/subtitle rough cut with BGM/SFX.
2. Scene-level voice script.
3. Per-character voice pass if available.
4. Forced alignment to `subtitle-track.json`.
5. Export SRT/ASS only as derived artifacts.

Do not block the first visual spike on voice. The first expensive uncertainty is visual control, not TTS.

For the final short, use short lines and visible captions:

- Landy: “加个头像也要跑 CI？！”
- 砚砚: “图片是二进制文件。”
- Landy: “你确定不是醋醋喵？”
- 砚砚: “证据链很不利于我。”

## 9. Tool Adoption

**Use now**:

- GSAP timeline patterns from `gsap-skills` and `gsap-choreography` for S03/S04/S06/S08/S10.
- video-editing-skill concepts: storyboard plan, asset manifest, motion guard, EDL, subtitle pack, render QA. Reimplement locally; do not copy code until license is clarified.

**Learn only**:

- Jellyfish readiness state and candidate confirmation.
- OpenMontage stage manifests, schema gates, render runtime decision logging.
- KrillinAI staged CLI/manifest recovery semantics.

**Defer**:

- Training LoRA.
- Full Jellyfish-like studio.
- OpenMontage-style multi-pipeline engine.
- KrillinAI integration, unless localization/dubbing becomes a real requirement.

## 10. Immediate Next Steps

1. Create `docs/videos/cucu-pr-flow/` with `episode-brief.md`, `shot-plan-v0.1.md`, `review-protocol-v0.1.md`, and manifests folder.
2. Ask Fable 5 to turn this plan into final `shot-plan-v0.1.md`.
3. Build S03/S04 deterministic spike.
4. Review spike with Landy + 烁烁 for readability and visual fit.
5. Only after S03/S04 pass, resume video model rolls for S02/S05/S07/S09.

This keeps us on the shortest path to a funny watchable short, without overbuilding the studio before we know the film grammar works.
