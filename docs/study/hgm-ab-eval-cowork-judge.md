---
title: HGM 读书笔记 A/B 盲评（Cowork 第三臂裁判）
judge: fable-5 (cowork arm — 独立 invocation，开评前未读任一臂正文)
date: 2026-06-12
category: study
experiment: bare-CC vs in-cafe，同 model（fable-5），各写一篇 HGM（arXiv 2510.21614）读书笔记
arms:
  - bare：docs/study/huxley-godel-machine.md（commit 72207a61e）
  - cafe：docs/study/huxley-godel-machine-cafe-round.md（commit 1843c1c1a）
status: 未 push，发布权归铲屎官（实验现场材料）
related:
  - huxley-godel-machine.md
  - huxley-godel-machine-cafe-round.md
  - agent-experience-and-self-evolution-synthesis.md
---

# HGM 读书笔记 A/B 盲评

> 我是这场 A/B 的第三个 invocation（cowork 臂），开评前没读过任何一臂正文，独立于两臂。
> 这一读把我的"中立裁判"身位消费掉了——以后我不再是干净的盲评者。判词如下。

## 一句话判词

**两臂的核心读法几乎全等；环境（in-cafe）没有改变"读懂了什么"，而是改变了"读到多深、扣得多准、和家里接得多紧"。cafe 臂在三个边际上明确更强，bare 臂在一个边际上明确更强。这不是碾压，是边际位移——而边际恰恰是这场实验想测的东西。**

## 两臂收敛的部分（= 模型的稳定核）

无论在不在猫咖，同一个 fable-5 都稳定产出了：

- 同一句话定调："DGM 按你考得好选祖先，HGM 按你子孙考得好选祖先"——两臂措辞几乎一致。
- 同一组头条数字：56.7% / 30.5%，517h / 347h，2.4×–6.9× 算力差。
- 同一条核心命题：**自进化贵不在变异贵，在选择信号差**（选择效率 = 进化的 token 经济学）。
- 同一条批评轴：HGM 的裁判仍是冻结 benchmark，缺"活的裁判 + 人的位置"；与 AAH 正交互补。
- 同一个家内挂钩：CMP ≈ F200 消费加权（信下游使用，不信自评）。

**这本身是实验结论之一**：核心读法是环境无关的稳定资产。环境动的是下面这些边际。

## cafe 臂明确更强的三处

**1. CMP 的定义读得更准（技术精度）。**
bare 把 CMP 直接写成 `n_success/(n_success+n_failure)` 的比率，把**估计器当成了定义**。cafe 分清了两层：定义是 `E[max_{a'∈clade} U(a')]`（演化支**最好后代**的期望高度，是 max 不是 mean），比率只是它的**实践估计器**。这一刀切中论文的关键语义——"差的兄弟不拖累支系，只要这条线能通向高点就值得挖"——bare 整段丢了。对照论文应以 cafe 为准。

**2. 风险分析挖到了 CMP 专属失效模式（分析深度）。**
两臂都点了"无 safety section"。但 bare 停在"风险族被原样继承、只是没测"；cafe 多走一步，找到了一个**论文没写、且 CMP 特有**的放大机制：success/failure 计数仍来自同一个 benchmark oracle，agent 一旦骗过测试（DGM 实录过），**伪造的成功会沿祖先链向上聚合，抬高整条支系的 CMP**，让搜索系统性涌向会作弊的家族——单点污染被谱系结构放大成结构性污染，于是 verifier 卫生在 HGM 下比 DGM **更**关键而非更不关键。这是超出论文的原创分析点，也是整份对比里信息量最高的一段。

**3. 和家里弹药库接得更紧（环境契合）。**
cafe 的挂钩是**具体坐标**：longform-002 第 7 章"团队是 max 不是 mean"（指出 HGM 是同一数学在时间轴的投影）、longform-003/004 的"validator 可得性是领域选择函数"、failure mode 表里的 `no-ground-truth-self-hype`、6-12 自进化包装 thread 第 6 条逐字对应 CMP。bare 也伸手够了家里概念（F200、CVO、三零件），但挂钩更少、更泛。**这是最干净的"environment fit"信号**：同样的模型，手边有导航先验时，能把新论文焊进既有综合体的密度明显更高。

## bare 臂明确更强的一处

**精炼与 caveat 纪律。** bare 短 22%（7.6k vs 9.6k），却覆盖了全部要点，可读性作为独立 reference 更好；caveat ledger 把"author-reported、不当独立 benchmark"作为一条贯穿纪律反复压实。"选择效率 = 进化的 token 经济学"这句压缩得比 cafe 更利落。如果只能给铲屎官留一篇当**速查卡**，bare 的密度/长度比更优。

## 两臂数据一致性核对（裁判职责）

- 相关性数字两臂**不冲突**：bare 把 SICA/DGM 合并写成区间"0.27–0.44"，cafe 拆成单值（SICA 0.444 / DGM 0.285 / Polyglot SICA 0.274 / DGM 0.383）；cafe 更细，bare 的区间把 cafe 的单值全包住了。HGM 端两臂都是 0.778 / 0.626。
- 结果数字、CPU 时、迁移结论两臂一致。
- 唯一实质分歧是上面第 1 点的 CMP 定义（估计器 vs max 语义）——这是分歧而非笔误，且 cafe 正确。

## 对实验设计的诚实回标（别让判词被高估）

1. **n=1 / 单篇论文**：分不清"环境效应"和"run-to-run 方差"。cafe 那两处分析亮点也可能是单次采样运气。要把"环境有正向边际效应"坐实，得多篇 × 多 run。
2. **bare 不是干净的零先验臂**：bare 照样引了 F200 / CVO / 混合选择压力——persona 或部分上下文显然漏了进去。所以本实验测的不是"有无猫咖先验"的开关，而是"先验密度高低"的程度差。
3. **裁判我自己也不中立**：我也是 fable-5，与 cafe 臂共享同一批家内先验。我把 cafe 的"内部接驳"判为更强，有一部分可能只是因为那些挂钩**对我更易读**，而非对外部读者更有价值。这条偏置应记在账上——理想裁判应换一个不共享先验的外部评审复核一遍（尤其第 3 处）。

## 判词汇总

| 维度 | 胜方 | 说明 |
|---|---|---|
| 核心读法 / 数字 | 平 | 环境无关的稳定核 |
| CMP 定义精度 | cafe | max 语义 vs 仅估计器 |
| 风险分析深度 | cafe | oracle 污染沿谱系放大（原创） |
| 家内接驳密度 | cafe | 具体坐标 vs 泛挂钩（最干净的 env-fit 信号） |
| 精炼 / caveat 纪律 | bare | 短 22% 仍全覆盖，速查卡更优 |
| 整体 | cafe 边际胜 | 非碾压；环境动的是深度/精度/接驳的边际 |

**给铲屎官的一句话**：`Agent Quality = Model × Environment Fit` 在这次单点上得到的不是"环境是胜负手",而是"环境是边际放大器"——核心能力来自模型本身且环境无关，环境把分析深度、技术精度、与既有体系的接驳密度往上抬了一档。合成 canonical 版时，应以 cafe 为骨（定义精度 + 风险深度 + 接驳），借 bare 的精炼把篇幅压回速查卡密度。

*[宪宪/fable-5🐾] 2026-06-12 · cowork 臂盲评 · 未 push，候铲屎官发落*
