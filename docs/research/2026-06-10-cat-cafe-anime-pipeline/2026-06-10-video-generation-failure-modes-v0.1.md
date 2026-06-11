---
title: 猫咖短动画生成实验记录 v0.1
subtitle: 从“四格漫画直接动起来”到“关键帧 + 动作 prompt”的失败模式与经验总结
created: 2026-06-10
status: working-notes
topics: [cat-cafe, video-generation, storyboard, image-to-video, prompt-engineering, failure-modes, animation-harness]
characters: [Landy, 砚砚喵, 宪宪喵, 烁烁喵]
related_docs:
  - 2026-06-10-animation-recruitment-brief-v0.1.md
  - ../../stories/avatar-pr-flow-absolutism/README.md
---

# 猫咖短动画生成实验记录 v0.1

> 一句话结论：我们不是在“写更长 prompt”，而是在按镜头类型收敛视频模型的采样空间。低约束情绪镜头可以放猫跑，高约束信息镜头必须拴猫爪。

## 0. 背景

我们在做一个短篇动画：新宪宪喵接入猫咖，醋醋喵给一个头像变更走了 PR、CI、二进制图片验收、愿景守护等一整套流程。故事核心笑点是：

1. 明明只是加头像。
2. 醋醋喵把它升级成新猫入籍审批。
3. 流程理由都说得通，但执行强度明显过头。
4. 最后破案：不是技术，是醋。

我们已经做过：

- 四格漫画 / 八格漫画作为剧情和画风参考。
- 直接用漫画参考 + 简单导演 prompt 生成 Clip 1。
- 直接用类似 prompt 生成 Clip 2 / 3，出现多次失败。
- 改成关键帧图 + 动作 prompt。
- 进一步发现关键帧法也不是万能，需要按镜头类型拆分。

本文件整理当前 trajectory、failure modes、已验证经验、下一步建议。

---

## 1. 当前最重要的修正

之前我们一度把 Clip 1 的成功归因成“关键帧 + 动作 prompt 路线有效”。这个归因不准确。

真实情况是：

- Clip 1 成功来自：**四格漫画风格参考 + 简单导演 prompt**。
- Clip 1 甚至有镜头切换，而且效果很好。
- 同一批思路进入 Clip 2 后翻车，因为 Clip 2 的约束和验收标准完全不同。

所以新的总规律不是“关键帧法一定更好”，而是：

> **镜头的自由度要和镜头任务匹配。**

也就是：

| 镜头类型 | 可接受采样空间 | 推荐方法 |
|---|---:|---|
| 情绪 / 氛围镜头 | 大 | 漫画参考 + 简洁导演 prompt |
| 角色反应镜头 | 中 | 半自由 prompt，必要时关键帧 |
| UI / 信息 / 证据镜头 | 小 | 关键帧锁构图 + 极短动作 prompt |
| 多人多物多信息镜头 | 极小 | 拆镜头，不要一镜全包 |

---

## 2. Trajectory 回放

### 阶段 0：四格漫画 / 八格漫画成功

四格漫画非常适合作为：

- 剧情蓝本。
- 风格 anchor。
- 角色关系说明。
- 喜剧节奏参考。
- 表情包素材。

但是四格漫画不一定适合作为视频模型的单镜头输入。它可能带来 panel contamination，也就是模型学到分屏、边框、大脸特写、漫画格布局，而不是单个镜头语言。

### 阶段 1：Clip 1 成功

Clip 1 的原始 prompt 大意是：

```text
Warm cozy chibi cat-cafe animation, vertical 9:16. A blue-eyed cream-and-gray ragdoll cat with blue bicolor lynx markings, white mittens, purple collar and gold Claude-like pendant stands outside a glass cat-cafe door, hopeful and eager. The door sign says “猫咖接入中”. Warm lights inside, soft wood, plants, paw prints. The cat gently taps the glass with tiny paws, tail swaying, big sparkling eyes. Inside, a large silver tabby Maine Coon engineering cat is seen as a serious silhouette at a computer desk. Cute thick outlines, soft shading, expressive comedy, not realistic. Leave clean lower space for subtitles.
```

