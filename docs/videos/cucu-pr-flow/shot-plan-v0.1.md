---
title: 醋醋喵的标准 PR 流程 — Shot Plan
version: 0.2
doc_kind: shot-plan
created: 2026-06-10
updated: 2026-06-11
status: active
author: 宪宪/Fable-5
topics: [catcafe, short-animation, shot-plan, cucu-pr-flow, video-generation, image-to-video, keyframe]
related_features: [F138]
related_docs:
  - README.md
  - episode-brief.md
  - review-protocol-v0.1.md
  - assets/README.md
  - ../../research/2026-06-10-cat-cafe-anime-pipeline/2026-06-10-video-generation-failure-modes-v0.1.md
  - ../../stories/avatar-pr-flow-absolutism/README.md
---

# 醋醋喵的标准 PR 流程 — Shot Plan v0.2

> 11 镜头，目标成片 **55-60 秒**（9:16）。前半铺"流程即正义"的荒谬，中段错图打脸，后段状态机关枪加速，最后一镜定罪"醋醋喵"。
> **v0.2 路线（episode-brief §2，CVO 拍板）**：图 → 视频 → 后期，全片统一管线。原 D lane 的"确定性"由两层接管——**信息画进生成的关键帧（图层确定性）+ 精确节奏交给剪辑（E lane 确定性）**，i2v 只负责"活气"。一镜一梗不变。

## 0. 执行约定（怎么读这张表）

- **方法词汇**：
  - `i2v·T1` 自由导演（风格参考 + 简洁导演 prompt，允许模型切镜头）
  - `i2v·T2` 关键帧锁构图 + 极短动作 prompt（信息/证据镜头）
  - `i2v·T3` 关键帧锁比例（关系/反应镜头）——T1/T2/T3 定义在 failure-modes 文档 §7
  - `静帧+E` 生成静帧直接进剪辑轨（微 zoom/硬切/SFX 卡点），**不消耗 i2v 抽卡**
- **唯一验收点**：每镜头只有一个；roll 判定 = §1 全局 DoD 全过 **且** 唯一验收点过（review-protocol §1 八 gate）。
- **FM 编号**：canonical = failure-modes 文档 §3（FM-01..FM-11），review-protocol §0 已宣布。
- **画风 gate（FM-10）对照基准**：story 两组四格漫画（[01](../../stories/avatar-pr-flow-absolutism/assets/avatar-pr-flow-absolutism-01.png) / [02](../../stories/avatar-pr-flow-absolutism/assets/avatar-pr-flow-absolutism-02.png)）。
- **预算护栏**（episode-brief §5）：每镜头每 prompt 版本 ≤3 roll；每个抽卡 wave 开始前向 CVO 报量级。
- **HTML deterministic lane 已封存为备胎**（episode-brief §2 三道锁），本表不再含 D lane。

## 1. 全局 DoD（每个 roll 都查，来源：brief §12 + 漫画风格锚）

1. 画风贴四格漫画：暖猫咖光、chibi 粗描边、夸张表情、非半写实（FM-10）。
2. 角色 DNA：宪宪金吊坠+白手套+蓝双布偶；砚砚银虎斑大缅因+流程即正义桌牌；烁烁暹罗+夹板；角色真相源 = brief §3。
3. **Landy 永远成人比例**（FM-04）——四张已入库首帧全部正确，roll 后不许漂。
4. 单镜头电影语言，无漫画格/分屏（FM-05）。
5. 9:16 竖屏，底部留字幕空间。
6. 每镜头 ≤1 主动作 + 1 辅动作（FM-09）。
7. 每个 roll 落 roll log + FM 标签（review-protocol §4 模板）。

## 2. 分镜表 v0.2

