---
capsule_id: "F192-2026-05-27"
context: "F192 Socio-Technical Harness Eval — 5 Phase (A-E) 完成，从 doc type 到 Eval Hub 控制面"
feature_ids: [F192]
doc_kind: capsule
created: 2026-05-27
---

## What Worked

- **Phase B→C 重新定性（KD-5）**：Phase B 原本定位为"pilot 完成"，被重新定性为"预期声明层"（should be），Phase C 才是"实际观测层"（actually is），diff = eval signal。这个坐标变换让后续 Phase D/E 的设计清晰了很多——预期和实际分离才能做 eval
- **TDD 贯穿全流程**：从 Phase A scanner 测试到 Phase E sanitizer 25 个测试，每个 AC 都有 Red→Green 证据。E-community 的 sanitizer 多层 scrub 经历 7 轮 cloud review 每一轮都是先写失败测试再修
- **Verdict Matrix Contract 硬化**：Phase E owner review R1 时，从自由文案 verdict 升级为 4-enum verdict（fix/build/delete_sunset/keep_observe）+ 结构化证据门槛 + closure 规则，杜绝了"你去看看"式 handoff
- **E-community sanitizer 多层设计**：证据 ref → Feature ID → Thread ID → Cat identity 有序匹配 + word boundary + underscore lookahead + cross-record key mapping，经受住了 7 轮 review 的递进式攻击
- **PR packaging 决策**：Phase E 24 ACs 按功能块收敛为 4 个 PR（E-hub/E-scale/E-sop/E-community），避免过细 PR 的 review/merge overhead。CVO + 46/55 三方共识

## What Failed

- **OQ-16/17/18/19 eval pipeline livefix**：CVO dogfood 后一口气报了 3 个 production gap——eval threads 侧边栏不可见、Hub 不显示全部 domains、scheduled eval 未注册。根因是"机制 ship 但用户感受不到"，Phase E-pilot merge 后缺 dogfood（后来补了 F209 dogfood-your-slice 规则）
- **sanitizer evidence ref pattern ordering**：slash-delimited refs（如 `snapshot:eval-F167-2026-05-21`）含嵌入式 `F\d{3}`，如果 Feature ID pattern 先匹配就会破坏 ref。正确顺序是 evidence ref → feature ID → thread ID → cat identity。这个 bug 在 cloud review round 3 才被发现
- **cross-record key mapping 一致性**：dailyTrend 的 current/baseline/threshold 三个 record 的 key 独立 scrub 后可能映射不一致（key A 在 current 被 scrub 为 X，在 baseline 被 scrub 为 Y）。需要 buildScrubKeyMap 统一映射。cloud review round 4 才发现
- **Stale Redis blocking pnpm gate**：orphaned test Redis instances 占端口导致 gate 失败。诊断花了时间，最终用 `redis-cli SHUTDOWN NOSAVE` 解决（不能 kill -9，要尊重 6399 圣域）

## Trigger Missed

- **应该在 E-pilot merge 后立即 dogfood**：如果我在 E-pilot merge 后自己走一遍"打开 Hub → 看 eval thread → 检查 domain 列表"，OQ-16/17/18 会提前暴露，不用等铲屎官 dogfood 发现
- **sanitizer 设计时应考虑 pattern ordering**：evidence ref 语法含 feature ID 子串这个事实在设计时就可预见，不应该等到 cloud review round 3
- **应该更早建立 scrub key mapping 的跨 record 一致性不变量**：独立 scrub 的隐含假设（"每个 record 独立处理"）在设计时就不对，共享 key space 需要共享 mapping

## Doc Links

- Feature spec: [F192](../features/F192-socio-technical-harness-eval.md)
- 原始讨论: [2026-05-05 socio-technical eval draft](../discussions/2026-05-05-socio-technical-harness-eval-draft.md)
- Phase E kickoff: [2026-05-21 eval hub kickoff](../discussions/2026-05-21-f192-phase-e-eval-hub-kickoff/README.md)
- 相关 ADR: ADR-031 (harness engineering), ADR-032 (trace data governance)
- F209 dogfood-your-slice 规则（来自本 feature 教训）

## Rule Update Target

- `cat-cafe-skills/SKILL-quality-gate.md` Step 4.5 Dogfood-Your-Slice — 已在 F209 中落地，来自 F192 Phase E-pilot 的 OQ-16/17/18 教训
- `packages/api/src/infrastructure/harness-eval/community-issue-packet.ts` — scrub pattern ordering 和 cross-record key mapping 是 sanitizer 工程的通用教训，如果未来其他模块需要脱敏导出，注意：(1) 长 pattern 先匹配短 pattern 后；(2) 共享 key space 共享 mapping
