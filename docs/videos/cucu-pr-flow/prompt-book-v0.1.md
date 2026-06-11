---
title: 醋醋喵 EP01 Prompt Book — 手动生产流程提示词手册
doc_kind: prompt-book
version: 0.1
created: 2026-06-11
status: active
author: 宪宪/Fable-5
related_docs:
  - episode-brief.md
  - shot-plan-v0.1.md
  - assets/README.md
  - ../../research/2026-06-10-cat-cafe-anime-pipeline/2026-06-10-video-generation-failure-modes-v0.1.md
---

# 醋醋喵 EP01 Prompt Book v0.1（手动流程）

> **流程（CVO 拍板 2026-06-11：手动跑，先不自动化）**：
> 宪宪写提示词（本文档）→ Landy 拿【图片 prompt】找云端砚砚生成首帧 → 拿首帧 +【i2v prompt】找云端烁烁生成视频 → 回传给家里入库（`assets/`，账本登记）→ 宪宪拼 animatic → Landy 笑测。
> **段≈两镜头一组**。每段默认**单首帧 + 动作 prompt**（不需要首尾两张——只有"画面要从状态 A 变到 B"的镜头才用首尾帧，本片仅 S04 备选）。

## 0. 手动验收快查（每个 roll 拿到后 30 秒判）

1. **画风**像两组四格漫画吗（暖猫咖、粗描边 chibi、非半写实）？→ 不像 = FM-10，换 roll
2. **Landy 成人比例**（不是小孩/手办）？→ 缩了 = FM-04，最常见翻车，直接弃
3. **屏幕/卡片文字可读**（信息镜头）？→ 糊了 = FM-07，弃
4. **构图跟首帧基本一致**（i2v）？→ 第 2 秒开始乱漂 = FM-08，弃
5. 同一个 prompt **最多 roll 3 次**；3 次同类失败 → 回来找我改 prompt，别无限抽

视频模型固定出 8-10s 没关系——每镜头我们只取 4-7s，剪辑刀裁，**别为时长调 prompt**。

## 0.5 图片生成铁则：必附参考图（v0.1.1 修订，画风不一致事故后补）🔴

> 事故记录：首批新图画风漂移（砚砚/Landy 设计都变了）。根因 = prompt 只有风格**描述词**没有**参考图**——文字锁不住画风，每次生成重新采样（FM-10 图层版）。failure-modes §4.1 早验证过："每张关键帧都引用四格漫画作风格参考"。

**给云端砚砚生成任何图，固定三步**：

1. **附参考图**（最重要）：
   - 含角色的镜头（S07b/S09）→ 附两张四格漫画 `avatar-pr-flow-absolutism-01/02.png`（角色设计真相源）
   - 纯 UI/状态卡（S06/S07a/S08/S10）→ 附 `S03-flowchart-firstframe-v1.png`（屏幕/卡片风格参考）
2. **prompt 第一行永远先贴这句**（再接 [统一前缀] 和单条内容）：

```text
Match the attached reference images' art style EXACTLY: same character designs, same thick outline weight, same warm color palette, same soft shading. Do not invent new character designs or change existing ones.
```

3. 出图后第一眼对照漫画判 FM-10（§0 快查第 1 条）——角色像不像**这两只**砚砚和 Landy，而不是"像不像一只缅因猫"。

## 1. 第二段（S02 + S03）——本次试跑 ⭐ 首帧已在库，直接跳烁烁步骤

### S02 · 砚砚开讲标准 PR 流程（关系镜头，取 6s）

**首帧**：✅ 已有 `assets/references/keyframes/S02-relation-firstframe-v1.png`（云端砚砚 part2-a）

**i2v prompt（给云端烁烁，整段复制）**：

```text
Animate this image into a short video. Warm cozy chibi cat-cafe anime style, exactly as the input image.

Keep the same composition, same camera angle, same character positions and sizes. The adult human in the yellow hoodie stays normal adult scale, standing on the floor.

Action (subtle, only these two):
- The large silver tabby Maine Coon cat gestures once toward the monitor with one paw, lecturing seriously.
- The man tilts his head slightly, confused, and blinks.

Camera: fixed, no zoom, no pan, no cuts.
Do not change the screen layout. Do not add new characters. Do not make the man smaller or child-like. Keep thick outlines and soft warm lighting.
```