| # | 拍点 | 时长 | 类型 | 方法 | 素材状态 | 唯一验收点 | 主 FM | 3 连败降级 |
|---|---|---:|---|---|---|---|---|---|
| S01 | 宪宪门口望眼欲穿（setup） | 6s* | 情绪 | ✅ 复用 Clip 1 | ✅ `S01-clip1-usable-v1.mp4`（10s，剪辑刀裁） | "想进门"的期待感一眼成立 | FM-10 | 已验证素材，不重 roll |
| S02 | 砚砚开讲"标准 PR 流程"（升级 1） | 6s | 关系 | i2v·T3 | ✅ 首帧 `S02-relation-firstframe-v1.png` | "一本正经讲大流程 vs Landy 困惑"气场反差成立（屏幕有流程感即可） | FM-04, FM-08 | 砚砚+屏幕单人镜，Landy 画外手/袖 |
| S03 | 流程图特写：`avatar.png→PR→CI→Review`（信息） | 4s | 信息 | i2v·T2 | ✅ 首帧 `S03-flowchart-firstframe-v1.png`（文字已画进图层） | 观众一遍看清四节点链路 | FM-08, FM-07 | 静帧+E 微 zoom（零抽卡 fallback）；再不行启用备胎需 CVO |
| S04 | PR #1 错图证据：左右对比+大红叉（twist） | 5s | 证据 | i2v·T2 | ✅ 首帧 `S04-evidence-firstframe-v1.png` ⚠️红叉已在首帧——"砸下"拍点改由切入瞬间 SFX duang 补；若笑测觉得没劲再补无叉首帧走首尾帧生成 | 不看字幕也知道"用错图了" | FM-08, FM-11 | 静帧+E（红叉常驻+SFX 卡点） |
| S05 | Landy 笑翻 / 砚砚僵住敲键盘（名场面 1） | 6s | 反应 | i2v·T3 | ✅ 首帧 `S05-reaction-firstframe-v1.png` | Landy 大笑 vs 砚砚僵住嘴硬的同框反差 | FM-09, FM-04 | 拆 Landy/砚砚单人镜各 3s（需补 2 张首帧） |
| S06 | CI Passed → Review ✅ → Merged 机关枪（升级 2） | 4.5s | 状态 | **静帧×3 + E 硬切** | ⬜ 待生成 3 张状态卡（信息密度低，好生成） | 三连卡**越来越快**的节奏荒谬感（1.6/1.3/1.0+0.6 剪辑卡点） | FM-07（图层内防） | 节奏是剪辑的活，无抽卡风险；卡不齐改等长+ding |
| S07a | "已取消"章 → "@烁烁"仍弹出（荒谬峰值） | 3s | 状态 | **静帧×2 + E 切** | ⬜ 待生成 2 张（章卡 / 章卡+chip 弹出） | 看懂"**取消了还在召唤**"（1.0 章 + 0.5 停顿 + pop 剪辑卡点） | FM-02 | 拆 3 卡各 1s |
| S07b | 烁烁优雅登场认真验收（喜剧呼吸） | 4.5s | 情绪/反应 | i2v·T1 | ⬜ 待生成首帧 ×1（烁烁+夹板+头像预览板，参考漫画格⑥） | 优雅郑重 vs "只是头像"的反差萌 | FM-10 | i2v·T2 锁角色 |
| S08 | 愿景守护 PASS 卡（deadpan） | 3s | 状态 | **静帧×1 + E 微 zoom** | ⬜ 待生成 1 张（参考漫画格⑧ PASS 构图） | "PASS"对一张头像郑重其事成立——冷面才好笑 | FM-07（图层内防） | 纯静帧硬切 |
| S09 | Landy 定罪定名"醋醋喵"（finale） | 7s | 反应/收束 | i2v·T3 | ⬜ 待生成首帧 ×1（两人同框：Landy 指着笑 / 砚砚别开视线，参考格④⑧内心 OS 的心虚感） | 不看字幕也懂"被定罪" | FM-04, FM-02 | 拆宣判/认栽单人镜（补 2 张首帧） |
| S10 | End card：流程要按风险缩放 + 醋醋喵爪章 | 5s | 结尾卡 | **静帧×1 + E 微动** | ⬜ 待生成 1 张（可参考 HTML spike S10 的版式：一行大字+爪章+一行小字） | 可截图传播 | FM-07（图层内防） | 纯静帧 |

