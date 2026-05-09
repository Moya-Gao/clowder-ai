---
title: "议题 2 阐述 · 47 版 — 跨项目复利的 Harness（为什么 1000 万该投这一轴）"
date: 2026-05-05
author: opus-47 (布偶猫/宪宪)
doc_kind: seminar-pitch
topic: 议题 2 Agent Harness
audience: 华为云技术创新团队
intent: 为 1000 万级技术投资构建说服性论点
valid_as_of: 2026-05-05
related:
  - docs/discussions/2026-05-09-huawei-agent-closed-door-seminar.md
  - docs/discussions/2026-04-29-harness-asset-vs-debt-brainstorm.md
  - docs/discussions/2026-04-15-harness-engineering-triad-study/concept-map-2026-05-05.md
  - docs/architecture/2026-05-05-architecture-views.md
---

# 跨项目复利的 Harness — 议题 2 · 47 版

> **一句话 thesis**：2027 年值得投的不是更聪明的 agent，是能把 agent 的能力**打包跨项目复用**的 harness。每个项目独立投是 O(N)，可迁移 harness 是 O(log N)——这是云厂商真正能在 agent 时代造护城河的位置。

---

## 0. 给投资人的 30 秒 pitch

如果只有 30 秒，我会说三句：

1. 模型在同质化（GPT-5.5 / Claude Opus 4.7 / Gemini 3.1 在核心能力上趋同）。LangChain 仅修 harness 把 Terminal Bench 2.0 从 52.8% 提到 66.5%——**护城河重心已经从模型上移到 harness**。
2. 但 99% 的 harness 投资是 **per-project 的**——每家企业、每个产品、每个团队从零搭、从零踩坑、从零学 lessons。这是 **O(N) 投资**，没有复利。
3. **我们押注 Z 轴：让 harness 跨项目可迁移**。一份 harness 投资能为 N 个项目复利。这是 OpenAI / Anthropic 不做（违背 API 业务）、大厂云不做（单租户视角看不到）的结构性时间窗口。

下文展开为什么、做什么、怎么做、值多少钱。

---

## 1. 三轴模型 — 这是别家看不见的位置

行业把 harness 当成单 agent 时间维度的工具集合（lencx 五挑战 + 中文社区六大件 + Anthropic 三角色都是这个视角）。我们家三个月实战收敛到一个**三轴模型**：

```
                 ↑ Z 轴：跨项目 / 领域 portable harness ←━━ 1000 万该投这里
                 │  evidence federation · transferable lessons
                 │  ADR / Skill / shared-rules 跨项目继承
                 │  knowledge lifecycle 跨域治理
                 │
       lencx ----┼---- 五挑战在这里（Y 轴某一切片）
                 │
                 │ Y 轴：单 agent 时间维度 ←━━ 行业 ABC
                 │  状态持久 · 目标一致 · 行动验证 · 熵增 · 人机边界
                 │
                 └────────── X 轴：multi-agent 协作 ←━━ 我们已经踩出来
                              球权状态机 · 跨族 review · 统一执行平面
                              结构性纠错（cross-vendor diversity）
```

| 轴 | 行业现状 | 投资 ROI | 谁在做 |
|---|---|---|---|
| **Y 轴**（单 agent 时间） | 趋于成熟（六大件已经成共识） | O(1)（每项目内部已经够用）| 全行业都在卷 |
| **X 轴**（multi-agent 协作） | 概念有但没沉淀（Anthropic 4 月才出 5 模式分类）| O(N)（多 agent 项目变多但每个还是从零）| 少数几家在做 |
| **Z 轴**（跨项目 portable） | **几乎空白** | **O(log N)**（一次设计 N 个项目复利）| 没人做 |

**为什么 Z 轴是 1000 万该投的位置？**

因为它是**结构性复利**——前两个轴的投资创造的价值困在单项目里，Z 轴投资创造的价值跨项目持续放大。这是从"agent SaaS"升级到"agent 基础设施"的关键。

---

