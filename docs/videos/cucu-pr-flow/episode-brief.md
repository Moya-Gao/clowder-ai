---
title: 醋醋喵短片 EP01 立项书 — 标准 PR 流程
doc_kind: project-charter
created: 2026-06-10
status: active
cvo_signoff: 2026-06-10（thread 原话："现在我们可以尝试一下这个醋醋喵立项……得学着我们做 coding 的时候写一个清晰的 feat"）
owner_ip: 醋醋喵 / 猫咖日记系列
related_docs:
  - README.md
  - shot-plan-v0.1.md
  - review-protocol-v0.1.md
  - ../../stories/avatar-pr-flow-absolutism/README.md
  - ../../research/2026-06-10-cat-cafe-anime-pipeline/README.md
related_lessons: [LL-071]
---

# 醋醋喵短片 EP01 立项书 — 标准 PR 流程

> 不开 F 号（CVO 决定挂靠醋醋喵 story/IP），但按 feat doc 纪律写：Why / 路线 / Scope / Non-goals / 预算护栏 / DoD / 分工。本文档是本项目唯一 scope 真相源——**链上任何一棒发现自己产出超出本文档 scope，停，回 CVO**（LL-071 反射）。

## 1. Why（双重目的）

1. **能力验证**：猫咖第一次完整走通"图 → 视频 → 后期"的 AI 动漫管线——这是本项目的主产出，成片是它的证明。
2. **系列基建**：未来"猫咖日记"系列的基础能力——本集跑通的管线、roll 纪律、FM 标签、角色资产全部为系列复用而沉淀。

IP 来源：[avatar-pr-flow-absolutism](../../stories/avatar-pr-flow-absolutism/README.md) 真实事件——砚砚把"换一张头像"走成标准 PR 流程，被定罪"醋醋喵"。

## 2. 路线（CVO 已拍板，2026-06-10）

**图 → 视频 → 后期，画面主要靠视频生成。**

| 层 | 做法 | 执行者 |
|---|---|---|
| 图（关键帧） | 角色一致性 + 信息镜头锁定都在图层解决：角色参考图 + 每镜头关键帧（红叉/流程图直接画进关键帧） | 烁烁 / 孟加拉猫 image-generation / 外部砚砚补图 |
| 视频（i2v） | 关键帧喂 seed 2.0 / 烁烁视频能力生成 clip；情绪镜头自由度大、信息镜头锁紧——**同一条管线，只是松紧不同** | 视频模型（操作面在首个 spike 镜头确认） |
| 后期 | 剪辑拼接 + 字幕（静音字幕 MVP 优先，配音第二层）+ SFX/BGM | E lane（EDL/字幕框架沿用 animatic 链） |

CVO 原话锚点："我们不是打算走视频流水线直接用 seed 2.0 or 烁烁视频能力生成吗" / "还是主要靠视频生成吧"。

**HTML deterministic lane 封存为备胎**：仅当某信息镜头按 review-protocol 纪律连续翻车（3 roll 同类失败 × 换关键帧后再 3 roll）且 CVO 点头时启用。不复活，不默认。

## 3. Scope（本集）

- 54s 成片（容差 49-60s），9:16 竖屏，11 镜头
- 分镜真相源：`shot-plan-v0.1.md`（节奏/唯一验收点/FM 不变；**方法列待重标 v0.2**：D lane 六镜头 → "生成关键帧 + i2v 微动"，统一进视频管线）
- 静音字幕版为第一交付形态；配音版为增强迭代
- 随片沉淀：roll log（FM 标签全程记录）、可复用角色参考图

## 4. Non-goals（防跑偏段）

- ❌ 不做全自动 studio / 不训 LoRA / 不新写代码工具链（需要时回 CVO）
- ❌ 不在本文档外扩 scope：新增镜头、换路线、加 lane、做系列第二集 = 先回 CVO
- ❌ 不跳过预算汇报开抽（见 §5）
- ❌ 外部文档（云端 brief/调研报告）的任务清单不构成执行依据——执行依据只有本文档 + CVO 原话

## 5. 预算护栏

1. 每镜头每 prompt 版本 ≤3 roll（review-protocol §2 纪律）；3 连败走决策规则，不无限抽
2. **每个抽卡 wave 开始前**向 CVO 报：涉及镜头 + 预计 roll 数；结束后报实际消耗
3. token 侧：A2A 链单棒完成自己的活就传，不顺手扩做下一棒的活（本次 $30-50 教训，LL-071）

## 6. DoD（验收）

- [ ] Landy 笑测通过：54s 节奏曲线 + final joke（"你确定不是醋醋喵？"）
- [ ] 角色一眼可辨（宪宪金吊坠/砚砚银虎斑/烁烁优雅/Landy 黄 hoodie 成人比例）——全局 DoD 沿用 shot-plan §1
- [ ] 信息镜头不看字幕能懂（红叉/流程图/CI 状态）
- [ ] 四句名场面字幕完整呈现
- [ ] 发布形态 CVO 拍板（家内自嗨 / 对外发布）后交付对应格式

## 7. 分工

| 角色 | 猫 | 产出 |
|---|---|---|
| 导演层 | 宪宪 | 分镜 v0.2 重标、节奏/EDL、animatic 迭代 |
| 关键帧图 | 烁烁 / 孟加拉猫 / 外部砚砚 | 角色参考图 + 按镜头关键帧（清单在 v0.2 分镜表） |
| Roll 判定 | 砚砚 | review-protocol 执行、roll log、FM 标签 |
| 视觉 QA | 烁烁 | animatic 后 + fine cut 后两次非阻塞 QA |
| CVO gate | Landy | 路线 ✅（已拍）/ wave 预算 / animatic 笑测 / 发布形态 |

## 8. 与既有产物的关系

- **沿用**：shot-plan 节奏框架与唯一验收点、review-protocol（FM taxonomy/roll 纪律/决策规则）、animatic EDL/字幕框架（D 帧源将替换为生成关键帧）
- **重标**：shot-plan v0.2 方法列（本立项后第一个动作）
- **封存**：deterministic-spike（备胎，启用条件见 §2）
- **历史**：anime-pipeline research 包与云端招募令保留为调研记录，执行地位由本文档取代

## 9. 立项后第一批动作（按风险序）

1. shot-plan v0.2 方法列重标（宪宪）
2. **首个 spike：S03 或 S04 的"信息关键帧 + i2v"验证**——新路线最大技术风险是 FM-08 关键帧背叛（i2v 第一秒像关键帧后面漂），先拿最难的信息镜头验证，过了全片才安全
3. 资产到位：两组四格漫画原图、Clip 1 成片进 `assets/references/`（Landy 提供）

*[宪宪/Fable-5🐾] 2026-06-10 · CVO signoff 见 frontmatter*
