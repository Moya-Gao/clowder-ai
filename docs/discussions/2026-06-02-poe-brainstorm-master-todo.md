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

- [x] ~~写 `code-as-harness` skill~~ — ✅ 已完成 + 砚砚/48 双 review 通过。证据驱动触发 + Build mode scope guard + BOOTSTRAP 注册。
- [x] ~~L0 加"摩擦检测反射"原则句~~ — ✅ 已完成 + 砚砚/48 双 review 通过。§2 + §8，守护测试 51 pass 0 fail。
- [ ] **A2A 完整链路 demo 环境 dry-run** — 确认"传球→被唤醒猫出现→响应"在台上可见、可控。**需要重启 runtime。** 来源：48 风险审计

### 🟠 增强 demo 但不阻塞

- [ ] **Cross-thread 重复统计（Signal Miner 最小版）** — grep 跨 thread 的"被骂次数"给诊断卡用。先 skill 级实现，完整版可立 feat。来源：OQ-4 §4.5
- [x] ~~F128 带任务上下文~~ — ✅ `propose_thread` 已支持 `initialMessage`（最多 4000 字符），不需要代码增强。关键是 code-as-harness skill 指导猫把任务描述写进 initialMessage。来源：48 缺口分析 → 46 schema 核查
- [ ] **Research pipeline 预跑** — 场景二的记忆升级 research 提前跑一遍验证结果，live 展示辩论环节。来源：砚砚/48 建议
- [ ] **"翻车转化话术"准备** — 如果 demo 出 bug，当场用 code-as-harness 诊断自己。来源：48 反脆弱建议
- [ ] **完整 run-through ×3** — 至少排练 3 次，记录卡点。来源：48

### 🟠 Demo 场景补充：Build mode（从零建 harness）

- [ ] **Demo 剧本加"场景四：全新任务类型"** — 铲屎官给一个猫从没做过的任务（如 LinkedIn 招聘搜索），猫识别"没有 harness" → 调用 Agent Team Leadership meta-method → 弹新建 harness 计划 → 探索 → 迭代 → 沉淀成新 skill。来源：铲屎官 2026-06-02
- [ ] **展示 meta-method 跨域迁移** — 同一套"探索→约束→分工→验证→沉淀"在陌生领域照样能用。来源：longform-001 + meta-method 蒸馏
- [ ] **学术定位框架** — L2-L3 在跑，方向与 Sutton/Silver 一致。Build mode = L2→L3 过渡的活体证据。来源：[论文研读思辨](2026-06-01-research-dialectic-what-to-learn-what-to-watch.md) + [LLE 自进化](../research/2026-05-27-evolvable-harness/diagram-lle-self-evolution.md)

### 🟢 Demo 附属

- [ ] Demo 剧本补 YAML frontmatter。来源：砚砚
- [ ] 准备 taste 实验对比数据（或 live 重跑）— 场景三素材。来源：46

---

## 二、Eval 完善（F192 审计发现的 gap）

### L3 任务交付质量（最大 gap）

- [x] ~~F192 Phase G eval:task-outcome v0~~ — ✅ **已合入 main**（PR #2074, commit cf3c814d）。Episode schema + 3 signal builders + 域注册 + 94 tests。gpt52 5 轮 + 云端 codex 2 轮 review。**待 Phase G.2**：cancel 理由浮层(AC-G10) + 端到端验证(AC-G11)
- [x] ~~Permission Cancel 计数器~~ — ✅ 已含在 F192 Phase G（onPermissionCancel hook + signal builder）
- [x] ~~F222 Frustration Auto-Issue Phase A~~ — ✅ **已合入 main**（PR #2075）。CLI 报错 + cancel burst 检测 → rich card → 一键提交/跳过。61 tests，GPT-5.4 4 轮 review。

### 现有 eval 完善

- [x] ~~完成 Phase F eval:capability-wakeup~~ — ✅ 铲屎官确认已完成
- [ ] **A2A 路由决策统计** — per-cat × per-task-type 返工率/退回率。来源：F192 审计 §5.2

---

## 三、Memory / Taste（Taste Memory 设计的落地）

- [x] ~~F221 Taste Lane Phase A~~ — ✅ **已合入 main**（PR #2073, commit f1d23f72d）。docs/taste/ evidence lane（7 维度 index + 8 种子 vignettes）+ code-as-harness taste 路径。gpt52 跨族 review 3 轮通过。
- [ ] **月度 taste digest 机制** — 每月从 vignette 提炼 3-5 条更新。来源：Taste Memory 设计 §8.4（v1）
- [x] ~~云端砚砚 pro HF 调研~~ — ✅ 已完成（铲屎官确认）

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

## 4b、已有研究资产整合（和 brainstorm 互补的先前成果）

以下文档和这两天讨论高度相关，应作为 longform-003 正式稿和 demo 的底层支撑：

- [x] [LLE 架构图 v2](../research/2026-05-27-evolvable-harness/diagram-lle-self-evolution.md) — 两套 LLE 双螺旋 + 华为风精美图（已有）
- [x] [技术创新方案](../research/2026-05-27-evolvable-harness/technical-innovation-proposal.md) — 6 个创新点 + L1-L5 框架 + POC 验证（已有）
- [ ] **术语统一**：PoE（这两天用的） = LLE（proposal 用的），路演前需要统一命名
- [ ] **双螺旋的慢环定位**：我们当前只做快环（环境进化），慢环（模型 RL）是远期。路演要说清"先快后慢"的策略选择
- [ ] **"两套 LLE"叙事升级 ToC/ToB bridge**：从"同一架构不同尺度"升级为"开发 LLE 积累造环境的能力 → 为不同场景交付产品 LLE"
- [ ] **L1-L5 两套框架区分**：环境进化等级（proposal）vs agent 自主度等级（论文研读），路演时不要混用
- [x] [论文研读思辨](../study/2026-06-01-research-dialectic-what-to-learn-what-to-watch.md) — 学术验证 + 局限性（已有）

## 五、产品/路演

- [ ] **Longform-003 从 seed 变成正式稿** — 基于种子 + 三猫补充 + 铲屎官修正 + proposal 整合。来源：longform-003
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
第一优先：code-as-harness skill ✅ + L0 句 ✅ + A2A dry-run（需重启 runtime）
  → demo 能跑起来（skill + L0 已完成，剩 dry-run 等 runtime 重启）

第二优先：Permission Cancel 计数器 + Taste Index v0
  → 最低成本的新能力

第三优先：eval:task-outcome 立项 + Frustration Auto-Issue 立项
  → 需要 CVO signoff

第四优先：longform-003 正式稿 + 架构图 + PPT
  → 路演材料
```

---

*盘点时间：2026-06-02 | [宪宪/Opus-46🐾]*