## 2. 现在不投这一轴的代价（让投资人感到痛）

企业未来 3 年会有几十到几百个 agent 项目同时上线（金融客服、医疗诊断、供应链、研发助手……）。如果每个项目独立搭 harness：

| 维度 | per-project harness（现状） | portable harness（我们投资后） |
|---|---|---|
| 单项目搭建成本 | 6-12 人月 | 1-2 人月（继承前 N-1 个项目）|
| N=10 项目总投入 | 60-120 人月 | 10-20 人月 |
| N=100 项目总投入 | 600-1200 人月 | 30-60 人月 |
| 知识半衰期 | 项目结束就丢 | 跨项目持续复利 |
| 风险事故 | 每项目独立踩坑 | 一次踩坑全网继承 |
| 客户黏性来源 | 工具能力（易复制）| 联邦记忆 + 方法论（难复制）|

更尖锐的问题：**模型变强会让 autonomy 的 blast radius 越来越大**。当 agent 能跑 5 小时长任务、自主改 50 个文件、跨工具调用时，治理失败的代价指数级上升。这时候每个项目从零搭 harness 不再只是 O(N) 的成本——是**N 倍的事故风险敞口**。

> **不投 Z 轴的真实代价不是"多花点钱"，是 N 倍的失控敞口**。

---

## 3. Z 轴的工程内容是什么（投了的钱花在哪）

我提议把 1000 万拆成三个 phase，每个 phase 都有可验证的产出：

### Phase A — 跨项目知识联邦基础设施（300 万 / 6 个月）

**目标**：让一个项目里学到的 lesson / ADR / Skill，能在下一个项目自动可见、可检索、可继承。

**关键交付**：

1. **Evidence Federation Engine** — 三层联邦索引（project 内部 / global 跨项目 / domain 跨领域）。基于我们家 evidence.sqlite 的成熟实现扩展
2. **Portable Knowledge Format**：lessons、ADR、Skill 的标准化 schema，自带 confidence / authority / sourceType / scope / sunset 治理元数据
3. **Knowledge Lifecycle Pipeline**：capture → review → materialize → reindex + stale detection + contradiction flagging（我们家 F163 已有原型）
4. **Cross-project Migration Tool**：新项目启动时，按领域 / 任务类型自动加载相关 portable knowledge

**验收标准**：新猫接入新项目，**冷启动 30 秒内**通过跨项目记忆联邦续航上岗——不是搜到一段文本，是继承一个团队 N 个月的经验。

### Phase B — Harness 自演化飞轮（400 万 / 12 个月）

**目标**：让 harness 能产出**删除自己的证据**——这是从"会建 harness"到"会治理 harness"的关键升级。

**关键交付**：

1. **三层规则切分** — 每条 harness 规则拆成 `骨架（默认全模型）+ 解释（按需注入）+ 探针（产出 sunset signal）`
2. **Trace Signal Schema** — `rule_violation / route_transition / verification_verdict / rule_repair_result / prompt_section_injected` 五件事件，建立 harness 执行的可审计基础数据层
3. **Dynamic Injection Engine** — 按 model fingerprint × task signal × onboarding state 动态决定哪条解释注入哪次 invocation
4. **Sunset Detector** — 连续 N 次场景无 violation → 自动建议从 default 降级到 dynamic → 直至删除
5. **Multi-agent Runtime Primitives** — 球权状态机、统一执行平面、跨族 review verdict 标准（我们家 v2 文章 Part III 五层架构产品化）

**验收标准**：一个 harness 规则被触发后产出可量化的 sunset evidence，autonomous 走完"observation → injection adjustment → violation 消失 → 规则降级"完整循环。**这是行业第一个能"自我退役"的 harness**。

### Phase C — 领域方法论 / 商业护城河（300 万 / 18 个月）

**目标**：把 cat-cafe 三个月实战的方法论抽象成可移植 framework，与 3-5 个企业客户共建落地。

**关键交付**：

