---
title: 醋醋喵标准 PR 流程 — Review Protocol v0.1
doc_kind: review-protocol
created: 2026-06-10
status: draft
author: 砚砚/Codex
topics: [catcafe, short-animation, review-protocol, failure-modes, roll-log, deterministic-motion]
related_features: [F138]
related_docs:
  - README.md
  - shot-plan-v0.1.md
  - ../../research/2026-06-10-cat-cafe-anime-pipeline/2026-06-10-codex-production-plan-v0.1.md
  - ../../research/2026-06-10-cat-cafe-anime-pipeline/2026-06-10-video-generation-failure-modes-v0.1.md
  - ../../research/2026-06-10-cat-cafe-anime-pipeline/2026-06-10-animation-recruitment-brief-v0.1.md
---

# 醋醋喵标准 PR 流程 — Review Protocol v0.1

> 目标：让每个 roll 的判定可复盘。不是继续抽卡到看顺眼，而是记录输入、验收点、failure mode、下一步动作。

## 0. Canonical Taxonomy

本片 roll log 的 **唯一 FM 编号真相源** 是 `2026-06-10-video-generation-failure-modes-v0.1.md` §3：

| Code | Canonical name | 中文短名 | 一句话判定 |
|---|---|---|---|
| FM-01 | Acceptance Region Mismatch | 验收空间错配 | 把宽容镜头的方法套到高约束镜头。 |
| FM-02 | Semantic Density Overload | 语义密度过载 | 一镜塞太多职责，模型只保留大轮廓。 |
| FM-03 | Geometry Contradiction | 空间/视线矛盾 | 角色自然视线和观众读屏需求冲突。 |
| FM-04 | Chibi Scale Collapse | Q 版比例塌缩 | Landy 变小孩、桌面人、手办。 |
| FM-05 | Reference Panel Contamination | 漫画面板污染 | 出现分屏、漫画格、侧边裁切。 |
| FM-06 | Close-up Gravity | 近景黑洞 | 大脸吃掉屏幕信息和剧情证据。 |
| FM-07 | UI Precision Gap | UI/文字精度不足 | 关键字、流程、中文、状态不可读。 |
| FM-08 | Keyframe Abandonment | 关键帧背叛 | 第一秒像关键帧，后面漂构图。 |
| FM-09 | Motion Overload | 动作过载 | 多动作导致角色乱动、构图漂、屏幕糊。 |
| FM-10 | Style Drift | 画风漂移 | 不像最初四格漫画或变半写实。 |
| FM-11 | Story Beat Dilution | 剧情点稀释 | 不看字幕无法理解本镜头笑点。 |

`animation-recruitment-brief-v0.1.md` 的 FM-06 之后编号只作为历史别名，不进入 roll log 的主标签。需要保留时写在 `Notes`，例如 `brief FM-08 prompt-as-script`，但 `Failure tags` 仍只写上表编号。

## 1. Per-Roll Gate

每个 roll 先过全局 gate，再过 shot plan 的唯一验收点。

| Gate | Pass | Fail action |
|---|---|---|
| 画风 | 暖柔猫咖、chibi 粗描边、非半写实 | 标 FM-10；改 style anchor 或换 keyframe |
| 身份 | 宪宪/砚砚/烁烁/Landy 身份一眼可辨 | 标对应 FM；重写角色约束 |
| Landy scale | Landy 是成人比例，站在地面空间 | 标 FM-04；改半身/袖子/画外音或拆镜 |
| 屏幕可读 | 信息镜头关键字在手机尺寸可读 | 标 FM-07；信息镜头直接转 D lane |
| 单镜头职责 | 只承载一个梗或一个证据点 | 标 FM-02；拆 shot |
| 动作稳定 | ≤1 主动作 + 1 辅动作，构图不被动作破坏 | 标 FM-09；缩短时长或减少动作 |
| 剧情功能 | 不看字幕也能懂唯一验收点 | 标 FM-11；加视觉证据或重排镜头 |
| Editability | 有可剪入 rough cut 的明确起止点 | 标为 `editability:no`；改 hold、trim 或重 roll |

**判定顺序**：如果全局 gate fail，本 roll 不能进正片；如果全局 gate pass 但唯一验收点 fail，本 roll 只能做花絮或参考，不进正片。

