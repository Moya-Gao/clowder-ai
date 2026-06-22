---
feature_ids: [F236]
topics: [harness-eval, anchor-first, sunset-trigger, review-request]
doc_kind: mailbox
created: 2026-06-22
---

# Review Request: F236 AC-E3 sunset trigger — sunset signal flags + eval cat criteria

Review-Target-ID: f236-ac-e3
Branch: feat/f236-ac-e3

## What

F236 Phase A/B-Eval 最后一块拼图：sunset 触发层。3 个文件改动：

1. **`eval-anchor-first-live-verdict.ts`** (+62 lines): attribution findings 加 per-tool `sunsetSignals` (anchorTax / highOpenRate / netNegative) + root-level `sunsetAssessment` 摘要。severity 从 medium/low 三级升级到 high/medium/low；proposedAction 新增 `sunset`。阈值 `SUNSET_OPEN_RATE_THRESHOLD = 0.8`（数据呈现，非确定性判定函数——eval 猫 owns verdict）。
2. **`eval-cat-invocation.ts`** (+2/-2): eval:anchor-first 域指令增强双信号判据 + task-outcome 交叉引用 + verdict mapping。
3. **`eval-anchor-first-live-verdict.test.js`** (+381 lines): 7 个新测试覆盖所有信号组合（anchorTax / highOpenRate-only / netNegative-only / healthy / mixed）。

## Why

Phase A/B 已上线（preview/drill/open-rate 全链路），但"什么时候该 sunset anchor"没有闭环——只靠铲屎官提醒或猫猫主观判断 = 假闭环（ADR-031 eval 层欠债）。AC-E3 补上最后一层：

- attribution bundle 预计算 sunset 信号旗，eval 猫不用自己手算 openRate > 80%
- eval 猫指令明确双信号判据（anchor tax + blindness cross-ref task-outcome）
- verdict mapping 给明确指引：both → delete_sunset / single → fix / neither → keep_observe

设计约束："不写确定性净收益计算函数"（feat doc KD）——阈值是 data presentation not verdict automation。

## Original Requirements（必填）

> AC-E3（sunset 触发 + Phase C 数据依据）: verdict 净亏 → 自动 alert 标记该工具 anchor 该回退 inline（不靠铲屎官提醒）；verdict 净益 + 无变瞎子 → 作为 Phase C 扩展的数据依据（非硬 gate）

- 来源：`docs/features/F236-anchor-first-context-entry.md` line 79（AC-E3 条目）
- **请对照上面的 AC-E3 spec 判断交付物是否完整覆盖**

## Tradeoff

- **不在 afterPublish 加 auto-notification code**：原有管道已经通过 eval 猫指令（common publish instructions）要求 actionable verdict 跨 thread cross-post。AC-E3 通过强化指令（verdict mapping + 双信号准则）让 eval 猫的 cross-post 内容更 actionable，而不是在 server 端加新的通知管道。
- **不搞 runtime per-tool "anchor enabled" toggle**：sunset = eval 猫发 verdict → owner 猫改代码（或 CVO 决策 delete_sunset）。没有 runtime flag toggle（那是 Phase C AC-C5 的 scope）。
- **阈值 0.8 硬编码 vs 可配**：硬编码——只有 3 个 preview tool，不值得 YAML 配置化；改阈值 = 改一行常量。

## Architecture Ownership（必填）

Architecture cell: harness-eval / anchor-first
Map delta: none
Why: 在已有 anchor-first live-verdict generator 内加字段和逻辑，不新建 Store/Queue/Router/Adapter

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 Store / Queue / Router / Adapter / Dispatcher / Binding
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **阈值选择**：`SUNSET_OPEN_RATE_THRESHOLD = 0.8` 是否合理？feat doc 原文写"anchorOpenRate 持续 >80%"，我照搬了。但这是 presentation threshold 不是 hard gate（eval 猫 owns verdict），所以偏差影响有限。
2. **blindness signal ②**：指令里写 "reference-read eval:task-outcome"，但没有代码级 cross-ref（eval 猫自己去读 task-outcome thread）。这是 spec 的设计意图（"F236 does NOT write to eval:task-outcome; cross-reference only"）还是该加代码联动？
3. **sunsetSignals.anchorTax 的语义**：当前 = highOpenRate AND netNegative（双信号同时触发）。是否需要考虑"持续"维度（连续 N 周）？还是单次 weekly rollup 就可以触发？

### 价值 OQ（给 CVO，如有）

无。回滚成本低（一个 commit），技术细节层面猫猫自决。

## Next Action

请 review 代码正确性 + 信号设计合理性。如果没有 blocking issue，请 APPROVE，我走 merge-gate。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f236-ac-e3/{reviewer-handle}`
- Start Command: 纯后端逻辑，无需启动服务。`node --test packages/api/test/harness-eval/eval-anchor-first-live-verdict.test.js` 即可验证。
- Ports: N/A（不涉及前端）

## 自检证据

### Spec 合规

- AC-E3 spec 4 个要求全覆盖：
  - ✅ "verdict 净亏 → 自动 alert" → sunsetSignals.anchorTax flag + severity='high' + proposedAction='sunset' + eval 猫指令 verdict mapping
  - ✅ "标记该工具 anchor 该回退 inline" → per-tool sunsetSignals + sunsetAssessment 摘要
  - ✅ "不靠铲屎官提醒" → eval 猫 cron-triggered + 指令含明确 verdict mapping
  - ✅ "verdict 净益 + 无变瞎子 → Phase C 数据依据" → keep_observe verdict + eval 猫指令 "log as Phase C expansion data basis"

### 测试结果

```
node --test (anchor tests)     # 34 passed, 0 failed
  - 7 new AC-E3 sunset signal tests
  - 27 existing anchor tests (no regression)
pnpm --filter @cat-cafe/api build  # 成功
pnpm biome check (my files)        # 0 errors
```

### 相关文档

- Feature: `docs/features/F236-anchor-first-context-entry.md` (AC-E3 section)
- ADR: ADR-203 (anchor-first context entry)
- Plan: inline in feat doc (Track-2 交接块 + AC-E3 spec)

---

[宪宪/claude-opus-4-6🐾]