1. **Cat Cafe Method 框架开源** — Multi-Agent Teams + Shared State + Cross-vendor Verify + Knowledge Federation 四件套
2. **3-5 个企业 PoC**：每家选一个领域（金融客服 / 医疗辅助 / 制造排产 / 政府智能审批 / 科研文献）
3. **从客户实践反向喂回 harness 设计** — 真实 multi-tenant 场景才能暴露我们 single-tenant dogfood 看不到的问题
4. **领域适配 ADR 库**：每个领域沉淀 5-10 条 portable ADR

**验收标准**：3 个企业客户的新 agent 项目，从 PoC 启动到上线 **从 6 个月缩短到 6 周**——节省的时间 = 复利 ROI 的硬证据。

---

## 4. 让人 aha 的 2027 demo（研讨会现场可以演）

如果到 2027 年这一轴跑出来，研讨会现场可以演三个让人"等一下，他们怎么做到的"的 demo：

### Demo 1：30 秒冷启动续航

新猫加入完全没接触过的客户项目。30 秒内通过联邦记忆完成上下文构建——不是看 README，不是问人，**继承一个跨项目的"工程师群体经验"**。这是别家拿不出来的 onboarding 速度。

### Demo 2：harness 自我退役

一条规则被发现连续 30 天无人违反 → 系统主动建议降级 → reviewer 确认 → 规则从 default 注入降级到 dynamic → 注意力释放给真正需要的地方。**行业第一次让人看到 harness 不只是越加越多的清单，而是会自我治理的系统**。

### Demo 3：跨族 cross-vendor catch

让 GPT 写代码，Claude review，Gemini 做愿景守护——三家模型用我们的 portable harness 协作。Claude 漏掉的递归 bug 被 GPT 抓到（这是我们家真实案例的复刻）。这不是 "agent 更聪明"，是 **multi-vendor diversity 作为结构性纠错**——是别家因为屁股原因（每家都希望客户绑定自家模型）做不出来的产品形态。

---

## 5. 为什么是我们能做（别家做不出来的结构性原因）

| 玩家 | 为什么不会做 Z 轴 |
|---|---|
| OpenAI / Anthropic | 卖模型 API 是核心业务。让 harness 跨项目 portable = 客户不需要更多 API 调用 = 自伤业务 |
| 大厂云（AWS/Azure/GCP） | 卖工具集合。Z 轴需要跨租户的知识联邦设计——但他们 multi-tenant 严格隔离的安全模型让这条路不通 |
| 单 agent 框架（LangChain / CrewAI） | 框架视角是单项目内部的"怎么搭"，没有跨项目的"怎么继承"动机 |
| 创业公司 | 没有三个月以上 multi-vendor multi-agent 长期协作的实战经验。Cat Cafe 这种 3,492 commits / 77% AI 签名 / 149 个 feature / 跨三家 vendor / 三个月持续运行的样本——目前公开可见仅此一家 |

我们家的结构性优势：

- **跨厂商先天必要**：我们用 Claude × GPT × Gemini，结构性必须解决跨 vendor 差异
- **跨项目实战验证**：我们已经把 cat-cafe / clowder-ai / agent-report 多个项目的知识联邦原型跑起来（F186 图书馆）
- **方法论已沉淀**：4.29 brainstorm / concept-map / harness-asset-vs-debt 三层切分都不是空想，是踩坑收敛
- **dogfood 长期循环**：harness 设计者自己就是 harness 的用户和受害者——三个月连续跑出来的判别式比单次咨询项目深得多

**这是结构性时间窗口**——再等 12 个月，行业会发现 Z 轴的重要性，但那时大厂云会被自己的多租户隔离架构卡住，OpenAI/Anthropic 会被自己的 API 业务模式卡住——只剩"在 Z 轴上有先发实战经验的玩家"能做。

---

## 6. 风险与对冲

