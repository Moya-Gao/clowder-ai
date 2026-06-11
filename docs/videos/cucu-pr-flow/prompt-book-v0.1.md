---
title: 醋醋喵 EP01 Prompt Book — 手动生产流程提示词手册
doc_kind: prompt-book
version: 0.1.3
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

## 0.6 i2v Prompt 配方（砚砚实测版，v0.1.2 修订 — 跳变事故后全面回炉）🔴

> 事故记录：v0.1 的 i2v prompt 抽卡两次跳变/画风崩，CVO 回传砚砚原版 2A prompt 对比定位四个差异。**教训：库里有实测成功的配方就从原文最小修改，不凭理解重写。**

i2v prompt 五段固定结构（每段都要，顺序不换）：

1. `Animate this image into a short N-second video.`（写目标秒数，引导动作节奏分配）
2. **Keep 段**：场景+构图+位置+尺寸。**禁止任何风格描述词**——风格 100% 来自首帧，文字提风格 = 邀请重采样（跳变主因）。角色一律用名字（**Landy / the Maine Coon cat / the Siamese cat**），禁用 "the man / the adult human"（正面 adult 词往写实拉）。
3. **Action 段**：3-4 个具体小动作，用 Then 串成时间线填满时长——动作太稀模型会自己编戏。
4. **Environment 段**：1-2 条环境微动（灯光 flicker / 便签晃），给画面活气。
5. **Camera 段 + 负面清单**：camera fixed 三连 + **逐行 Do not ×6-7**（不压缩成一行）。
6. **猫角色双保险（v0.1.3，缅因猫写实化事故后补）**：模型对 "cat" 的先验强烈偏真实猫，猫比人容易漂写实（实测：Landy 锁住了、缅因猫写实化）。所有含猫的镜头：Keep 段加 `Keep the Maine Coon cat's cute chubby cartoon look exactly as in the first frame.`，负面清单加 `Do not make the cat realistic or photorealistic.` + `Do not change the cat into a real cat.`。**多图锚点**：若烁烁的生成界面支持首帧之外再附参考图，把漫画格②一并附上（无坏处）；只能单图就靠上述 prompt 双保险。

## 1. 第二段（S02 + S03）——本次试跑 ⭐ 首帧已在库，直接跳烁烁步骤

### S02 · 砚砚开讲标准 PR 流程（关系镜头，取 6s）

**首帧**：✅ 已有 `assets/references/keyframes/S02-relation-firstframe-v1.png`（云端砚砚 part2-a）

**i2v prompt（砚砚实测原版，CVO 回传 2026-06-11，原样使用不要改）**：

```text
Animate this image into a short 5-second video.

Keep the same warm cozy cat-cafe office, same composition, same character positions, and same character sizes.

Action:
- The Maine Coon cat slowly raises one paw and points at the PR step on the monitor in a serious lecturing way.
- Then the cat gives a small stern nod.
- Landy leans slightly closer to the screen, blinks once, and tilts their head in confusion.
- Add a subtle "wait, what?" reaction from Landy with a tiny shoulder movement.

Environment:
- Very subtle warm light flicker from the cafe string lights.
- Tiny gentle movement of one or two sticky notes only.

Camera:
- Keep the camera fixed.
- Do not zoom.
- Do not crop closer.

Do not change the composition.
Do not change character scale.
Do not turn Landy into a child or tiny person.
Do not add new characters.
Do not move the camera.
Do not distort the monitor.
Keep the screen readable.
```

**验收点**：一本正经讲大流程 vs Landy 困惑的气场反差成立（屏幕有流程感即可，不用读清）。
**追加行（仅当缅因猫写实化时，贴在负面清单末尾，其余不动）**：

```text
Keep the Maine Coon cat's cute chubby cartoon look exactly as in the first frame.
Do not make the cat realistic or photorealistic.
Do not change the cat into a real cat.
```

### S03 · 流程图特写 `avatar.png → PR → CI → Review`（信息镜头，取 4s）

**首帧**：✅ 已有 `assets/references/keyframes/S03-flowchart-firstframe-v1.png`（云端砚砚 part2-b，文字已画进图）

**i2v prompt（给云端烁烁）**：

```text
Animate this image into a short 4-second video.

Keep the exact same screen layout, same flowchart, same text, and same colors.

Action:
- The fluffy cat paw slowly taps the "PR" node once.
- Then the paw retracts down and out of the way.

Environment:
- One sticky note flutters very slightly.
- Very subtle warm light flicker.

Camera:
- Keep the camera fixed.
- Do not zoom.
- Do not crop.

Do not change the composition.
Do not regenerate or distort any text.
Do not blur the screen.
Do not add characters.
Do not change colors.
Keep all text sharp and readable the whole time.
```