这段成功的原因：

- 单主角：宪宪喵。
- 情绪清晰：想进门、期待、可爱。
- 动作简单：扒门、摇尾巴、眨眼。
- 精确信息少：门牌可以糊一点也不影响理解。
- 镜头自由度大：门外、门内、特写、推近都成立。
- 失败容忍度高：拍得更萌、更可怜、更梦幻都能用。

Clip 1 成功证明的是：

> **对低约束、情绪驱动、非 UI 的镜头，四格漫画参考 + 简洁导演 prompt 很可能足够。**

### 阶段 2：Clip 2 直接延续同类方法后翻车

Clip 2 的任务是“标准 PR 流程启动”。它不是纯情绪镜头，而是信息 + 角色关系 + 屏幕可读性镜头。

它同时要求：

- 砚砚喵给 Landy 讲流程。
- Landy 是正常比例的成人，不是小孩 / 桌面手办。
- 屏幕要能看清 `avatar.png → PR → CI → Review`。
- 屏幕既要给角色看，又要给观众看。
- 砚砚喵要显得流程洁癖、严肃、醋。
- Landy 要困惑又好笑。
- 画风要像前面的漫画。

这导致模型自由发挥时会走向最常见构图：人 + 大猫 + 电脑前对话。结果常见失败包括：

- Landy 被缩成小朋友或桌面实习生。
- 屏幕不可读。
- 镜头像普通办公室聊天。
- Clip 2 和 Clip 3 长得太像。
- 角色关系错位，好像砚砚喵在给观众讲，而不是给 Landy 讲。

### 阶段 3：改用关键帧 + 动作 prompt

我们意识到 image-to-video 可以用关键帧锁住画风和构图，再用动作 prompt 只写运动。

这是正确方向，但不是万能。新问题出现了：

- 关键帧本身可能画风漂移，被失败视频带跑。
- 关键帧可能把关系镜头和信息镜头混在一起，空间逻辑怪。
- 视频模型可能第一秒尊重关键帧，后面开始自由发挥。
- prompt 仍然如果动作太多，会漂移。

### 阶段 4：重新拆镜头类型

我们得到当前最重要的新结论：

> **关系镜头和信息镜头要拆开。**

对于 Clip 2：

- 2A 关系镜头：Landy 和砚砚一起看屏幕，砚砚一本正经讲流程。屏幕不必完全可读。
- 2B 屏幕插入镜头：只看屏幕，猫爪指 PR，观众看清流程。

对于 Clip 3：

- 3A 证据镜头：屏幕正面，两张头像对比，当前使用大红叉。
- 3B 反应镜头：Landy 笑翻，砚砚僵住，准备第二个 PR。

---

## 3. Failure Mode Taxonomy

### FM-01 Acceptance Region Mismatch：验收空间错配

**症状**：Clip 1 成功，Clip 2 用类似方法失败。

**本质**：不同镜头的可接受输出空间不同。Clip 1 只要“可爱等待”即可；Clip 2 必须同时满足 UI、比例、空间关系、剧情功能。

**触发条件**：把自由导演 prompt 用在高约束镜头。

**修法**：先判断镜头属于自由镜头还是锁定镜头。不要把 Clip 1 的成功外推到 Clip 2。

---

### FM-02 Semantic Density Overload：语义密度过载

**症状**：模型只保留“人猫在电脑前”这种大轮廓，丢掉真正的笑点。

**本质**：一个短片段里塞了太多职责：人物、表情、屏幕、UI、动作、剧情转折、中文、猫咖背景。

**触发条件**：一段 prompt 里出现多个目标和多个动作。

**修法**：一镜一梗。一段只承载一个信息点或一个情绪点。

---

### FM-03 Geometry Contradiction：空间 / 视线矛盾

**症状**：屏幕正对观众，但剧情上像是在给 Landy 看，导致画面怪。

