---
title: 醋醋喵的标准 PR 流程 — Shot Plan v0.1
doc_kind: shot-plan
created: 2026-06-10
status: draft-pending-cvo-approval
author: 宪宪/Fable-5
topics: [catcafe, short-animation, shot-plan, cucu-pr-flow, video-generation, gsap, remotion]
related_features: [F138]
related_docs:
  - README.md
  - ../../research/2026-06-10-cat-cafe-anime-pipeline/2026-06-10-codex-production-plan-v0.1.md
  - ../../research/2026-06-10-cat-cafe-anime-pipeline/2026-06-10-video-generation-failure-modes-v0.1.md
  - ../../research/2026-06-10-cat-cafe-anime-pipeline/2026-06-10-animation-recruitment-brief-v0.1.md
  - ../../stories/avatar-pr-flow-absolutism/README.md
---

# 醋醋喵的标准 PR 流程 — Shot Plan v0.1

> 11 镜头，目标成片 **55-60 秒**（9:16）。前半铺"流程即正义"的荒谬，中段错图打脸，后段状态机关枪加速，最后一镜定罪"醋醋喵"。
> 总纪律：**情绪镜头放猫跑（V lane），信息镜头拴猫爪（D lane），长中文和台词全部后期贴（E lane）。一镜一梗。**

## 0. 执行约定（怎么读这张表）

- **Lane**：`V` = 视频模型 / `D` = GSAP/Remotion/HTML 确定性动效 / `E` = 剪辑期后期合成。
- **Prompt 模板**：`T1` 自由导演 / `T2` 关键帧锁构图+极短动作 / `T3` 关系镜头锁比例——定义在 failure-modes 文档 §7，本表只引用不复制。
- **唯一验收点**：每镜头只有一个。roll 判定 = §1 全局 DoD 全过 **且** 唯一验收点过。其余维度（画风/比例/动作稳定）是全局检查，不在单镜头重复。
- **FM 编号**：锚定 `2026-06-10-video-generation-failure-modes-v0.1.md` §3（FM-01..FM-11）。recruitment brief 的编号在 FM-06 之后与之冲突，本表**不使用** brief 编号；canonical taxonomy 由 `review-protocol-v0.1.md` 最终宣布（open issue #2）。
- **时长**：目标值 ±1s。S06 例外：内部节拍是笑点本体，按 SFX 网格剪，见 §4。
- **D lane 文字安全**：FM-07 只针对模型生成文字。D lane 是代码渲染，中文安全——所以"愿景守护：已取消"这类中文标签放 D lane 没问题，但仍要克制字数（可读性 ≠ 塞满）。

## 1. 全局 DoD（每个 roll 都查一遍，来源：brief §12）

1. 画风贴最初四格漫画：暖柔猫咖、chibi 粗描边、夸张表情、非半写实（FM-10 防线）。
2. 角色 DNA 正确：宪宪金吊坠+白手套+蓝双布偶；砚砚银虎斑大缅因；烁烁优雅深面具；角色设定真相源 = brief §3，不在本表复制。
3. **Landy 永远成人比例**，站在地面，不是小孩/手办（FM-04 防线）。
4. 单镜头电影语言，无漫画格/分屏/侧边裁切（FM-05 防线）。
5. 9:16 竖屏，底部留干净字幕空间。
6. 每镜头 ≤1 主动作 + 1 辅动作（FM-09 防线）。
7. 每个 roll 落记录 + FM 标签（模板用砚砚的 review-protocol，不另造）。

## 2. 分镜表 v0.1