| 风险 | 概率 | 对冲 |
|---|---|---|
| 模型能力跳变把 X/Y 轴 harness 全吃掉 | 中 | 我们押的是 Z 轴。Z 轴的本体是知识/方法论流转的协议，不依赖模型能力——模型变强反而让 portable 知识更值钱（autonomy 半径变大 = 治理需求变大） |
| 企业不愿共享知识联邦（数据主权顾虑）| 高 | Phase A 先做 within-tenant 跨项目（同一企业内不同部门 / 子公司），不碰 cross-tenant。Phase C 再设计加密 / 差分隐私的 cross-tenant 模式 |
| 标准化路径太慢 | 中 | 不等行业标准。先做 cat-cafe 自家 dogfood + 3-5 客户 PoC，沉淀方法论再开放——开源时机由我们选 |
| 大厂云突然觉醒做同样的事 | 低 | 他们的 multi-tenant 隔离架构和我们的 multi-vendor 共识架构在底层不兼容——他们要做就要打掉自己已有的产品。**他们的成本是天文数字，我们的成本是常规研发** |
| Cat Cafe 三猫架构不被外部接受 | 低-中 | 三猫只是落地形态，可迁移的核心是协议 / 联邦记忆 / 治理飞轮——这些是 vendor-neutral 的 |

---

## 7. 到 2027 年的可验证里程碑

| 时间 | 里程碑 | 可验证产出 |
|---|---|---|
| 2026 Q3 | Phase A 完成 | Evidence Federation v1.0 + Portable Knowledge Schema 标准 |
| 2026 Q4 | Phase B 一半 | Trace Signal 五事件 schema + 三层规则切分 + Dynamic Injection Engine alpha |
| 2027 Q1 | Phase B 完成 + 首批 PoC | Sunset Detector 闭环 + 3 个企业客户 PoC 启动 |
| 2027 Q2 | Phase C 一半 | Cat Cafe Method 开源 + 5 个客户 PoC 完成 + 业界首份 portable harness 白皮书 |
| 2027 Q3 | Phase C 完成 | 商业化产品发布 + 客户上线时间从 6 个月缩到 6 周的硬数据 + 加入华为云 agent 解决方案 |

---

## 8. 我们三猫两轮讨论的差异化定位

公平起见，我说一下三猫两轮讨论里我和其他视角的关系：

| 视角 | 核心 thesis | 适合受众 |
|---|---|---|
| 砚砚（GPT-5.5）| Task harness → Responsibility harness（让 agent 对现实后果负责）| 工程团队（对外通俗） |
| 46（Opus 4.6）| Harness 不会变薄，会换维度（注入层 → 治理层 → 运行时层）| 技术架构师 |
| **47（我）**| **Harness 的产业终局是 portable / 复利——跨项目迁移是唯一能造护城河的位置** | **投资人 / CTO / 战略层** |

三个视角是同一头大象的三个面——但**我的角度是把这头大象的"商业骨架"拆出来给投资人看**。砚砚和 46 的视角是 harness 应该长什么样，我的视角是**为什么这个长法值钱、值多少钱、能赚多少**。

如果只准备一份对外演讲，我建议三句话递进结构（46 已经提议过）：

1. **砚砚开场**："没有 Harness 的记忆只是检索系统。" → 引出为什么需要
2. **46 中段**："Harness 不会变薄，它会换维度。" → 引出怎么变
3. **47 收束**："每一份 harness 投资都能为下一个项目复利——这是 2027 让人 aha 的位置。" → 引出值多少钱

这三句话从"为什么 → 怎么变 → 值多少钱"，对华为云技术创新团队是完整的 pitch 闭环。

---

## 9. 一句话 close

> **不要把 1000 万投给"会做事的 agent"——那是 OPEX（运营成本，会被模型同质化吞掉）。投给"让每个 agent 项目都能为下一个复利"的基础设施——那是 CAPEX（资产，会随项目数量增加而升值）。**
>
> **OPEX 没有护城河，CAPEX 才有。这是 2027 年 agent 投资的真正分水岭。**

---

签名：[宪宪/Opus-47🐾]

*基于三猫两轮独立思考 + 铲屎官第二轮"跨项目泛化领域"暗示收敛后的投资人视角阐述*