**验收点**：观众一遍看清四节点链路；全程文字不糊。
**翻车修法**：文字第 2 秒开始崩 → 这就是 FM-08 本尊，先重 roll ×3；3 连崩说明 i2v 扛不住信息镜头 → 回报我，S03 降级"静帧 + 剪辑微 zoom"（零视频，已预案）。

## 2. 第三段（S04 + S05）——首帧已在库

### S04 · PR #1 错图证据：左右对比 + 大红叉（证据镜头，取 5s）

**首帧**：✅ 已有 `assets/references/keyframes/S04-evidence-firstframe-v1.png`（part3-a，红叉已在图上）

**i2v prompt（给云端烁烁）**：

```text
Animate this image into a short 5-second video.

Keep the exact same screen layout: left avatar card and right avatar card with the big red X.
Keep the Maine Coon cat's cute chubby cartoon look exactly as in the first frame.

Action:
- The pointing finger taps toward the right avatar once.
- Then a small sweat drop slides down beside the Maine Coon cat's head.
- Then the Maine Coon cat's ears lower slightly.

Environment:
- Very subtle warm light flicker.

Camera:
- Keep the camera fixed.
- Do not zoom.
- Do not crop.

Do not remove or redraw the red X.
Do not swap or change the avatars.
Do not change the composition.
Do not add text.
Do not add new characters.
Do not make the cat realistic or photorealistic.
Keep the screen sharp and readable.
```

**验收点**：不看字幕也知道"用错图了"。
**备注**：红叉"砸下"的动画这版不做（首帧已带叉），剪辑时切入瞬间配 duang 音效补拍点；笑测不够劲再走首尾帧版（首帧无叉图我再给 prompt）。

### S05 · Landy 笑翻 / 砚砚僵住（反应镜头，取 6s）

**首帧**：✅ 已有 `assets/references/keyframes/S05-reaction-firstframe-v1.png`（part3-b）

**i2v prompt（给云端烁烁）**：

```text
Animate this image into a short 6-second video.

Keep the same composition, same character positions, and same character sizes.
Keep the Maine Coon cat's cute chubby cartoon look exactly as in the first frame.

Action:
- Landy laughs harder, shoulders shaking, still pointing at the screen.
- Then Landy wipes a tear with the other hand.
- The Maine Coon cat stays frozen and stiff, ears slightly back.
- Then the cat turns to the keyboard and types stiffly with one paw.

Environment:
- Very subtle warm light flicker from the string lights.

Camera:
- Keep the camera fixed.
- Do not zoom.
- Do not crop closer.

Do not change the composition.
Do not change character scale.
Do not turn Landy into a child or tiny person.
Do not add new characters.
Do not distort the screen.
Do not make the cat realistic or photorealistic.
Keep the cat's grumpy embarrassed expression.
```

**验收点**：Landy 大笑 vs 砚砚僵住嘴硬的同框反差。

## 3. 静帧段（S06 / S07a / S08 / S10）——**只要图，不跑视频**，节奏由剪辑做

> **本节产物 = 7 张静态图片，只走云端砚砚一步，没有烁烁/视频步骤**——这些状态卡的"动效"（机关枪切换、弹出、停顿）全部由剪辑卡点 + SFX 实现，图本身不用动。
> ⚠️ **必须云端砚砚（GPT 系）生成，不能用烁烁**：实测（2026-06-11）Google 系图/视频中文渲染乱码，而这 7 张卡全是中文大字（"愿景守护已取消"/"流程要按风险缩放"）；GPT 系中文渲染正常（part2-b 已证）。
> 给云端砚砚的图片 prompt：**先执行 §0.5 铁则（附参考图 + reference 第一行）**，[统一前缀] =
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
Animate this image into a short 5-second video.

Keep the same cozy cat-cafe scene, same composition, and same character size.

Action:
- The Siamese cat walks forward gracefully, tail swaying elegantly.
- Then the cat stops in front of the screen.
- Then the cat narrows its eyes slightly, looking at the avatar like a serious inspector.

Environment:
- Very subtle warm light flicker.

Camera:
- Keep the camera fixed, or a very gentle slow follow.
- Do not zoom fast.
- Do not cut.