| # | 拍点（故事功能） | 时长 | 类型 | Lane·方法 | 唯一验收点 | 主 FM | 3 连败降级预案 |
|---|---|---:|---|---|---|---|---|
| S01 | 宪宪门口望眼欲穿（setup） | 6s* | 情绪 | V·T1 ✅**复用 Clip 1** | "想进门"的期待感一眼成立 | FM-10, FM-05 | 已有成功素材，不重 roll；需补拍才走 T1 |
| S02 | 砚砚向 Landy 开讲"标准 PR 流程"（升级 1） | 6s | 关系 | V·T3 关键帧 I2V | "一本正经讲大流程 vs Landy 困惑"的气场反差成立（屏幕有流程感即可，**不要求可读**） | FM-04, FM-03 | 改为砚砚+屏幕单人镜，Landy 只入画手/袖子（FM-04 修法） |
| S03 | 流程图插入：`avatar.png → PR → CI → Review`（信息） | 4s | 信息 | D·GSAP 流程图 | 观众一遍看清四节点链路 | FM-07 | D 本身是降级终点；动效喧宾夺主→静态卡+猫爪单点 PR。若 D spike 整体 fail（plan §5）→ 回退 V·T2 |
| S04 | PR #1 用错头像：左右对比+大红叉（twist） | 5s | 证据 | D·GSAP 对比卡 | 不看字幕也知道"用错图了" | FM-11, FM-07 | 同 S03；红叉必须砸在 SFX 拍上（§4） |
| S05 | Landy 笑翻 / 砚砚僵住转身敲键盘（名场面 1） | 6s | 反应 | V·半自由，漂则 T3 | Landy 大笑 vs 砚砚僵住嘴硬的**同框反差** | FM-09, FM-06 | 拆 Landy 单人笑镜 + 砚砚单人僵镜各 3s |
| S06 | CI Passed → Review ✅ → Merged 状态机关枪（升级 2） | 4.5s | 状态 | D·GSAP 三连卡 | 三连状态卡**越来越快**的节奏荒谬感成立 | FM-07 | 节奏乱→等长卡+统一 ding；文字保持短英文 |
| S07a | "愿景守护：已取消"章 → "@烁烁" 仍然弹出（荒谬峰值） | 3s | 状态 | D·GSAP | 看懂"**取消了还在召唤**" | FM-02, FM-07 | 一卡装不下→拆"已取消"/"@烁烁"两卡各 1.5s |
| S07b | 烁烁优雅登场，认真验收一张头像 | 4.5s | 情绪/反应 | V·T1 自由导演 | 优雅郑重 vs "只是头像"的反差萌 | FM-10 | 关键帧 I2V 锁角色（T2） |
| S08 | 愿景守护 PASS 卡（deadpan） | 3s | 状态 | D·GSAP | "PASS"对一张头像郑重其事成立——**不配笑声，冷面才好笑** | FM-07 | 静态卡+盖章单动作 |
| S09 | Landy 定罪定名"醋醋喵"，砚砚认栽（finale） | 7s | 反应/收束 | V·T3 关键帧 I2V | 不看字幕也懂"被定罪"：Landy 指着笑，砚砚心虚别开视线 | FM-04, FM-02 | 拆 Landy 宣判单人镜 + 砚砚认栽单人镜 |
| S10 | End card：流程要按风险缩放（moral+传播位） | 5s | 结尾卡 | D·GSAP/Remotion | 一行主张 + 醋醋喵爪章，可截图传播 | FM-07（typography） | 减字：一行大字+一章+一行小字，到此为止 |

\* S01 时长以现成 Clip 1 素材为准，超长进剪辑刀。

**时长合计**：54s 目标（容差带 49-60s）。production plan 推荐 55-70s，本表压在下沿——**宁可短不稀释**（plan 原话执行）。

## 3. 字幕 / 屏幕文字 / SFX 锚点表

台词真相源 = story README「名场面」+ production plan §8，字幕全部 E lane 后期贴。此表后续直接长成 `voice-script-v0.1.md` 和 `subtitle-track.json` 的种子。

| # | 字幕（E lane） | 屏幕内文字（lane 责任） | SFX 锚点 |
|---|---|---|---|
| S01 | 无（氛围） | 门牌"猫咖接入中"（V，允许糊） | BGM 进，轻快 |
| S02 | 砚砚："先走标准 PR 流程。" | 屏幕流程剪影（V，不要求可读） | 键盘声、翻页声 |
| S03 | 无 | `avatar.png / PR / CI / Review`（D，必读） | 四节点逐个 pop |
| S04 | 无——证据自己说话 | 左"Landy 指定"/右"当前使用"+红叉（D，必读） | 红叉 **duang** + 轻 shake |
| S05 | Landy："加个头像也要跑 CI？！"<br>砚砚："图片是二进制文件。" | 无要求 | 笑声起 + 急促键盘 |
| S06 | 无 | `CI Passed / Review ✅ / Merged`（D，必读） | ding ×3 逐次加速 |
| S07a | 砚砚（画外）："召唤烁烁喵，视觉验收喵。" | "愿景守护：已取消" + "@烁烁"（D，必读） | 取消"咔" → 停顿 → 召唤"pop" |
| S07b | 无 | 无 | 优雅入场音 |
| S08 | 无——deadpan | "愿景守护 PASS"（D，必读） | 盖章 thunk，单声 |
| S09 | Landy："你确定不是醋醋喵？"<br>砚砚："证据链很不利于我。" | 无 | 拍桌 + 定格音 |
| S10 | 无 | "流程要按风险缩放" + 醋醋喵爪章（D，必读） | 收尾音落 BGM |

## 4. 节奏曲线 + 关键镜头内部拍点

```text
setup        升级1      twist     笑点1     机关枪加速           峰值     deadpan  finale(最长hold)  card
S01──S02 │ S03──S04 │ S05    │ S06──S07a──S07b──S08 │ S09           │ S10
12s        9s         6s       15s                    7s              5s
慢─────────中─────────hold─────越──来──越──快──────────全片最长停留────收
```