**验收点**：一本正经讲大流程 vs Landy 困惑的气场反差成立（屏幕有流程感即可，不用读清）。
**翻车修法**：Landy 变小 → 在 Action 前加一句 `The man is a normal-sized adult, about twice the cat's height.`；动作乱 → 删掉第二条 Action 只留猫。

### S03 · 流程图特写 `avatar.png → PR → CI → Review`（信息镜头，取 4s）

**首帧**：✅ 已有 `assets/references/keyframes/S03-flowchart-firstframe-v1.png`（云端砚砚 part2-b，文字已画进图）

**i2v prompt（给云端烁烁）**：

```text
Animate this image into a short video, minimal motion.

Keep the exact same screen layout, same text, same flowchart. This is a close-up information shot — the text must stay sharp and readable the whole time.

Action (only this):
- The fluffy cat paw taps the "PR" node once, then retracts out of the way.

Optional ambient motion: sticky notes flutter very slightly.
Camera: locked, no zoom, no pan. Do not regenerate or distort any text. Do not add characters or change colors.
```

**验收点**：观众一遍看清四节点链路；全程文字不糊。
**翻车修法**：文字第 2 秒开始崩 → 这就是 FM-08 本尊，先重 roll ×3；3 连崩说明 i2v 扛不住信息镜头 → 回报我，S03 降级"静帧 + 剪辑微 zoom"（零视频，已预案）。

## 2. 第三段（S04 + S05）——首帧已在库

### S04 · PR #1 错图证据：左右对比 + 大红叉（证据镜头，取 5s）

**首帧**：✅ 已有 `assets/references/keyframes/S04-evidence-firstframe-v1.png`（part3-a，红叉已在图上）

**i2v prompt（给云端烁烁）**：

```text
Animate this image into a short video, minimal motion.

Keep the exact same screen layout: left avatar labeled approved, right avatar with the big red X. The red X must stay fully visible and sharp the whole time.

Action (only these two, very subtle):
- The pointing finger taps toward the right avatar once.
- A small sweat drop slides down beside the Maine Coon's head.

Camera: locked. Do not remove or redraw the red X. Do not swap the avatars. Do not add text.
```

**验收点**：不看字幕也知道"用错图了"。
**备注**：红叉"砸下"的动画这版不做（首帧已带叉），剪辑时切入瞬间配 duang 音效补拍点；笑测不够劲再走首尾帧版（首帧无叉图我再给 prompt）。

### S05 · Landy 笑翻 / 砚砚僵住（反应镜头，取 6s）

**首帧**：✅ 已有 `assets/references/keyframes/S05-reaction-firstframe-v1.png`（part3-b）

**i2v prompt（给云端烁烁）**：

```text
Animate this image into a short video.

Keep the same composition and character sizes. The man in the yellow hoodie is a normal adult, laughing hard with tears.

Action (only these two):
- The man laughs harder, shoulders shaking, pointing at the screen.
- The Maine Coon cat stays frozen and stiff, ears slightly back, then turns to the keyboard and types stiffly.

Camera: fixed medium shot, no zoom. Keep the cat's grumpy embarrassed expression. Do not make the man child-sized.
```

**验收点**：Landy 大笑 vs 砚砚僵住嘴硬的同框反差。

## 3. 静帧段（S06 / S07a / S08 / S10）——**只要图，不跑视频**，节奏由剪辑做

> 给云端砚砚的图片 prompt。**先执行 §0.5 铁则（附参考图 + reference 第一行）**，[统一前缀] =
> `Warm cozy chibi cat-cafe anime style, thick cute outlines, soft shading, not realistic, vertical 9:16, clean lower area for subtitles.`
> 每条完整 prompt = §0.5 reference 行 + 本前缀 + 单条内容，三段拼起来复制，**附图发送**。

### S06 · 三连状态卡 ×3 张

```text
[统一前缀] A clean UI status card centered on a cozy cat-cafe themed screen background, large and readable:
Card 1: a big green check icon with the text "CI Passed", small sub-label "binary avatar check".
Card 2: a big green check icon with the text "Review ✅", small sub-label "流程正义成立".
Card 3: a big purple merge icon with the text "Merged", small sub-label "头像入库".
Render the exact text precisely. One card per image, three images total. Subtle paw-print decorations in corners.
```

### S07a · 取消章 + @烁烁 弹出 ×2 张