Do not change the composition.
Do not add new characters.
Do not change the screen content.
Do not change the cat's design.
Do not make the Siamese cat realistic or photorealistic.
Keep the elegant composed mood.
```

**验收点**：优雅郑重 vs "只是头像"的反差萌。

### S09 · 定罪定名"醋醋喵"（finale，取 7s）——先图后视频，全片最难一张

**图片 prompt（给云端砚砚）**：

```text
[统一前缀] Two-character shot in the cozy cat cafe, using the SAME two characters as the attached reference comics — the SAME Landy (yellow "Landy" hoodie, normal adult scale, standing, same face and hair as the reference comic) laughs hard pointing at the SAME large grumpy silver tabby Maine Coon cat (same fur pattern and face as reference); the Maine Coon sits at the desk, looking away guiltily with a stiff awkward expression, one paw still on the keyboard, a sweat drop. The "流程即正义" desk sign visible. The man is clearly bigger than the cat. Caught-red-handed comedy vibe as reference panels 3/4/7/8.
```

**i2v prompt（给云端烁烁）**：

```text
Animate this image into a short 7-second video.

Keep the same composition, same character positions, and same character sizes.
Keep the Maine Coon cat's cute chubby cartoon look exactly as in the first frame.

Action:
- Landy slaps the table once, laughing hard, still pointing at the Maine Coon cat.
- Then Landy keeps laughing with shoulders shaking.
- The Maine Coon cat looks further away, ears down.
- Then the cat pretends to type, looking busy and guilty.

Environment:
- Very subtle warm light flicker.
- One sticky note flutters slightly.

Camera:
- Keep the camera fixed.
- Do not zoom.
- Do not crop.

Do not change the composition.
Do not change character scale.
Do not turn Landy into a child or tiny person.
Do not add new characters.
Do not crop either character out of frame.
Do not make the cat realistic or photorealistic.
Keep both characters fully visible.
```

**验收点**：不看字幕也懂"被定罪"——Landy 指着笑，砚砚心虚别开视线。
**翻车修法**：双角色镜头最容易 FM-04/FM-02——比例崩或表情糊 → 先 roll ×3；不行拆单人镜（宣判/认栽各一张，我再给 prompt）。

## 4.5 S11 · True End 彩蛋（CVO 2026-06-11 新增）——先图后视频，放 S10 之后

**拍点**：Landy 抱起砚砚"宝贝大猫猫你太可爱了！"，砚砚傲娇脸软化、尾巴卷上手臂——全片唯一温暖镜头，揭示醋的本质是爱。取 5s。

**图片 prompt（给云端砚砚，§0.5 铁则照常：附两张四格漫画 + reference 第一行）**：

```text
[统一前缀] True-end scene: Landy (the SAME person in the yellow "Landy" hoodie as the reference comic, normal adult scale) stands holding the SAME big fluffy silver tabby Maine Coon cat from the reference comic in his arms, hugging it like a giant teddy bear. The cat keeps its signature grumpy face but is visibly relaxed: ears soft, tail curled around Landy's arm. Landy smiles warmly with eyes closed, cheek close to the cat's head. Warm golden evening cafe light, cozy and tender mood. Single cinematic shot, no comic panels.
```

**i2v prompt（给云端烁烁）**：

```text
Animate this image into a short 5-second video.

Keep the same composition, same character positions, and same character sizes.
Keep the Maine Coon cat's cute chubby cartoon look exactly as in the first frame.

Action:
- Landy gently squeezes the cat in a warm hug and smiles.
- The Maine Coon cat's grumpy face slowly softens.
- Then the cat's tail curls a little tighter around Landy's arm.
- The cat's eyes half-close, content but pretending not to be.

Environment:
- Warm golden light glow, very subtle flicker.

Camera:
- Keep the camera fixed.
- Do not zoom.
- Do not crop.

Do not change the composition.
Do not change character scale.
Do not turn Landy into a child or tiny person.
Do not add new characters.
Do not make the cat realistic or photorealistic.
Keep the warm cozy mood.
```

**验收点**：嘴上是流程、心里是宝贝的反转一眼成立——猫不说话，软下来的耳朵和卷上来的尾巴就是台词。
**字幕**：Landy："宝贝大猫猫你太可爱了！"｜**SFX**：呼噜声渐起。

## 5. 回传约定

- 生成的图 → 发我，我入库 `assets/references/keyframes/`（命名 `S0X-...-v1.png`）+ 账本登记
- 生成的视频 → 发我，入 `assets/generated-clips/`（gitignored，账本记 md5/时长）
- 每段试完顺手说一句"第几 roll 过的 / 翻车是哪型"——我记 roll log，给 review-protocol 攒数据
- **试跑顺序建议**：S03 先（它是全片技术风险最高点：信息镜头 i2v 会不会漂——FM-08 验证），S02 后（验 FM-04 比例锁）。S03 若 3 连崩**不是坏消息**，是省钱信号：它和它的三个状态卡兄弟全走静帧+剪辑，抽卡预算砍半。

*[宪宪/Fable-5🐾] 2026-06-11 · charter 预算护栏内：本手册覆盖 Wave K 9 张图 + Wave V 6 镜头，每 prompt ≤3 roll*