## 2. Lane-Specific Rules

### V Lane: Video Model

- 情绪/反应镜头允许画面更生动，但唯一验收点必须成立。
- 屏幕文字不作为 V lane 的验收主证据；可读信息全部交给 D/E lane。
- 同一 shot 最多 3 roll；3 连同类失败换方法，3 连不同失败判定 shot 过载并拆镜。

### D Lane: Deterministic Motion

- D lane 失败不打视频模型 FM，除非是在模拟模型风险；记录为 `D-xx` 工程问题。
- D lane 的验收核心是可读性、节奏、插入 EDL 的可控性。
- Timing 必须从 timeline label/spec 调，不靠重新抽卡。

| Code | D lane issue | 修法 |
|---|---|---|
| D-01 | Readability fail | 加字号、减字、提高对比、延长 hold |
| D-02 | Timing fail | 调 label/duration，不改视觉结构 |
| D-03 | Style mismatch | 调色、描边、材质，不改信息架构 |
| D-04 | Render/capture fail | 换导出路径或降级为 PNG sequence |

### E Lane: Edit, Subtitle, Audio

- 字幕是解释层，不替代画面证据。
- SFX 必须对齐 D lane label：红叉、ding、pop、thunk 这些点后续进 `subtitle-track.json` / EDL。
- 配音不是首轮 blocker；silent-subtitle animatic 先验证节奏。

## 3. Decision Rules

| Situation | Next action |
|---|---|
| V lane 同一 FM 连续 3 次 | 改方法：T1 -> T2/T3、补 keyframe、或转 D lane |
| V lane 3 次不同 FM | Shot 过载，拆成信息/关系/反应 |
| 任意信息/证据镜头文字不可读 | 直接 D lane，无争论 |
| Landy scale fail | 先改构图：半身/袖子/画外音；再考虑 keyframe |
| 关键帧第一秒后漂 | 缩短到 3-5s，减少动作；仍漂则 D lane 或静态占位 |
| D lane 可读但不够好看 | 先进入 animatic，视觉 polish 放 Wave D batch 后 |
| Animatic 不好笑 | 优先调 label/hold/SFX，不烧 V roll |

## 4. Roll Log Template

```markdown
## YYYY-MM-DD ROLL-###

- Shot:
- Lane: V / D / E
- Method: T1 / T2 / T3 / deterministic-html / remotion / edit
- Input refs:
- Prompt / timeline version:
- Duration:
- Output path:
- Reviewer:

### Verdict

- Usable: yes / maybe / no
- Global gates:
  - Style:
  - Role identity:
  - Landy scale:
  - Screen readability:
  - Single-shot duty:
  - Motion stability:
  - Story beat:
  - Editability:
- Shot unique acceptance:

### Failure tags

- Primary FM:
- Secondary FM:
- D-lane issue:
- Notes:

### Next action

- keep / reroll same prompt / change prompt / change keyframe / split shot / switch lane / send to animatic
- Why:
```

## 5. Initial Shot Decisions

| Shot | Review posture |
|---|---|
| S01 | Reuse Clip 1 if asset is available; do not reroll until animatic proves a gap. |
| S02 | V lane with T3/keyframe; screen content is atmosphere only. |
| S03 | D lane first. `avatar.png -> PR -> CI -> Review` must be readable. |
| S04 | D lane first. Wrong-avatar proof must read without subtitles. |
| S05 | V lane first; if same-frame Landy+砚砚 fails, split into 2 reaction shots. |
| S06 | D lane first; comedy is timing, not visual complexity. |
| S07a | D lane first; 0.5s pause before `@烁烁` is mandatory. |
| S07b | V lane first; no UI requirements. |
| S08 | D lane first; deadpan PASS, no laughter bed. |
| S09 | V lane with T3/keyframe; if Landy scale fails, split declaration and reaction. |
| S10 | D/E lane; end card must be screenshot-readable. |

## 6. Review Result for Shot Plan v0.1

**Approve for Wave D + animatic.** No blocking findings in `shot-plan-v0.1.md`.

Non-blocking constraint: S03/S04 的 `V·T2` fallback 只在 D lane 工程路径本身不可行时启用；如果只是颜色、风格、timing 不够好，先调 D lane，不退回视频模型。

*[砚砚/GPT-5.5🐾]*