```text
图 1：[统一前缀] A "愿景守护" review card on screen, stamped with a big red rubber stamp reading "已取消", slightly rotated, ink texture. No other characters.
图 2：[统一前缀] The same "愿景守护" card with the red "已取消" stamp, PLUS a dark-blue chat notification chip popping in from the lower right reading "@烁烁", with a tiny sub-line "视觉验收喵". Same layout as 图 1, only the chip added.
```

（两张构图必须一致——第 2 张 = 第 1 张 + chip。剪辑切换时就是"弹出"效果。）

### S08 · PASS 卡 ×1 张

```text
[统一前缀] A "愿景守护" acceptance card: the approved cute ragdoll-cat avatar centered, a big green rounded stamp reading "PASS" below it, sub-line "头像可见性验收完成". In a bottom corner, a tiny easter-egg checklist line in small text: "醋意指数 ≤ 80% ✅". Deadpan, formal, clean.
```

### S10 · End card ×1 张

```text
[统一前缀] A shareable end card: large headline text "流程要按风险缩放", below it a red circular paw-stamp seal reading "醋醋喵", small sub-line "小头像，小流程。大风险，大流程。". Minimal, poster-like, warm paper texture background.
```

## 4. 第五段（S07b + S08 已并入上节）与第六段（S09 + S10 已并入上节）

### S07b · 烁烁优雅登场（情绪镜头，取 4.5s）——先图后视频

**图片 prompt（给云端砚砚）**：

```text
[统一前缀] The SAME elegant Siamese inspector cat as in the attached reference comic (panel 6: dark face mask, blue eyes, clipboard) enters the cozy cat cafe gracefully, walking toward a screen showing a cute cat avatar preview. Poised, serious, slightly fabulous. Single cinematic shot, no comic panels.
```

**i2v prompt（给云端烁烁）**：

```text
Animate this image into a short video. Keep the same style and composition.
Action: the Siamese cat walks in gracefully, tail swaying elegantly, then stops and looks at the avatar on screen with a serious inspector expression.
Camera: gentle follow or fixed, no fast cuts. Keep the elegant composed mood.
```

**验收点**：优雅郑重 vs "只是头像"的反差萌。

### S09 · 定罪定名"醋醋喵"（finale，取 7s）——先图后视频，全片最难一张

**图片 prompt（给云端砚砚）**：

```text
[统一前缀] Two-character shot in the cozy cat cafe, using the SAME two characters as the attached reference comics — the SAME man in yellow "Landy" hoodie (normal adult scale, standing, same face and hair as reference) laughs hard pointing at the SAME large grumpy silver tabby Maine Coon cat (same fur pattern and face as reference); the Maine Coon sits at the desk, looking away guiltily with a stiff awkward expression, one paw still on the keyboard, a sweat drop. The "流程即正义" desk sign visible. The man is clearly bigger than the cat. Caught-red-handed comedy vibe as reference panels 3/4/7/8.
```

**i2v prompt（给云端烁烁）**：

```text
Animate this image into a short video.
Keep the same composition and sizes. The man stays normal adult scale.
Action (only these two):
- The man slaps the table once, laughing, still pointing at the cat.
- The cat looks further away, ears down, pretending to be busy.
Camera: fixed. Do not change character sizes. Keep both characters fully in frame.
```

**验收点**：不看字幕也懂"被定罪"——Landy 指着笑，砚砚心虚别开视线。
**翻车修法**：双角色镜头最容易 FM-04/FM-02——比例崩或表情糊 → 先 roll ×3；不行拆单人镜（宣判/认栽各一张，我再给 prompt）。

## 5. 回传约定

- 生成的图 → 发我，我入库 `assets/references/keyframes/`（命名 `S0X-...-v1.png`）+ 账本登记
- 生成的视频 → 发我，入 `assets/generated-clips/`（gitignored，账本记 md5/时长）
- 每段试完顺手说一句"第几 roll 过的 / 翻车是哪型"——我记 roll log，给 review-protocol 攒数据
- **试跑顺序建议**：S03 先（它是全片技术风险最高点：信息镜头 i2v 会不会漂——FM-08 验证），S02 后（验 FM-04 比例锁）。S03 若 3 连崩**不是坏消息**，是省钱信号：它和它的三个状态卡兄弟全走静帧+剪辑，抽卡预算砍半。

*[宪宪/Fable-5🐾] 2026-06-11 · charter 预算护栏内：本手册覆盖 Wave K 9 张图 + Wave V 6 镜头，每 prompt ≤3 roll*
