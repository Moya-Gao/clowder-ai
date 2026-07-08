---
feature_ids: [F257]
topics: [harness, prompt-segments, eval, self-evolution, design-draft]
doc_kind: design
created: 2026-07-08
---

# 段 Harness v0 设计草案（首个试验品：prompt 段 + SOP）

> 输入：capability-gap-analysis.md（基建盘点+方向重定）、harness-body-inputs.md（三猫体感+A1 公理+join 验证）、seed-cases SC-001~005、co-creator 约束（事件驱动/不轮询/不自动改段/approve 边界）。
> 状态：**draft-v0.1**——2026-07-08 codex 落地 review（4 P1 + 6 P2，msg `446ffdda`）全部修入；spec Phase A 已同步对齐（P1-1）。待 co-creator 对齐开工。

## 0. 一句话定义

对 46 个 prompt hook 段（含 SOP 段）建立**只读评估 → evidence-backed candidate → 分通道迭代 → 版本差分验证**的事件驱动闭环，回答"哪些段多余 / 内容不合理 / 缺什么段"，并让每次修补的效果可测。

**v0 不做**：自动改段（防 prompt 自我繁殖）、skill（deferred，overlay 共识已记录）、全量锅账 backfill、新 eval 机制（全复用 F192）。

## 1. 运转模型：四层频率，零轮询

| 层 | 触发方式 | 频率 | 动作 |
|----|---------|------|------|
| 信号 | **事件驱动**（拒绝/注入发生即 append） | 随时·被动 | 段注入 trace 落盘（已有）+ guard 拒绝落盘（新） |
| 归因 | **阈值触发**（默认 3 次/7d，per-guard/ledger 可配置覆盖） | 事件累积 | 自动开归因 task，附 evidence 包（拒绝序列 + 当时注入的段 + correlation trace） |
| 评估 | **低频批**（复用 eval cron） | weekly | `eval:harness-ledger` 域（sourceRefs selector `{scope: 'prompt-segments'}`，**不新增域名**，避免撞域）产 verdict + candidate 报告 |
| 治理 | **报告驱动**（operator 看到 candidate 才动） | 无固定周期 | approve 结构升级 / 批退役 / intentional-keep |

> 这直接回答"基于事件具体怎么设计"：信号被动记，归因攒够才动，评估搭已有周车，治理跟着报告走。任何一层都不主动打扰任何人。

## 2. 数据面

### 2.1 correlation 模型（v0.1 重写，codex P1-2）

**事实前提（codex 核码）**：`turnId` 是 route-serial 在猫启动前生成的 random UUID；`ownInvocationId` 要等 stream `invocation_created` 到达后才捕获；hold_ball route 有 callback-auth invocationId 但 trace 侧无桥；A2A route guard 在 generator 内部（非 HTTP 通道）。→ **精确三元组 join 当前不可得，"小改"表述作废**。

两档 correlation：
- **Week 1 默认（半精确）**：`threadId + catId + timestamp window + guardId`，事件带 `correlationConfidence: 'window'`——T2a 差分在窗口置信度上就能算（版本前后违规率对比不需要逐 turn 精确归属）
- **后续增强（精确）**：trace summary 持久化 invocationId 或建 `traceTurnId ↔ invocationId` bridge；guard event 统一带可用 invocationId；confidence 升 `'exact'`。作为独立小工作项，不阻塞 Week 1

段侧粒度：现为 aggregate（#1029 v0）；**#1075 仍 open 且其 diff 中 route 仍走 v0 trace 持久化路径——不承诺"合入后自动逐段"，以合入后的实际 AC/code 为准重验 join 通路**（codex P2-6）。

### 2.1b GuardRejectionEventLog（v0.1 重写，codex P1-3）

**接口先于存储**：`append(event)` + `queryWindow({since, until, guardId?, threadId?, catId?})`。归因阈值和 weekly eval 都是窗口扫描——F254 的 per-invocation LIST 形态**不可发现**（不知道扫哪些 invocation），不照抄。

存储：global ZSET by timestamp（index）+ detail key；raw payload 不落盘（只存 normalized 字段 + anchor 引用）；**fail-open**——观测层故障绝不阻塞业务调用。