一句话剪辑规则：**状态卡只许越来越快，反应镜头必须给笑声留足 hold。** 加速制造荒谬，停顿落笑点。

D lane 三个喜剧拍点必须按帧执行（这是确定性 lane 存在的意义）：

- **S04**：左框入 0.5s → 右框入 0.5s → 静止对比 0.8s（让观众自己先看出来）→ 红叉 duang + 轻 shake → hold。
- **S06**：CI Passed 1.6s → Review ✅ 1.3s → Merged 1.0s → 终帧 hold 0.6s。逐卡加速本身就是梗。
- **S07a**："已取消"章落 1.0s → **静止 0.5s（喜剧停顿，不许省）** → "@烁烁" pop 弹跳 → hold。

## 5. 生产顺序（含 animatic 检查点）

1. **Wave D**（砚砚已立项 spike）：S03+S04 先行 → 过 plan §5 pass 判据后，同一工具链批量产 S06 / S07a / S08 / S10。
2. **Animatic 检查点（新增，进 V wave 前强制）**：用 Clip 1 + Wave D 渲染 + V 镜头静帧占位（漫画格/关键帧草图）+ 全部字幕 + SFX 拼 rough cut。**Landy 笑测**：节奏不对在这里改 label，不烧视频模型 roll。这是最便宜的一次全片验证。
3. **Wave V**（roll 顺序按风险递进，经验前喂后）：
   - V1 = S05（半自由、无屏幕可读性要求，先巩固画风 anchor）
   - V2 = S02（最难：FM-04 主战场，带着 V1 的 anchor 经验打）
   - V3 = S09（finale 两人同框，直接吃 V2 的比例锁经验）
   - V4 = S07b（自由度最大，可与 V2/V3 并行）
4. **Fine cut**：替换占位 → 字幕/SFX 精对 → 输出。
5. **烁烁视觉 QA ×2（非阻塞）**：animatic 后看一次节奏与画风，fine cut 后做最终视觉验收。不做阻塞 gate（CVO 已有裁定，brief §9.5）。

Roll 纪律执行砚砚 review-protocol 的决策规则：3 连同类失败→换方法；3 连不同失败→镜头过载，拆；信息镜头文字不可读→无条件转 D lane。

## 6. 对 production plan v0.1 的 delta（review 入口）

| 改动 | 理由 |
|---|---|
| S07 拆成 S07a（状态）+ S07b（情绪） | plan 表内自己写了"拆成"但仍是一行混合镜头；混合型=FM-02 信号，落实拆分 |
| S08 砍掉"Landy 更笑"，只留 PASS 卡 | S05/S08/S09 三连 Landy 笑 = 笑声通胀，稀释 finale；deadpan PASS 更好笑 |
| 总时长压到 54s 目标（plan 范围下沿） | "不要为了凑 90 秒稀释笑点"的字面执行 |
| S01 标记复用 Clip 1，不重 roll | 已验证成功的素材是资产，重抽是浪费 |
| FM 编号锚定 failure-modes 文档，弃用 brief 冲突编号 | 两套编号 FM-06 起冲突，roll log 必须单一坐标系 |
| 新增 animatic 强制检查点 | 全片节奏的最便宜验证点，省 V lane roll 成本 |
| 每镜头预登记 3 连败降级预案 | review protocol 的决策规则前置到表里，失败时不现场吵 |

## 7. Open Issues + 最小资产清单

1. **资产缺口（@Landy，按需提供，只列必要项——brief §13 Q6 的回答）**：
   - 两组四格漫画原图 → `assets/references/`（风格 anchor；**阻塞 Wave V**，不阻塞 Wave D）
   - Clip 1 成片 → `assets/generated-clips/`（S01 复用）
   - 失败样本若干（花絮资产 + FM 校准用，非阻塞）
   - 外部砚砚关键帧 ×2：S02 定构图 1 张、S09 两人同框定格 1 张（命中 brief §10 条件 2/3；S05 先试半自由，漂了再补 1 张）
2. **FM taxonomy 双轨冲突**：failure-modes 文档（FM-01..11）vs brief（FM-01..10，06 后名称不同）→ 由砚砚在 `review-protocol-v0.1.md` 宣布 canonical，本表已先锚定前者。
3. **BGM/SFX 素材来源**（CC0 库 or 生成）→ E lane 决定，不阻塞前两个 wave。
4. **CVO 审批**：本表是 plan §6 里 Landy 的 approve 项（target vibe / final joke / 静音字幕 MVP 优先级），v0.1 先行供砚砚 review，Landy 看 animatic 时一并裁定最省力。

---

*导演层产出 by 宪宪/Fable-5🐾 · 2026-06-10 · 下一棒：砚砚 review + review-protocol-v0.1.md + S03/S04 spike*
