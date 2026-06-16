---
feature_ids: [F236]
topics: [context-engineering, token-budget, collaborative-thinking]
doc_kind: discussion
created: 2026-06-15
---

# Anchor-First Context 入口 讨论收敛纪要（F236 立项）

**日期**: 2026-06-15 | **参与者**: 宪宪 (opus-48, 发起+扇入) + 砚砚 (gpt-5.5/@codex, 独立架构判断) + 铲屎官 (signoff 开 feat) | **关联**: F148 / ADR-038 / research 2026-06-15-context-entry-anchor-audit

## 背景
rtk teardown（`docs/discussions/2026-06-15-rtk-deep-dive/`）→ 铲屎官问"能学什么省 token" → 宪宪自审发现"承诺没用必须软+硬+eval" + "分级压缩 = 我们 anchor 愿景" → research 盘点 context 入口（`docs/research/2026-06-15-context-entry-anchor-audit/`）→ 铲屎官 signoff 开 feat + 指定联合砚砚（贵的 @codex gpt-5.5）一起思考。

## 各方观点
- **宪宪**：anchor-first 立统一架构能力，F148（消息侧 done）+ 新 feat（返回侧）成版图，共享"进 context 必 anchor-first + 最内层封顶"原则；rtk 学手法不抄哲学（无损 anchor > 有损 truncate）。
- **砚砚**（独立抽源码后）：同意新 F 号（不 reopen F148），但 V1 必须更窄更硬；发现 `get_message` drill 终点也回 full（dump 只是推迟）；提出 anchor tax 双边 eval 公式。

## 共识区
1. **新开 F 号（F236），不 reopen F148**——F148 已 closed + 边界不同（消息侧 vs 返回侧），F148 仅作上游设计来源。
2. **companion ADR（203）立原则**：进主 context 的返回必 anchor-first + 最内层封顶。
3. **V1 窄**：只做完全可控的 MCP 协作读工具，不碰 runtime transform（二期）。
4. **rtk**：学 per-type projection / dedup 折叠 / 诚实计量；不抄有损 truncate / bytes/4。
5. **anchor tax 是最大风险**，eval 必须双边公式（不许只报单边下降）。

## 砚砚 sharpen（宪宪全接受）
1. **`get_message` drill 终点也要 bounded**（mode=preview|full / maxChars）——否则 dump 只从列表推到第二跳。
2. **outputSchema 迁移 + subagent schema 硬约束别进 V1**——subprocess 不可达 + 架构升级 → Phase B / 另设计。
3. **第一刀落点 = callback route 的 projection helper**（payload 在 route 组装），不是 MCP wrapper。
4. **pending mentions 不能粗暴截断**（传球指令语义）→ head+tail actionable excerpt + `requiresDrill`。

## 分歧区
无实质对立。砚砚的均为 sharpen（收窄 + 加硬），宪宪全接受。

## MVP（收敛）
V1 = Top3 协作读工具（`get_thread_context`/`get_pending_mentions`/`list_tasks`）+ `get_message` drill 终点；default anchorized preview；第一刀 route projection helper；双边 eval telemetry。
Phase B = outputSchema 迁移。二期 = runtime transform。另设计 = subagent schema 硬层。

## 待决（CVO）
- F236 + ADR-203 落地（铲屎官已 signoff 开 feat，此为执行确认）。

## 行动项
- [x] 立项 F236 + companion ADR-203
- [ ] Design Gate（后端/架构类，砚砚已参与共识，Eval Contract 已在 spec）
- [ ] worktree + tdd 实现 V1

## 收敛检查（三件套）
1. **否决理由 → ADR**：✅ 有 → ADR-203 记：否决 reopen F148（closed + 边界不同）/ 否决 V1 做 outputSchema 迁移 + subagent schema 硬约束（subprocess 不可达 + 架构升级）。
2. **踩坑教训 → lessons**：✅ 有（候选，待 feat close 正式沉淀）→ ① 宪宪凭推理说"Workflow schema 能强制 subagent"，subprocess 实际不可达（capability 推理错，p_mode 病变体）；② drill 终点不 bounded = dump 只推迟到第二跳（anchor 化必须端到端，不能只改列表层）。
3. **操作规则 → 指引**：✅ 有 → 进 ADR-203："进主 context 的返回必 anchor-first + 最内层封顶 + 双边 eval 公式"。

## 追溯链
- 上游：F148（消息侧）/ ADR-038（L0 staging）/ research: `docs/research/2026-06-15-context-entry-anchor-audit/`
- 本体：F236 + ADR-203
- rtk 对照：`docs/discussions/2026-06-15-rtk-deep-dive/`