\* S01 以现成素材为准。**时长合计 54s 目标（容差 49-60s）不变**。

## 3. 字幕 / 屏幕文字 / SFX 锚点表

台词真相源 = story README「名场面」；字幕全部 E lane 后期贴（animatic builder 的 `edl-v0.mjs` 已是此表的机器可读形态）。屏幕内文字责任从 "D lane 代码渲染" 改为 **"画进关键帧图层"**（生成时锚定，roll 验收查可读性）。

| # | 字幕（E lane） | 屏幕/画面内文字（图层责任） | SFX 锚点 |
|---|---|---|---|
| S01 | 无（氛围） | 门牌"猫咖接入中"（允许糊） | BGM 进，轻快 |
| S02 | 砚砚："先走标准 PR 流程。" | 屏幕流程剪影（不要求可读） | 键盘声、翻页声 |
| S03 | 无 | `avatar.png / PR / CI / Review`（首帧已画，必读） | 切入 pop |
| S04 | 无——证据自己说话 | 左"Landy 指定"/右"当前使用"+红叉（首帧已画，必读） | 切入瞬间红叉 **duang** |
| S05 | Landy："加个头像也要跑 CI？！"<br>砚砚："图片是二进制文件。" | 无要求 | 笑声起 + 急促键盘 |
| S06 | 无 | `CI Passed / Review ✅ / Merged`（3 张静帧，必读） | ding ×3 逐次加速 |
| S07a | 砚砚（画外）："召唤烁烁喵，视觉验收喵。" | "愿景守护：已取消" + "@烁烁"（静帧，必读） | 取消"咔" → 停顿 → 召唤"pop" |
| S07b | 无 | 无 | 优雅入场音 |
| S08 | 无——deadpan | "愿景守护 PASS"（静帧，必读） | 盖章 thunk，单声 |
| S09 | Landy："你确定不是醋醋喵？"<br>砚砚："证据链很不利于我。" | 无 | 拍桌 + 定格音 |
| S10 | 无 | "流程要按风险缩放" + 醋醋喵爪章（静帧，必读） | 收尾音落 BGM |

## 4. 节奏曲线 + 剪辑拍点（E lane 执行）

```text
setup        升级1      twist     笑点1     机关枪加速           峰值     deadpan  finale(最长hold)  card
S01──S02 │ S03──S04 │ S05    │ S06──S07a──S07b──S08 │ S09           │ S10
12s        9s         6s       15s                    7s              5s
慢─────────中─────────hold─────越──来──越──快──────────全片最长停留────收
```

一句话剪辑规则：**状态卡只许越来越快，反应镜头必须给笑声留足 hold。** 三个喜剧拍点按帧执行（v0.1 的 GSAP label 数字原样移交剪辑轨）：

- **S04**：切入 → 静止对比 0.8s（观众自己先看出来）→ 红叉 duang SFX 砸点 + 轻 shake（剪辑摇晃或保留静帧）→ hold。
- **S06**：CI Passed 1.6s → Review ✅ 1.3s → Merged 1.0s → 终帧 hold 0.6s。逐卡加速本身是梗。
- **S07a**："已取消"章 1.0s → **静止 0.5s（喜剧停顿，不许省）** → "@烁烁" pop → hold。

## 5. 素材需求汇总（关键帧生成 wave 的输入清单）

**已有 ✅（5）**：Clip 1 + S02/S03/S04/S05 首帧（账本见 [assets/README.md](./assets/README.md)）。