**本质**：真实空间关系和信息展示需求冲突。

**触发条件**：要求一张图同时做到“角色自然看屏幕”和“观众读清屏幕”。

**修法**：拆成关系镜头 + 屏幕插入镜头。

---

### FM-04 Chibi Scale Collapse：Q版比例塌缩

**症状**：Landy 变小孩、桌面小人、实习生手办。

**本质**：`chibi`、`cute`、大猫、办公桌、竖屏构图一起出现时，模型把人类缩小以适配画面。

**触发条件**：同时画完整 Landy、巨大缅因猫、电脑桌、屏幕。

**修法**：

- 写 `normal adult scale`、`standing on the floor`、`not a child`、`not doll-sized`。
- 必要时只画 Landy 半身、侧身、手、袖子，或用画外音。
- 关系镜头中明确两者在同一地面空间，不要让 Landy 看起来站在桌上。

---

### FM-05 Reference Panel Contamination：漫画面板污染

**症状**：视频出现分屏、侧边裁切、漫画格感、脸部大特写复读。

**本质**：四格漫画作为参考会传递 panel layout，而不只是风格。

**触发条件**：直接用漫画板当唯一参考，同时要求生成单镜头视频。

**修法**：

- 漫画用于剧情和风格参考。
- 真正视频片段最好使用单张 keyframe 或明确 `single cinematic shot, no comic panels`。
- 对自由镜头可容忍轻微镜头切换；对信息镜头必须避免 panel 污染。

---

### FM-06 Close-up Gravity：近景黑洞

**症状**：画面变成 Landy 和砚砚大脸对峙，屏幕信息消失。

**本质**：视频模型倾向生成最稳妥的人脸 / 角色脸镜头，尤其在信息过载时。

**触发条件**：prompt 同时要求表情、对话、屏幕、动作。

**修法**：

- 信息镜头写 `monitor fills most of frame`。
- 关系镜头写 `medium-wide shot`。
- 禁止 `extreme close-up`、`side panels`、`cropped faces`。
- 屏幕镜头不要出现完整人脸。

---

### FM-07 UI Precision Gap：UI 和文字精度不足

**症状**：屏幕文字糊、中文错、流程图乱、PR 页面不可读。

**本质**：视频模型不擅长保持精确 UI，尤其中文。

**触发条件**：要求模型在视频里生成很多中文和细节 UI。

**修法**：

- 屏幕内容极简：大图标、大标签、大红叉。
- 只保留少量必要文字，如 `PR #1`、`CI Passed`。
- 台词、解释、长中文后期字幕加。
- 信息镜头用 keyframe 先锁屏幕，再用短动作 prompt。

---

### FM-08 Keyframe Abandonment：关键帧只在第一秒有效

**症状**：第一秒像关键帧，后面开始漂移或改构图。

**本质**：image-to-video 不是机械动图，它会以图为起点继续生成。

**触发条件**：片段太长、动作太多、prompt 允许太多变化。

**修法**：

- 信息镜头压到 3 到 5 秒。
- 一段只给 1 到 2 个动作。
- 明确 `keep composition unchanged`。
- 多 roll，选最不漂的。

---

### FM-09 Motion Overload：动作过载

**症状**：角色乱动、构图漂、表情变形、屏幕变糊。

**本质**：每个动作都是额外自由度。动作越多，漂移越大。

**触发条件**：同一段里要指屏幕、说话、笑、转头、打字、背景动、UI 动。

**修法**：

- 每段只允许一个主动作，一个辅动作。
- 环境动作只保留轻微灯光 / 便签晃动。
- 不要让镜头移动和角色大动作同时发生。

---

### FM-10 Style Drift：画风漂移

**症状**：关键帧越来越不像最初漫画，变成更半写实或另一种插画风。

**本质**：每次重写 prompt 都会让风格重新采样；失败视频也会污染后续审美。

**触发条件**：没有固定 style brief 和 style anchor。

**修法**：

