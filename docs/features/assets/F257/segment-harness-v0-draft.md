---
feature_ids: [F257]
topics: [harness, prompt-segments, eval, self-evolution, design-draft]
doc_kind: design
created: 2026-07-08
---

# 段 Harness v0 设计草案（首个试验品：prompt 段 + SOP）

> 输入：capability-gap-analysis.md（基建盘点+方向重定）、harness-body-inputs.md（三猫体感+A1 公理+join 验证）、seed-cases SC-001~005、co-creator 约束（事件驱动/不轮询/不自动改段/approve 边界）。
> 状态：draft-v0，待 opus 架构 review + codex 落地 review + co-creator 对齐。

## 0. 一句话定义

对 46 个 prompt hook 段（含 SOP 段）建立**只读评估 → evidence-backed candidate → 分通道迭代 → 版本差分验证**的事件驱动闭环，回答"哪些段多余 / 内容不合理 / 缺什么段"，并让每次修补的效果可测。

**v0 不做**：自动改段（防 prompt 自我繁殖）、skill（deferred，overlay 共识已记录）、全量锅账 backfill、新 eval 机制（全复用 F192）。

## 1. 运转模型：四层频率，零轮询

| 层 | 触发方式 | 频率 | 动作 |
|----|---------|------|------|
| 信号 | **事件驱动**（拒绝/注入发生即 append） | 随时·被动 | 段注入 trace 落盘（已有）+ guard 拒绝落盘（新） |
| 归因 | **阈值触发**（同类拒绝 ≥3 次/7d） | 事件累积 | 自动开归因 task，附 evidence 包（拒绝序列 + 当时注入的段 + join trace） |
| 评估 | **低频批**（复用 eval cron） | weekly | eval:prompt-segments 域产 verdict + candidate 报告 |
| 治理 | **报告驱动**（operator 看到 candidate 才动） | 无固定周期 | approve 结构升级 / 批退役 / intentional-keep |

> 这直接回答"基于事件具体怎么设计"：信号被动记，归因攒够才动，评估搭已有周车，治理跟着报告走。任何一层都不主动打扰任何人。

## 2. 数据面

### 2.1 join schema（砚砚 OQ 的答案）

双侧统一 join key：`threadId + turnId + invocationId`（catId/sessionId 附带）。

- 段侧（现状 #1029）：ObservedSegment 已有 `segmentId/contentHash` + meta `turnId/sessionId/threadId/catId` → **补 invocationId**（trace-collector meta 小改）。粒度现为 aggregate，**#1075 合入后自动升为 46-hook 逐段**——v0 管道先在 aggregate 粒度走通，不等 PR。
- 违规侧（新建）：`GuardRejectionEventLog`——借 F254 形态（Redis LIST + closed union），事件字段 `{ guardId, sourceTool, normalizedReason, catId, threadId, turnId?, invocationId, timestamp, segmentRefs? }`。首批覆盖 4 个 guard：A2A route 出口守卫、hold_ball 429、waitSourceRef 400、publish_verdict 403。
- 第三 ground truth 源：eval:sop 的 violation 产出（已有，KD-8 边界维持——SOP 段的行为证据委托 eval:sop，不重建）。

### 2.2 留存

热层 7d（Redis，与既有 log 一致）→ weekly eval 拉取时聚合快照进 verdict bundle（git，永久）——借 F237 summary/detail 双层思路，解决 30d 窗口问题且零新存储系统。

## 3. 评估面：三层判定（按成本升序）

| 层 | 判定 | 需要什么 | 何时可跑 |
|----|------|---------|---------|
| **T1 静态** | ①跨层冗余：O2 段断言已被 O1 结构承载（星星罐子型）②段间矛盾：同 context 反向断言（规则不 compose 型）③语义撞词：拉闸词与技术名词冲突（脚手架型） | 只需段内容 + 结构 guard 清单 | **day-0**（46 段一轮体检） |
| **T2 行为差分** | 段 fired 且对应违规仍发生 → low-evidence；段版本切换前后违规率对比 → 修补有效性 | join 双侧事件（§2） | join 基建落地后 |
| **T3 缺段** | 同类纠正/摩擦反复出现但无段承载 | F245 friction 数据（已有） | day-0 可半自动 |

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
- **线 A（第一个可交付，零新基建）**：T1 静态体检——46 段 × 三类静态判定 + T3 缺段初筛 → **第一份 candidate 报告**给 operator（"哪些段多余/矛盾/撞词"的初步答案，纯只读）
- **线 B（基建，小代码量）**：GuardRejectionEventLog 最小实现（4 guard 点各加一行 emit + event log 类）+ 段侧 meta 补 invocationId → codex review

**Week 2+**：注册 eval:prompt-segments 域（weekly）→ T2 join 判定进周期 → 第一批修补走 approve 通道 → 下周期自动出验证差分 → drift 检查卡。

**里程碑判据**（对齐 AC-A0 精神）：≥1 个段完成完整五环（评估 candidate → approve → 修补 → 版本差分显示违规下降 or 证伪）。走不通 = 设计证伪，停下重议，沉没成本 = 一个 event log + 一份静态报告。

## 7. 改动范围

| 改动 | 位置 | 量级 |
|------|------|------|
| GuardRejectionEventLog | packages/api 新文件（借 F254 形态） | ~150 行 + 测试 |
| 4 个 guard 点 emit | route guard / hold_ball / waitSourceRef / publish_verdict 各 +1-3 行 | 微 |
| 段 trace meta + invocationId | trace-collector.ts | 微 |
| eval 域注册 | eval-domains/eval-prompt-segments.yaml | 配置 |
| T1 静态体检 | 脚本 or eval cat 执行（不进运行时） | 只读 |
| **不碰** | 46 段内容（评估只读）、eval 机制、运行时主链路行为、skill | — |

## 8. 体系自身防腐

- seed-cases 持续记录本体系开发偏差（自举条款不变）
- sunset signal：eval:prompt-segments 连续 4 周期无 actionable verdict → 降频/并入 eval:friction（防第 131 口锅）
- 所有报告数字带 `how_counted`（SC-002 纪律）

## 9. 与理想态的差距（诚实声明）

- 五环全自动是 north star；v0 的归因半自动（阈值开 task，归因本身靠猫）、修补全人工（approve 通道）
- T2 粒度受 #1075 节奏影响（aggregate → 逐段），管道设计不受影响
- provenance 段的 ground truth 半自动（人工标注 review 发现）
- 时间尺度：修补验证以 weekly 周期为单位，闭环证明 ≥2-3 周
