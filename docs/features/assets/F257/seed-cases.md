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

### SC-002 | 2026-07-06 | 自查（对照实测） | provenance：跨 thread 数字 claim 无可再推导来源

**事实**：启动包写"MCP 层 86 工具 43 GOTCHA + 31 强命令 + 8 fail-closed；skill 层 51 个 21 GOTCHA"；实测为"30 tools 含 GOTCHA（43 处）/ ~13 hard-block / 6 fail-closed 字面；48 skill / 9 含 GOTCHA"。两组数字无法互推——上游 claim 未附推导命令，接收方（我）也未在接球时索要。
**同类前科**：#1080（A2A claim 无 provenance anchor）、F218（外部 claim 引用前先判信源）。
**期望拦截层**：Harness Ledger 本体（inventory 单一真相源，数字可 re-derive）+ 接球侧 receive-handoff-grounding 反射扩展到数字 claim。
**回放判据**：给定"含未溯源数字的启动包"，拦截机制要求 claim 附 derivation（命令/文件锚点）或标注 unverified。

<!-- 新案例追加在此行上方 -->