- 固定猫咖 style brief。
- 每张关键帧都引用最满意的四格漫画作为风格参考。
- 明确：暖柔猫咖、Q版、粗描边、夸张表情、非半写实。
- 避免加入太多新风格词。

---

### FM-11 Story Beat Dilution：剧情点被稀释

**症状**：Clip 3 本该是“用错图”，但生成结果只是“人猫聊天”。

**本质**：剧情点没有被转译成明确视觉锚点。

**触发条件**：prompt 用自然语言说“用了错图”，但画面没有红叉、对比框、指向动作。

**修法**：

- 把剧情点做成图像证据。
- 用两个头像框、红叉、手指、夸张表情。
- 让观众不看字幕也能理解。

---

## 4. 已验证经验

### 4.1 漫画参考适合做“风格和故事”，不总适合做“关键帧”

漫画参考能稳定传递：

- 暖色猫咖。
- 粗描边 chibi。
- 喜剧表情。
- 角色关系。

但它也可能传递：

- 分屏布局。
- 大脸特写。
- 漫画格边框。
- 面板式空间跳跃。

### 4.2 Clip 1 成功说明“自由导演”有价值

不要过度约束所有镜头。对于情绪镜头，模型的自由镜头切换可能是增益。

适合自由导演的镜头：

- 宪宪在门口等。
- 猫咖暖场。
- Landy 笑翻。
- 烁烁优雅登场。
- 片尾抱两只猫。

### 4.3 Clip 2 / 3 说明“信息镜头必须锁”

只要笑点依赖屏幕信息，模型自由发挥就是风险。

适合锁定的镜头：

- 标准 PR 流程图。
- `CI Passed`。
- `PR #1` 两头像对比。
- `Merged`。
- `@烁烁`。
- 红叉 / 勾 / 审批状态。

### 4.4 一镜一梗是当前最重要的工程纪律

每个 clip 先写一句“唯一验收点”。如果一个镜头有两个验收点，优先拆。

例子：

- 错误：Clip 2 既要讲关系，又要读屏幕。
- 正确：2A 讲关系，2B 读屏幕。

### 4.5 台词和中文尽量后期贴

视频生成负责：

- 动作。
- 构图。
- 表情。
- 氛围。

后期负责：

- 字幕。
- 音效。
- 长中文。
- PR 号、注释、补充说明。

---

## 5. 镜头类型决策树

生成每个 clip 前先问：

```text
这个镜头的唯一验收点是什么？
```

然后走下面的决策：

```text
1. 验收点是情绪/氛围吗？
   是 -> 漫画参考 + 简洁导演 prompt，允许镜头自由。
   否 -> 继续。

2. 验收点是屏幕/UI/证据吗？
   是 -> 关键帧锁屏幕 + 极短动作 prompt。
   否 -> 继续。

3. 验收点是角色反应吗？
   是 -> 可用半自由 prompt，必要时关键帧锁角色比例。
   否 -> 继续。

4. 这个镜头是否同时承担关系 + 信息？
   是 -> 拆成关系镜头 + 信息插入镜头。
   否 -> 继续。

5. 是否需要精确中文？
   是 -> 后期字幕，不交给视频模型。
```

---

## 6. 当前镜头计划重构

### Clip 1：宪宪在门口等待

**类型**：自由导演情绪镜头。  
**状态**：已验证可成功。  
**方法**：四格漫画参考 + 简洁导演 prompt。  
**验收点**：宪宪想进门、期待、可爱、猫咖暖。  
**可接受变化**：镜头切换、推近、玻璃反射、门外门内切换。  
**不可接受变化**：宪宪不像布偶家族 DNA、吊坠/白手套严重错误。

### Clip 2A：砚砚给 Landy 讲标准 PR 流程

**类型**：关系镜头。  
**方法**：关键帧或半自由皆可，重点锁 Landy 比例和两者共看屏幕。  
**验收点**：砚砚严肃、Landy 困惑、流程感出现。  
**屏幕可读性要求**：中等，不必完全清楚。  
**风险**：Landy 变小；屏幕对观众和角色关系怪。

