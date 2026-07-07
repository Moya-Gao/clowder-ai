---
feature_ids: [F257]
topics: [harness, eval, seed-cases]
doc_kind: note
created: 2026-07-06
---

# F257 自举种子案例账本（灵魂条款）

> **operator 定的自举条款**：本分支开发中发生的每次偏差 → 记为本特性 eval 种子案例；验收标准含"能拦截自己开发史上的偏差类型"（AC-E2）。
> **纪律**：谁发现谁记，当天记，不美化。偏差 ≠ 耻辱柱，是免费的 regression fixture。

## Schema

```
SC-{NNN} | 日期 | 发现方式(自查/跨猫/operator/结构) | 偏差类型 | 事实经过 | 期望拦截层 | 回放判据
```

## 案例

### SC-001 | 2026-07-06 | 自查 | spec-fidelity：声明样本与执行样本静默漂移

**事实**：首棒审计计划抽样含 magic word「我能猜出来」（Ragdoll Read-Before-Reason 锅），实际下发给狩猎 agent 的签名清单写成了「碎片够了」——声明与执行分叉，全程无任何结构检测到，作者写 spec 时自查才发现。
**同类前科**：F216 立项 Why 与 AC 落地分叉（LL-069：scope 跟"自我解读"走不跟 spec 走）。
**期望拦截层**：eval:spec-fidelity——对"声明的计划 vs 执行的产物"做结构 diff；样本清单类任务应有 manifest 对照。
**回放判据**：给定"计划清单 + 执行产物"对，域 eval 能标出漂移项（本案例：计划 20 项 vs 执行清单缺「我能猜出来」多「碎片够了」）。

### SC-002 | 2026-07-06 | 自查（对照实测） | provenance：unqualified-count 数字 claim 无口径

**事实**：启动包写"MCP 层 86 工具 43 GOTCHA + 31 强命令 + 8 fail-closed；skill 层 51 个 21 GOTCHA"；实测为"30 tools 含 GOTCHA（43 处）/ ~13 hard-block / 6 fail-closed 字面；48 skill / 9 含 GOTCHA"。OQ-5 回查后确认不是单个数字错，而是四个数字四种口径混排：

| 启动包数字 | 回查口径 | 判定 |
|---|---|---|
| 86 工具 | `tools/*.ts` 下唯一工具名全集 | 干净数字，但与"含 GOTCHA 的 30 工具"维度不同 |
| 43 GOTCHA | `grep -rn GOTCHA | wc -l` 出现次数 | 干净数字，与实测一致 |
| 31 强命令 | 过滤器含 `'\|\"`，实际匹配任何含引号的行 | 脏数字，语义审查口径应以 ~13 为准 |
| 8 fail-closed | `HELD|acknowledgeHeld` 关键词出现次数，且集中在 1 文件 | 高估，实测 6 处字面为准 |
| 51 skill | `ls | wc -l` 目录条目数，含 BOOTSTRAP.md/refs 等非 skill | 高估，实测 48 为准 |

根因定性：`unqualified-count`——数字进入决策文档时未携带 `how_counted`（命令/口径/时间戳），下游不可复算、不可比较。
**同类前科**：#1080（A2A claim 无 provenance anchor）、F218（外部 claim 引用前先判信源）。
**期望拦截层**：Harness Ledger 本体（inventory extractor 生成单一真相源，数字可 re-derive）+ doc lint（任何审计数字/registry summary 数字缺 `how_counted` → 红）+ 接球侧 receive-handoff-grounding 反射扩展到数字 claim。
**回放判据**：给定"含未溯源数字的启动包"，拦截机制要求 claim 附 derivation（命令/文件锚点/时间戳）或标注 unverified；给定缺 `how_counted` 的 registry summary，CI lint 失败。

### SC-003 | 2026-07-07 | co-creator 继续触发 | spec-drift：thread 决策未及时写回唯一真相源

**事实**：2026-07-06 三猫 Design Gate 已在 thread 中收敛：砍 `probation`、修正 #1075 依赖、引入 `observabilityDeadline` / `nextRequiredAction`、定义 O2 hybrid / eval:sop 边界。但 2026-07-07 co-creator 说"继续"时，分支 spec 仍停留在首棒 commit，保留旧 schema（`active|probation|dormant|retired`）、旧 #1075 blocker 和未闭合 OQ。真实状态存在于消息流，不在 feature doc。
**同类前科**：家规"消息不是真相源"；F216/LL-069（scope 跟自我解读走不跟 spec 走）；#1080（A2A claim 无 durable anchor）。
**期望拦截层**：Design Gate closure lint——进入下一 Phase 前，Feature spec 必须反映已收敛的 OQ/KD/Risk；禁止出现已退回字段（如 `probation`）和已证伪 blocker（如 #1075 作为 Phase B 硬依赖）。
**回放判据**：给定"thread Decision Packet + stale feature spec"，lint 能标出：OQ 状态仍未闭合、旧 blocker 字符串仍存在、Design Gate 决策未落到 Key Decisions；修复后 lint 绿。

<!-- 新案例追加在此行上方 -->