事件 union 按来源分型（codex P1-4，"4 处各加几行"表述作废）：

| 事件类型 | 实例 | emit 位置 | 测试方式 | Week 1 |
|---------|------|----------|---------|--------|
| `http_schema_reject` | waitSourceRef 400 | HTTP route handler | route 单测 | 后续 |
| `http_policy_reject` | gate-keeping 400 | HTTP route handler | route 单测 | 后续 |
| `http_rate_limit` | hold_ball 429 | HTTP route handler | route 单测 | ✅ |
| `publish_policy_reject` | publish_verdict 403 | eval-hub route（HandlerError → reply.status） | route 单测 | 后续 |
| `route_decision_skip` | A2A guard skip | route-serial generator 内 `continue` | generator 集成测试 | 后续 |
| `route_decision_block` | block_pingpong | generator yield system_info | generator 集成测试 | ✅ |

Week 1 Line B 只上 2 类（`http_rate_limit` + `route_decision_block`）：一个 HTTP 面一个 generator 面，把两种工程面的 emit 通道都走通，其余 4 类扩面是机械推广。route guard 类**单独估算工作量**，不按"微改"计。

第三 ground truth 源：eval:sop 的 violation 产出（已有，KD-8 边界维持——SOP 段的行为证据委托 eval:sop，不重建）。

### 2.2 留存

热层 7d（Redis，与既有 log 一致）→ weekly eval 拉取时聚合快照进 verdict bundle（git，永久）——借 F237 summary/detail 双层思路，解决 30d 窗口问题且零新存储系统。

## 3. 评估面：三层判定（按成本升序）

| 层 | 判定 | 需要什么 | 何时可跑 |
|----|------|---------|---------|
| **T1 静态** | ①跨层冗余：O2 段断言已被 O1 结构承载（星星罐子型）②段间矛盾：同 context 反向断言（规则不 compose 型）③语义撞词：拉闸词与技术名词冲突（脚手架型） | 只需段内容 + 结构 guard 清单 | **day-0**（46 段一轮体检） |
| **T2a 差分·自动** | guard ground truth：段 fired 且对应违规仍发生 → low-evidence；版本切换前后违规率对比（窗口置信度即可算） | correlation 双侧事件（§2.1） | Line B 落地后 |
| **T2b 差分·半自动** | provenance / truth-source drift 类：ground truth 由 eval/review 标注（无结构 guard 可依） | 标注流程 | 与 T2a 同期，吞吐更低 |
| **T3 缺段** | 同类纠正/摩擦反复出现但无段承载 | Week 1 用 friction rollup 现有产物半自动初筛；正式第五 source adapter（含 FrictionChannel union/composition/tests 扩展）**放 Phase B 不压 Week 1** | day-0 可半自动 |

**核心指标 = 行为差分，不是注入率**（公理 A1，三猫三模型实证）。

### verdict 词表（段专用 v0）

`alive` / `redundant-candidate(cross-layer | duplicate)` / `conflict` / `false-positive-noise` / `low-evidence` / `missing-segment` / `superseded`（LL-071 型：被结构替代，光荣退役）/ `unmeasurable(+observabilityDeadline)`。通用锅账词表（spec 既有）在泛化阶段合并。

## 4. 迭代面：三通道 + 自动验证

| 动作 | 通道 | 依据 |
|------|------|------|
| 段文本迭代 | 猫内 git PR + 跨猫 review（自动通道） | 段 = yaml+md，doc-only 可逆 |
| O2→O1 结构升级 | **operator approve**（看 diff） | 修补环主形态；opus 三例：agent 摘要未 Read 拦截 / 429 第 N 次归因 / CI lint 断言 |
| 段退役 | **operator approve**（superseded/redundant 证据链） | 硬边界 |
| （中期）overlay 迭代 | #1075 PR3 `HookOverrideStore`：base 不动 + override 层迭代 + 版本自见 | co-creator 的 overlay 形态；skill 未来同模式复用 |

**验证零成本**：修补后段的 contentHash/version 变化 → join 数据自然分版本 → 下一个 weekly 周期自动产出前后违规率对比。不需要专门的验证动作。