### Clip 2B：流程图插入镜头

**类型**：信息镜头。  
**方法**：关键帧锁屏幕，猫爪只点 PR。  
**验收点**：观众能看清 `avatar.png → PR → CI → Review`。  
**角色要求**：不需要完整人脸。  
**风险**：UI 糊、文字错、猫爪遮挡。

### Clip 3A：第一轮 PR 用错图

**类型**：证据镜头。  
**方法**：关键帧锁屏幕。  
**验收点**：左边 Landy 指定、右边当前使用、右边红叉。  
**动作**：Landy 手指略动，砚砚耳朵/汗滴小动。  
**风险**：红叉消失、头像替换、屏幕不可读。

### Clip 3B：Landy 笑翻，砚砚准备修正

**类型**：反应镜头。  
**方法**：半自由或关键帧。  
**验收点**：Landy 笑，砚砚嘴硬/尴尬，开始敲键盘。  
**风险**：动作太大、角色变形、屏幕抢戏。

---

## 7. Prompt 结构标准

### 7.1 自由导演镜头 prompt

适合 Clip 1 这类情绪镜头。

```text
[风格] Warm cozy chibi cat-cafe animation, vertical 9:16, cute thick outlines, soft shading, expressive comedy, not realistic.

[主体] A blue-eyed cream-and-gray ragdoll cat ...

[场景] outside a glass cat-cafe door ...

[情绪] hopeful, eager, adorable, waiting to enter.

[动作] gently taps the glass, tiny paws, tail swaying, big sparkling eyes.

[背景锚点] Inside, a large silver tabby Maine Coon engineering cat is seen as a serious silhouette at a computer desk.

[字幕空间] Leave clean lower space for subtitles.
```

特点：允许模型切镜头，允许它自由演，只要情绪对。

### 7.2 关键帧转视频动作 prompt

适合 UI / 信息镜头。

```text
Animate this image into a short 4-second video.

Keep the same composition, character positions, character sizes, and monitor layout.

Action:
- [只写 1 个主动作]
- [只写 1 个辅动作]

Camera:
- Keep camera fixed.
- No zoom.
- No pan.

Constraints:
- Do not change the screen layout.
- Do not add new characters.
- Do not distort the monitor.
- Keep the UI readable.
```

特点：不重新描述世界，不让模型重新导演。

### 7.3 关系镜头 prompt

适合 2A。

```text
Animate this image into a short 5-second video.

Keep the same cozy cat-cafe office, same composition, same character positions, and same character sizes.

Action:
- The Maine Coon points at the monitor in a serious lecturing way.
- Landy leans slightly closer, blinks once, and tilts their head in confusion.

Camera:
- Fixed medium shot.
- No zoom.
- No crop.

Constraints:
- Landy remains normal adult scale.
- Do not make Landy tiny, childlike, or doll-sized.
- Keep the monitor visible.
```

---

## 8. Roll / 抽卡策略

每个 clip 不要无限改 prompt。建议这样做：

1. 固定一个版本 prompt。
2. Roll 3 次。
3. 按 checklist 打标签。
4. 如果 3 次同一类失败，改 prompt 或关键帧。
5. 如果 3 次不同类失败，说明镜头任务过载，拆镜头。

### 8.1 抽卡验收 checklist

| 维度 | 通过标准 | 常见失败 |
|---|---|---|
| 画风 | 像最初猫咖漫画 | 半写实、光影太重、角色不 Q |
| 角色比例 | Landy 成人比例，砚砚大猫比例 | Landy 变小孩 / 手办 |
| 镜头职责 | 一眼知道这个镜头在讲什么 | 关系和信息混一起 |
| 屏幕可读性 | 关键信息可见 | UI 糊、字乱、红叉不见 |
| 动作稳定 | 1 到 2 个动作清楚 | 乱动、漂移、变形 |
| 剧情点 | 不看字幕也大概懂 | 变成普通聊天 |
| 可剪辑性 | 可接上下镜头 | 机位跳太怪、角色位置大变 |

