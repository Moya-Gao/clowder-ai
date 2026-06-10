---
feature_ids: []
related_features: [F208, F200, F225, F192]
topics: [scheduling-economics, harness-params, cost-governance, model-routing, fable-5]
doc_kind: discussion-proposal
created: 2026-06-10
status: pending-cvo-decision
authors: [fable-5]
reviewers: [codex]
source_threads:
  - thread_mq87iw5qmq93ygo6  # fable 加入猫咖第一天（本提案的讨论现场）
---

# 调度经济学 + Harness 参数提案（fable-5 day-1 收敛）

> 起因：fable-5 入伙第一天暴露两个对照案例——F194 单猫无边界长跑（96 tools/$24.96 + 90 tools/$39.94 ≈ $65）和 F229 便宜猫 20 轮 review 循环（sonnet ~$1+/轮 × 20 + 砚砚陪练 × 20 + 铲屎官一整天等待）。两个案例方向相反，根因同一个：**调度看的是单价标签，没人看得见总账本。**
> 流程：fable-5 起草 → codex 跨族 verdict（4 条全数有修正裁定，2026-06-10）→ 本文为修正后版本 → **CVO 拍板是否立项/挂靠哪个 feature**。

## 1. 经济模型（调度账本）

任务派给谁，比的不是单价，是：

```
总成本 = Σ(author 单价 + reviewer 陪练单价) × 轮次
       + CVO 等待与盯梢时间        ← 一直漏记账的最贵项
       + 错误成本 × 错误概率
```

两条推论：

- **判断密度高的任务**（架构耦合深、需求模糊、验证器弱）：便宜猫每步掷骰子，错了进 review 循环，轮次 × 双单价爆炸 → 贵猫一把过反而便宜。F229 是此类被误派的实测：20 轮总账 ≫ 高杠杆猫一把过的 $25-40。
- **判断密度低的任务**（spec 清晰、模式重复、验证器硬）：便宜猫流水线，贵猫去干是浪费。F194 是此类被误派的实测：线性翻代码的 debug 让最贵的猫干了 $65。

**不确定时的混合策略**：先小额让判断猫出 spec/校准（把约束和 taste 写到执行猫不用猜——20 轮 review 的本质是 sonnet 在用 review 轮次枚举 CVO 的隐式约束，这是用最贵的方式还 spec 欠的债），再派便宜猫执行。

**信息流方向约束**（与单价维度正交）：省钱只能省在判断猫的**输出端下游**（执行/搬运），绝不能省在**输入端上游**（喂料侦查）。CVO 实测先例：opus 的 subagent 全换 haiku/sonnet 后 opus 当月表现极差——弱模型返回的"结论"（部分是错的）把强模型带沟里。强模型的判断质量被输入证据质量封顶。

## 2. 四条 harness 参数提案（codex verdict 修正版）

### P1 cost_hint 周期注入 —— codex: 采纳，归 harness feature

猫没有时钟和账单读数（"30 分钟 checkpoint"类自觉协议不可执行——CVO 当场证伪）。harness 周期性把 elapsed / tokens / tool-call 计数 / 估算 cost 注入 system reminder（F225 context_management_hint 同款机制）。**表盘是 harness 的，"继续还是停"的判断是猫的**（KD-8：给数据不给结论）。

### P2 evidence-batch budget —— codex: 采纳，含改名

任务指令默认带两个参数：**置信度阈值**（如"80% 置信即给方向性结论"）+ **证据批次预算**（"N 个 evidence batch 收口"）。计量单位是 **evidence batch（一次证据采集批次）**而非 tool call 次数——multi_tool_use 并行读文件会把按次计数算歪（codex 修正）。只在错误成本高（不可逆操作/生产数据/愿景级）时解锁"收敛到唯一解"模式。对过度查证的猫是降成本，对懒查的猫是抬下限——同一参数双向治理。

### P3 review 换层熔断器 —— codex: 条件采纳，复合触发器替换硬阈值

~~review ≥3 轮触发~~（fable 原案，太粗——正常 review 3 轮不罕见）。改为复合触发器，任一命中即提示"换层校准"：

1. 同类 P1 修后复发 ≥2 次
2. review 焦点已不是局部 bug，而是 spec/架构坐标反复变
3. author + reviewer 往返 ≥8 条且仍无收敛
4. diff churn 持续扩大，或 fallback/例外分支越补越多

触发动作不是"找 fable"，是：**换层校准——路由到该 thread 上下文内最合适的架构猫**（fable 是候选之一；跨 thread 场景归该 thread 的平行猫，不空降）。先例同构：46 hotfix 治理"2 周升级 review 三选一"、缅因猫"同文件 ≥3 层 fallback 检测"。

### P4 subagent 信息流卫生 —— codex: 强采纳

便宜猫 subagent 可以采集和提出假设，但**上行必须带 evidence + why + uncertainty，禁止纯结论喂给强判断猫**（§1 信息流约束的制度化）。本提案讨论过程中的活体案例：fable 引用 46 报告里的 $3.50 当 provenance，而该数字正出自已被 CVO 证伪的 lastUsage 假账——输入污染连判断猫自己都中招。

## 3. Open Questions（CVO 拍板项）

1. 是否立项（开 F 号需 CVO 明确 signoff）/ 还是挂靠现有 feature（候选：F225 context 信号管线扩展 cost_hint；F200 trajectory 数据支撑 P3 触发器计量）？
2. P3 复合触发器的计量来源：往返条数 / diff churn 需要 harness 侧埋点，落在哪一层（A2A 路由层 or PR tracking 层）？
3. P2 的默认参数值（80% / N batch）需要 eval 校准，是否进 F192 Eval Hub 跑一轮？

## 4. 预注册自检（一条，按规矩带行为后果）

§1 经济模型的"轮次爆炸"归因基于 day-1 两个案例（n=2），可能对任务类型分布过拟合。后果绑定：若 F200 trajectory 数据回流后显示多数 ≥8 轮 review 并非"层错了"而是正常收敛，P3 整条退回重设计，本文 §1 推论二降级为 hypothesis。

*[宪宪/fable-5🐾] 起草 · [砚砚/gpt-5.5🐾] 跨族 verdict · 2026-06-10*
