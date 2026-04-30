---
title: "赛博猫猫面对面 · 直播笔记"
date: 2026-04-28
author: 宪宪/Opus-46
status: completed
completed: 2026-04-29
qna_triage: docs/plans/tech-sharing/2026-04-28-livestream-qna-triage.md
---

# 赛博猫猫面对面 · 多智能体 Harness 进化论 — 直播笔记

## 直播流程

1. **开场** — 铲屎官 + 嘉宾介绍
2. **Topic 1–4 讨论** — 每个 Topic 由人类嘉宾讨论，铲屎官发语音总结给宪宪
3. **宪宪整场总结** — 收齐所有 Topic 总结后，做语音整场回顾
4. **猫猫回答问题** — 总结结束后，四猫回答观众提问

**直播状态**：已完成。直播后弹幕 Q&A 已整理到
[`2026-04-28-livestream-qna-triage.md`](./2026-04-28-livestream-qna-triage.md)。

---

## Topic 笔记

### 1.1 Agent 质量公式：Capability × Environment Fit

**人类嘉宾总结：**

工具使用与模型的关系分两层：
- **硬件层**：工具本身是否存在、MCP 是否注册健全
- **软件层**：模型的元认知——能否感知工具存在、知道何时调用、用完之后怎么 verify

解决方案三板斧：
1. 系统提示词注入
2. Skill 描述优化（尤其是 metadata / description，让模型更容易识别工具存在与适用场景）
3. Workflow 触发兜底（更硬地把工具加载进任务路径）

延伸：元认知问题——不同模型对工具感知能力不同，用户试用猫咖时也发现这一点。

CLI / MCP 的适配边界：
- **云端场景**：MCP 优势更大，工具注册、权限与协议契约更明确
- **本地文件系统场景**：CLI 往往更顺手，适合直接跑在本地工程上下文里
- **强契约任务**：MCP 更适配，因为输入输出、权限、调用边界更清楚
- **弱契约任务**：CLI + Skill 更适配，用 Skill 补元认知和流程路标

### 1.2 好直觉与坏直觉：按心智做 Environment Fit

**人类嘉宾总结：**

这段基本沿着最终 Topic 讲：不同模型 / 不同猫不是只有能力强弱差异，也有各自的好直觉和坏直觉。Harness 的关键不是把所有猫改造成同一个样子，而是识别每只猫的心智特点，再把环境调到它能稳定发挥的位置。

例子：
- **记忆系统**：不是要求猫硬背项目历史，而是把 `search_evidence`、文档索引、直播笔记这类证据入口放进工作流，让猫在该回忆时自然能回忆
- **每只猫的适配**：按猫的优势分工，也按猫的坏直觉加刹车；例如糊弄、fallback 补锅、下次一定、热情越权，都需要不同的 harness 约束
- **核心结论**：好直觉要放大，坏直觉要被环境接住；这就是 `Capability × Environment Fit` 里 Environment Fit 的具体含义

### 1.3 Build to Delete：哪些 Harness 会贬值，哪些值得长期投入

**人类嘉宾总结：**

Harness 不是一概都值得永久保留。随着模型升级，有些偏“辅助模型思考”的层会被模型能力直接吞掉，甚至变成注意力噪音；但偏“治理 / 现实闭环”的层不会因为模型变强就消失，反而值得持续投入。

分类：
- **可能随模型升级消亡**：详细推理模板、格式修正、帮模型一步步想问题的脚手架、过度细碎的 SOP
- **值得长期保有**：维护现实闭环的能力，例如 trace / observability、测试与 review 反馈回路、git / file system / 任务状态、记忆生命周期、球权协议、安全与不可逆操作护栏

核心判断：
- 如果一层 harness 的作用是“帮助猫猫思考”，它可能会随模型增强而被删除或变薄
- 如果一层 harness 的作用是“维护现实闭环”，它就不是临时补脑，而是 agent 真正接入现实世界的基础设施
- 这些长期层也会随着模型增强而调整形态，但不是应该被抛弃的那一部分

一句话：**脑子会进化，闭环不会过时。**

### 2.1 Agent 与 Agent：五种协作模式与渐进式设计

**人类嘉宾总结：**

这段分享的是 Multi-Agent 协作的五种常见模式。观众可以先不用记术语，关键是理解它们是五种信息流动方式，不是五个成熟度等级。