**账本伴生**：每次修补的涉事段登记 ledger YAML（spec 既有 schema），registry 从真实修补里长出来（KD-10 不变）。

## 5. 首批评估对象（有 ground truth 的段先评）

1. **路由/传球出口段** — ground truth: route guard 拒绝（GuardRejectionEventLog 首批覆盖）
2. **provenance/source 段** — ground truth: SC-002/#1075 型事件（v0 承认半自动：review 发现人工标注）
3. **truth-source 写回段** — ground truth: seed cases + spec diff 检查

phase-boundary drift 检查卡（砚砚最想要，一卡拦 SC-002/003/004）：**第二批**——主线闭环走通后做，实现是 lint/checklist 级，其判据已被 seed cases 固化，不会丢。

## 6. 开工顺序（"怎么继续"）

**Week 1 双线并行**：
- **线 A（第一个可交付，零新基建）**：T1 静态体检 + T3 缺段初筛 → **第一份 candidate 报告**给 operator。**段口径 source-of-truth（codex P2-4）**：pre-#1075 按 current template registry（**50 个 template id，含 D7/D15 变体**；how_counted: `TEMPLATE_FILES` 常量计数 @ 当前分支）；#1075 合入后切 hook manifest 口径（46 hook.yaml @ PR diff）。两口径差异在报告中显式声明
- **线 B（基建）**：GuardRejectionEventLog（queryWindow 接口 + ZSET 索引）+ **2 类事件 emit**（`http_rate_limit` + `route_decision_block`，一 HTTP 面一 generator 面）→ codex review。精确 correlation bridge 为独立后续项

**Week 2+**：`eval:harness-ledger` 域注册（selector `{scope: 'prompt-segments'}`，weekly）→ T2a 差分进周期 → 第一批修补走 approve 通道 → 下周期自动出验证差分 → 其余 4 类事件扩面 → drift 检查卡。

**里程碑判据**（对齐 AC-A0 精神）：≥1 个段完成完整五环（评估 candidate → approve → 修补 → 版本差分显示违规下降 or 证伪）。走不通 = 设计证伪，停下重议，沉没成本 = 一个 event log + 一份静态报告。

## 7. 改动范围

| 改动 | 位置 | 量级 |
|------|------|------|
| GuardRejectionEventLog | packages/api 新文件（queryWindow + ZSET 索引，**非** F254 LIST 形态） | ~200 行 + 测试 |
| Week 1 emit ×2 | `http_rate_limit`（HTTP route，route 单测）+ `route_decision_block`（generator，集成测试） | 两种工程面各一，**route guard 类单独估算** |
| 其余 4 类 emit 扩面 | 见 §2.1b 分型表 | Week 2+，机械推广 |
| 精确 correlation bridge | trace summary 持久化 invocationId 或 traceTurnId↔invocationId 桥 | 独立后续项，不阻塞 Week 1 |
| eval 域 selector | eval:harness-ledger 域配置加 `{scope: 'prompt-segments'}`（不新增域名） | 配置 |
| T1 静态体检 | 脚本 or eval cat 执行（不进运行时） | 只读 |
| **不碰** | 46 段内容（评估只读）、eval 机制、运行时主链路行为、skill | — |

## 8. 体系自身防腐

- seed-cases 持续记录本体系开发偏差（自举条款不变）
- sunset signal：eval:prompt-segments 连续 4 周期无 actionable verdict → 降频/并入 eval:friction（防第 131 口锅）
- 所有报告数字带 `how_counted`（SC-002 纪律）

## 9. 与理想态的差距（诚实声明）

- 五环全自动是 north star；v0 的归因半自动（阈值开 task，归因本身靠猫）、修补全人工（approve 通道）
- Week 1 correlation 是窗口置信度（`correlationConfidence: 'window'`），精确 join 是后续增强；T2a 差分在窗口置信度上成立
- 段粒度 aggregate → 逐段依赖 #1075 实际合入形态，**以合入后 AC/code 为准重验，不预设**
- T2b（provenance / truth-source drift）ground truth 半自动（eval/review 标注）
- 时间尺度：修补验证以 weekly 周期为单位，闭环证明 ≥2-3 周