**待生成 ⬜（9 张静帧/首帧）**，owner 按 episode-brief §7（烁烁 / 孟加拉猫 / 外部砚砚）：

| 张数 | 用途 | 难度 | 风格参考 |
|---|---|---|---|
| 3 | S06 状态卡（CI Passed / Review ✅ / Merged） | 低（纯卡片+短英文） | HTML spike S06 版式 + 漫画格⑤ |
| 2 | S07a（愿景守护已取消章 / +@烁烁 chip 弹出） | 低 | HTML spike S07a 版式 |
| 1 | S07b 首帧（烁烁登场） | 中 | 漫画格⑥ |
| 1 | S08 PASS 卡 | 低 | 漫画格⑧ |
| 1 | S09 首帧（定罪同框） | 高（双角色比例+表情） | 漫画格③④⑦⑧ |
| 1 | S10 end card | 低 | HTML spike S10 版式 |

可选 +1：S04 无叉首帧（首尾帧生成"红叉砸下"动画用，第一抽不需要）。

## 6. 生产顺序 v0.2（含预算 gate）

1. **Wave K（关键帧生成）**：上表 9 张。低难度 7 张可批量；S09 单独精修。生成也走 roll 纪律（≤3 版/张，FM-10 对照漫画判）。
2. **Wave V-spike（首抽，预算 gate🔴：开抽前向 CVO 报量级）**：S03 + S04 各 ≤3 roll——新路线最大技术风险是 FM-08 关键帧背叛（i2v 第一秒像关键帧后面漂），拿最难的信息镜头先验证。**操作面（用哪个模型、谁执行）由 CVO 指路**——Clip 1 的成功通道在铲屎官手里。
3. **Animatic v1**：S03/S04 真素材 + 静帧卡 + Clip 1 + 占位（S02/S05/S07b/S09）重跑 animatic（builder 已支持，D 帧源换成生成素材即可）→ Landy 笑测。
4. **Wave V-main**：S05 → S02 → S09 → S07b（风险递进序不变）。
5. **Fine cut + 烁烁视觉 QA ×2**（非阻塞）。

## 7. 对 v0.1 的 delta（review 入口）

| 改动 | 理由 |
|---|---|
| D lane 六镜头全部改"生成关键帧 + i2v"或"静帧 + E 剪辑" | charter 路线：图→视频→后期，画面全部 AI 生成（CVO 原话锚定） |
| S06/S07a/S08/S10 降为静帧+剪辑，**不消耗 i2v 抽卡** | 状态卡的笑点是节奏，节奏是剪辑的活；信息确定性在图层解决 |
| S04 红叉拍点改 SFX 补偿，标注首尾帧备选 | 首帧红叉已存在，i2v 不会"消叉再砸"；省一张关键帧+一轮抽卡 |
| 新增素材状态列 + §5 需求清单（9 张待生成） | 关键帧生成 wave 的可执行输入 |
| 时长/节奏/唯一验收点/FM/字幕表全部不动 | v0.1 的导演层判断与新路线正交，验收体系沿用 |
| HTML spike 从 lane 降为版式参考 + 封存备胎 | episode-brief §2 三道锁 |

## 8. Open Issues

1. **Wave V 操作面**：用 seed 2.0 还是烁烁视频能力、谁执行抽卡（Clip 1 当时是铲屎官手抽）——Wave V-spike 前由 CVO 指路（charter §7 预留）。
2. ~~FM taxonomy 双轨~~ ✅ 已收口（review-protocol §0）。
3. BGM/SFX 素材来源——E lane 阶段定，duang/ding/pop/thunk 锚点表在 §3（已随 v0.2 更新图层责任）。
4. ~~CVO 审批~~ ✅ charter 已签（episode-brief frontmatter）。

---

*导演层 v0.2 by 宪宪/Fable-5🐾 · 2026-06-11 · 下一棒：Wave K 关键帧生成 + Wave V-spike 预算请示*
