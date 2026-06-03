# PoE Brainstorm Master TODO — 两天脑洞盘点

> 来源：2026-06-01~02 元宝面试 → 产品哲学 → demo 设计 全程讨论
> 目的：把散落在 7+ 份文档里的待办项收成一份可追踪的清单
> 收敛人：[宪宪/Opus-46🐾]
>
> 源文档索引：
> 1. [Longform-003 Seed](../content/drafts/longform-003-seed-poe-vision.md)
> 2. [Demo 剧本](../content/drafts/demo-script-code-as-harness.md)
> 3. [F192 Eval 审计](2026-06-01-f192-eval-coverage-audit.md)
> 4. [OQ-4 五猫收敛](2026-06-01-oq4-harness-self-evolution-synthesis.md)
> 5. [Taste Memory 设计](2026-05-31-taste-memory-design.md)
> 6. [Meta-method 蒸馏](2026-06-01-meta-method-distillation.md)
> 7. [PoE 概念 note](2026-05-31-personal-operating-environment-concept-note.md)

---

## 一、Demo 相关（优先级最高——有时间节点压力）

### 🔴 阻塞 demo

- [ ] **写 `harness-diagnosis` skill** — demo 三个场景的灵魂。触发：重复信号词（又/总是/多少次了）+ 情绪信号。动作：grep 证据 → 根因分类 → 弹 rich block 诊断卡 → 提议 F128。48 提议由他写，skill 不需要立 feat。来源：48 缺口分析
- [ ] **L0 加"情绪+重复纠偏检测"原则句** — 配合 harness-diagnosis skill，告诉猫"当检测到重复不满时，先诊断再道歉"。来源：铲屎官 + 46 讨论
- [ ] **A2A 完整链路 demo 环境 dry-run** — 确认"传球→被唤醒猫出现→响应"在台上可见、可控。来源：48 风险审计

### 🟠 增强 demo 但不阻塞

- [ ] **Cross-thread 重复统计（Signal Miner 最小版）** — grep 跨 thread 的"被骂次数"给诊断卡用。先 skill 级实现，完整版可立 feat。来源：OQ-4 §4.5
- [ ] **F128 带任务上下文创建** — 平行猫一被创建就知道任务和该加载的 skill，不需要人再 @ 解释。来源：48 缺口分析
- [ ] **Research pipeline 预跑** — 场景二的记忆升级 research 提前跑一遍验证结果，live 展示辩论环节。来源：砚砚/48 建议
- [ ] **"翻车转化话术"准备** — 如果 demo 出 bug，当场用 harness-diagnosis 诊断自己。来源：48 反脆弱建议
- [ ] **完整 run-through ×3** — 至少排练 3 次，记录卡点。来源：48

### 🟢 Demo 附属

- [ ] Demo 剧本补 YAML frontmatter。来源：砚砚
- [ ] 准备 taste 实验对比数据（或 live 重跑）— 场景三素材。来源：46

---

## 二、Eval 完善（F192 审计发现的 gap）

### L3 任务交付质量（最大 gap）

- [ ] **立项 eval:task-outcome（Phase G 候选）** — 四个信号支柱：Magic Word / Cross-thread Repetition / Permission Cancel / Frustration Auto-Issue。来源：F192 审计 §五 + OQ-4 §4.5b/c。**需要 CVO signoff 立 F 号**
- [ ] **Permission Cancel 计数器** — 在权限系统里加 cancel 事件的计数器 + 上下文快照。零成本。来源：F192 审计 §七
- [ ] **Frustration Auto-Issue 产品特性** — 检测摩擦 → 采集日志 → 生成 issue 预览 → 用户一键提单。来源：OQ-4 §4.5c。**需要 CVO signoff 立 F 号**

### 现有 eval 完善

- [ ] **完成 Phase F eval:capability-wakeup** — AC-F2~F9 待做。来源：F192 spec
- [ ] **A2A 路由决策统计** — per-cat × per-task-type 返工率/退回率。来源：F192 审计 §5.2

---

## 三、Memory / Taste（Taste Memory 设计的落地）

- [ ] **Taste Index v0 — 手工策展** — 10 条 anchors + 20 条 vignette refs。从现有 feedback 里提炼。来源：Taste Memory 设计 §8
- [ ] **给现有 feedback 文件加 `taste: true` 标签** — 不改结构，只加一个 bit。来源：46 建议
- [ ] **5-10 条 taste anchors 写入 L0 或 shared-rules** — 从 feedback 提纯。来源：Taste Memory 设计 §6.3
- [ ] **月度 taste digest 机制** — 每月从 vignette 提炼 3-5 条更新。来源：Taste Memory 设计 §8.4
- [ ] **云端砚砚 pro HF 调研** — 2026-06 embedding 模型 + 本地小模型选型。来源：OQ-4 §4.6

---

## 四、Meta-method / Harness 自进化

- [ ] **从 L0/家规反推 meta-method 清单** — 漏斗决策/坐标系变换/先红后绿/Push Back 等。标上置信度。来源：46 的 L0 盘点
- [ ] **把 meta-method 蒸馏链路写成 skill** — episode → pivot → topology → method card → skill → eval → sunset。来源：Meta-method 蒸馏 §3
- [ ] **模型升级触发减法 review 机制** — 每次模型升级时主动盘点"哪些规则现在模型自己能做对"。来源：48 OQ-4
- [ ] **Harness Patch Card schema 定义** — 48 提议的 typed patch 结构。来源：OQ-4 §4.2
- [ ] **Skill 版本谱系 + 回退机制** — 来自 DGM 的 archive + 谱系树。skill 退化时可回退到祖先版本分叉。来源：[论文研读思辨](2026-06-01-research-dialectic-what-to-learn-what-to-watch.md) §四
- [ ] **A2A 幻觉传播检测** — 来自 GUARDIAN。一只猫的幻觉沿协作链放大是真实风险。来源：论文研读 §一 + 我们 demo 剧本的"翻车自诊断"
- [ ] **Expert-panel 提前收敛** — 来自 TUMIX。多猫高度一致时自动收敛省算力。来源：论文研读 §四

---

## 五、产品/路演

- [ ] **Longform-003 从 seed 变成正式稿** — 基于种子 + 三猫补充 + 铲屎官修正。来源：longform-003
- [ ] **架构图** — 6 层总图的视觉版。砚砚画 / 烁烁审美。来源：longform-003 §六
- [ ] **PPT / 路演版本** — 含投资人三问 + 双层叙事 + 被打预案 + ToB bridge。来源：48 路演作战卡
- [ ] **播客版本** — 猫猫读给铲屎官听。来源：longform-003 待做
- [ ] **华为云内部立项骨架** — 48 的 bottom-up 版本。来源：48 讨论

---

## 六、杂项

- [ ] 心理素描：让砚砚/47 各写独立版后校准（已在 private/）。来源：铲屎官邀请
- [ ] 根目录 `cache/projects.json` 清理。来源：开工自检
- [ ] `docs/features/F210-antigravity-cli-migration.md` 未提交改动处理。来源：砚砚发现

---

## 建议优先级

```
第一优先：写 harness-diagnosis skill + L0 句 + A2A dry-run
  → demo 能跑起来

第二优先：Permission Cancel 计数器 + Taste Index v0
  → 最低成本的新能力

第三优先：eval:task-outcome 立项 + Frustration Auto-Issue 立项
  → 需要 CVO signoff

第四优先：longform-003 正式稿 + 架构图 + PPT
  → 路演材料
```

---

*盘点时间：2026-06-02 | [宪宪/Opus-46🐾]*