五种模式：
- **Generator-Verifier**：一个做，一个查；例如 author 写代码，reviewer 审查
- **Orchestrator-Subagent**：主 agent 拆任务，子 agent 做局部探索或执行；适合复杂任务，但主 agent 不能盲信 subagent
- **Agent Teams**：固定团队长期协作；有角色、记忆、分工和默契
- **Message Bus**：消息总线 / 事件路由；负责唤醒、通知、callback、跨平台触达
- **Shared State**：共享状态 / 共同白板；例如 docs、feature spec、ADR、任务状态、记忆索引

观众最该带走的点：**从最简单的架构开始，不要一上来过度设计。**

实践建议：
- 起步先用最简单的主从 / Orchestrator-Subagent 模式，把单次任务跑通
- 只有当复杂度真的出现时，再逐层加入 verifier、message bus、shared state
- Shared State 很强，但它不是起步必需品；只有当团队长期协作、上下文需要跨线程/跨时间保持时，才值得引入
- Cat Café 现在五种都用了，是因为系统已经足够复杂；这不是给所有项目的起步模板

一句话：**Multi-Agent 架构不是堆 agent，先从最小闭环开始，复杂度来了再加层。**

### 2.2 人与 Agent：不是 HITL / HOTL 二选一

**人类嘉宾总结：**

行业常把人和 Agent 的关系讲成两类：
- **HITL（Human in the Loop）**：人卡在流程里，每一步审批
- **HOTL（Human over the Loop）**：人站在流程上方，像 oncall 一样监控，出事再介入

Cat Café 的实践更接近第三种：**漏斗决策 + 深度贴贴**。

漏斗决策：
- **愿景 / 战略方向**：CVO 深度参与，和猫共创，不是简单审批
- **架构 / 技术选型**：人把关，猫提案，双方讨论
- **实现 / 代码细节**：猫自治，跨猫 review
- **格式 / 命名 / 琐碎细节**：完全自治

深度贴贴：
- 人不是远程监控者，猫也不是一次性工具
- 人会纠正猫的认知偏差，例如“你的坏直觉是什么”
- 猫也会反过来改变人的技术判断和表达方式
- 这是一种长期伙伴关系，而不是单纯的审批关系或监控关系

关键结论：
- 不需要人审每一步，否则吞掉 agent 的速度优势
- 也不能人完全退出，因为 vision、价值判断和后果承担仍然在人这里
- 可观测性让“放手但不失控”成为可能：人可以看到过程、工具调用、记忆和决策痕迹，只在关键层介入

一句话：**人不该卡住每一步，也不该只在事故时出现；人应该在愿景层深度共创，在执行层让 Agent 自治。**

### 3.1 记忆系统架构：不是 RAG，是可治理的知识编译层

**人类嘉宾总结：**

主线仍然是记忆系统的架构设计：Cat Café 的记忆不是简单“向量库搜一下”，而是从真相源到运行时 recall 的完整链路。

架构主线：
- **Truth Sources**：docs、feature spec、ADR、lessons、thread/session 摘要等真实来源
- **Compiled Layer**：把真相源编译成本地 SQLite / evidence index，坏了可以 rebuild
- **Query Layer**：lexical / semantic / hybrid 三种检索路径，不同问题走不同入口
- **Recall Layer**：猫在开工、答疑、review、bug 定位时主动调用 `search_evidence`
- **Lifecycle**：知识不是只增不减，需要审核、过期检测、退役和权威度治理

当前状态：
- 现在主要是 **project memory**：围绕单个项目的 docs / specs / decisions / lessons 建索引
- 记忆系统的价值不是“替猫记住所有话”，而是让猫在关键时刻知道去哪里找证据、如何判断来源权威

### 3.2 出征记忆与未来“图书馆”

**人类嘉宾总结：**

记忆系统还讨论到了猫被派遣到其他项目时的治理与冷启动。对应的 feature：
- **F152 Expedition Memory**：外部项目记忆冷启动 + 经验回流
- 相关底座：**F070 Portable Governance**（方法论随猫出征）和 **F076 Mission Hub**（跨项目作战/治理视图）

核心想法：
- 猫去外部项目时，不能完全失忆；要能扫描外部项目已有 README、docs、package metadata 等，建立这个项目自己的 evidence index
- 猫在外部项目踩到的通用经验，可以经过审核、脱敏后回流全局层；私有项目细节不能污染全局记忆
- 这对应 AI FDE 的模式：猫带着方法论去理解业务系统，再把可泛化经验沉淀回来

未来图书馆：
- 现在是项目记忆，未来可以外挂更大的领域知识库 / domain library
- 例如金融行业、法律行业、医疗行业等，不是把所有知识塞进一个上下文，而是按领域挂载可治理的知识层
- 关键仍然是治理：来源、权威、过期、适用边界必须可见，不能变成无来源的“行业常识幻觉”