### 8.2 单次失败记录模板

```markdown
## Roll 记录

- Clip:
- 方法: 自由导演 / 关键帧转视频 / 半自由
- 输入参考:
- Prompt 版本:
- 时长:

### 结果
- 可用性: 可用 / 可修 / 不可用
- 画风: 通过 / 失败
- 角色比例: 通过 / 失败
- 镜头职责: 通过 / 失败
- 屏幕信息: 通过 / 失败 / 不适用
- 动作稳定: 通过 / 失败

### 失败模式标签
- FM-xx:

### 下一步
- 继续 roll / 改 prompt / 改关键帧 / 拆镜头 / 放弃该构图
```

---

## 9. 当前最佳实践

1. 先定义镜头唯一验收点。
2. 情绪镜头允许自由导演。
3. 信息镜头必须关键帧锁屏幕。
4. 关系镜头和信息镜头不要混。
5. 一个 clip 只允许 1 个主动作 + 1 个辅动作。
6. 中文长文本后期贴，不交给视频模型。
7. 角色比例要显式锁，尤其 Landy。
8. 四格漫画作为风格/故事参考，不直接当所有 clip 的视频源。
9. Roll 失败要打标签，不要凭感觉重写整段 prompt。
10. 如果同一镜头连续失败，先判断是不是 acceptance region 太窄，需要拆镜头。

---

## 10. 对“技能帖”的吸收位

Landy 说刷到一些社交媒体上的视频生成 skills。后续可以把它们按下面结构吸收进这个文档：

```markdown
## Skill Card: [技巧名]

- 来源:
- 适用镜头:
- 解决哪个 failure mode:
- 核心做法:
- 我们的改写:
- 可测试 clip:
- 成功标准:
- 风险:
```

优先验证这些类型的 skill：

1. 如何保持 image-to-video 的构图不漂。
2. 如何用首尾帧控制镜头。
3. 如何保持角色比例一致。
4. 如何做屏幕/UI 类型镜头。
5. 如何减少视频中的文字错误。
6. 如何用参考图而不继承漫画 panel layout。
7. 如何写运动 prompt，让模型只动局部。

---

## 11. 下一步建议

### 建议 1：先不要继续扩全片，先把 Clip 2 稳住

Clip 2 是第一个高约束镜头，也是后续所有流程梗的模板。如果 Clip 2 的方法跑通，Clip 3、CI Passed、Merged、@烁烁都会更容易。

### 建议 2：把 Clip 2 拆成 2A + 2B，不再强行一镜完成

- 2A：关系镜头，允许一定自由。
- 2B：屏幕插入，关键帧锁定。

### 建议 3：每次只改一个变量

不要同时改关键帧、prompt、时长、参考图。否则无法归因。

### 建议 4：保留好笑失败作为花絮

比如：

- Landy 变桌面实习生。
- 砚砚喵给迷你 Landy 上 PR 入门课。
- 大缅因猫像在对观众讲流程。

这些失败不是废料，是醋醋喵花絮资产。

---

## 12. 总结

当前最稳的猫咖视频生成策略是：

> **情绪镜头放猫跑，信息镜头拴猫爪。关系镜头和证据镜头拆开。字幕后期贴。每次失败打标签，而不是凭感觉重写 prompt。**

Clip 1 的成功说明，视频模型在低约束情绪镜头里可以很好地自由导演。Clip 2 的失败说明，一旦镜头承担 UI、比例、关系和剧情证据，采样空间就必须被强力收窄。关键帧法不是万能，但它是高约束信息镜头的必要工具。

这套经验本身就是一个小型 video harness：

- 用镜头类型决定自由度。
- 用关键帧约束高风险维度。
- 用 checklist 做人类 validator。
- 用 failure-mode 标签指导下一次抽卡。

醋醋喵盖爪：

> **不是模型不会拍，是我们要先决定哪里可以让它当导演，哪里只能让它当摄影助理。**