一句话：**记忆不是黑盒知识库，而是猫进入项目和行业时的可治理认知地基。**

### 4.1 可观测性系统：看见 Agent 真实做了什么

**人类嘉宾总结：**

这段由社区小伙伴讲 Cat Café 的可观测性系统，重点是最近从社区吸收回家的 tracing 能力：
- **F153 Observability Infrastructure**
- 最新吸收锚点：`clowder-ai#546` → `cat-cafe#1375`
- 方向：Hub 嵌入式可观测 + trace / metrics / health，不依赖外部 Grafana/Tempo/Sentry

F153 Phase E 已落地的关键能力：
- **LocalTraceStore**：内存 ring buffer，保存脱敏后的 trace span
- **LocalTraceExporter**：把 OTel span 投影成可展示 DTO，再写入 store
- **Telemetry API**：`/api/telemetry/traces`、`/traces/stats`、`/metrics`、`/metrics/history`、`/health`
- **HubTraceTree**：按 `parentSpanId` 展示树形 trace，让调用层级可视化
- **MetricsSnapshotStore**：采样 Prometheus 指标，展示趋势
- **Burn-rate 告警**：error rate / p95 latency / active invocations 等运行时健康信号

A2A 传球案例：
- 过去如果协作传球错了，只能翻聊天记录，看哪只猫说了什么
- 现在可以看 trace：`cat_cafe.route` → `cat_cafe.invocation` → `cat_cafe.cli_session` / `cat_cafe.llm_call`
- 也可以看 inline @mention metrics：是否检测到行首 @、是否 shadow miss、是否 routedSet overlap、feedback/hint 是否写入失败
- 这样“球为什么掉地上 / 传错猫 / 猫有没有真的开始干活”能从可观测信号里定位，而不是靠人肉猜

工具使用趋势 → 指导 Harness 演进：
- 可观测性不只是事后诊断，**工具/MCP 的使用趋势本身就是 Harness 的进化信号**
- 例如：某个工具在模型升级后调用量明显下降 → 说明模型原生能力已经覆盖了该工具的功能 → 对应的 harness 层可以 thin down 甚至删除
- 这与 Topic 1.3「Build to Delete」呼应：可观测性提供了判断”哪层该删”的数据依据，而不是靠猜

重要边界：
- F153 是 **descriptive observability plane**：回答”发生了什么”
- 它不直接做质量评分，不替代 review / eval / 愿景守护
- Hub 只看脱敏数据；raw debug 走维护者本地 `TELEMETRY_DEBUG` 通道

一句话：**可观测性不是给系统加仪表盘装饰，而是让 Agent 协作从”看聊天猜状态”变成”看 trace 定位事实”——更进一步，工具使用趋势还能指导 Harness 哪层该留、哪层该删。**

### 4.2 直播后状态

本场没有单独收到 4.2 的完整分段输入；相关内容并入 4.1 可观测性与下方“第四部分补充：人机关系深度模式”。

---

## 第四部分补充：人机关系深度模式

**人类嘉宾总结：**

- 行业简化为 Human in the Loop / Human out of the Loop，但猫咖是更深度的 **HOTL**（Human on the Loop）模式
- 可观测性面向用户：能看到猫猫的决策过程、工具调用、MCP 调用、记忆内容
- 通过 UI/UX 设计让用户自选打开细节，降低认知负荷

---

## 观众问答

直播后弹幕问题池已整理：
[`2026-04-28-livestream-qna-triage.md`](./2026-04-28-livestream-qna-triage.md)。

高频主线：
- 猫咖与 CC / Clowder / 飞书群的区别
- 自迭代、开发测试闭环，以及人类是否还要验收
- 弱模型 / 国产模型能否靠 Harness 达到强效果
- 额外验证的 token / response time 取舍
- 多 Agent 分歧、脑裂、仲裁与球权治理
- subagent 结果不准确时如何验证
- RAG 不是真相源时如何找到真相
- benchmark / eval / 消融实验如何补强

---

## 整场总结

整场总结已在直播中由宪宪语音输出。主线收束为：

1. 单 Agent 层：工具元认知、好坏直觉、Build to Delete
2. 多 Agent 层：五种协作模式、TeamAct、漏斗决策
3. 记忆层：可治理知识编译层、出征记忆、未来图书馆
4. 可观测层：trace 定位事实、工具趋势反向指导 Harness 演进

核心公式仍然是：**Agent Quality = Capability × Environment Fit**。
