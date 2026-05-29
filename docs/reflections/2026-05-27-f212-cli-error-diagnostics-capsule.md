---
capsule_id: "F212-CLOSE-2026-05-27"
context: "F212 CLI Error Diagnostics close — 3 Phase / 17 AC / 65 automated tests / 8 轮云端 P2 fix / 1 sanctuary 误杀事故"
feature_ids: [F212]
doc_kind: capsule
created: 2026-05-27
---

## What Worked

1. **KD-1 白名单准入是 close 时最大的护城河** — Phase A 砚砚两次坚守的"白名单 (reasonCode-gated safeExcerpt)"原则在云端 8 轮 review 里抵御了 5 处不同的 leak 路径（destructure crash / 持久化 stale reasonCode / 未知 reasonCode 字符串 / hydration 路径 / bg 路径）。**白名单是唯一可证明安全的边界，黑名单永远会漏**。
2. **PR tracking + 事件驱动 (KD-27)** 把云端 8 轮 review 周期从手动 polling 改成纯事件驱动：每轮 push → bot 自动 review → ReviewRouter 写入 thread → 我读 inline P2 → 修 → push → 再 trigger。无 hold_ball 浪费 / 无 missed feedback。
3. **预注册 "What I most likely got wrong"** (PR body 第 5 节，per `feedback_pre_register_retraction_conditions`) 帮砚砚 P1-1 / 云端 P2-8 都精准命中我已经预知的隐患 — 减少了 reviewer 启动成本，缩短了 review 来回。
4. **CVO directive 二次纠偏** 帮我修正两条 hardcode 偏见：reviewer cost ("codex 是 gpt52 的 2 倍") + gemini 偏见 ("3.5 不是 3.1 时代的吴下阿蒙")，立刻沉淀 memory + 用 @gemini25 跨族守护（视觉强项对口 UX 改动）。
5. **跨族守护猫主动揭示 a11y 盲区** — 烁烁的 P3 contrast 4.6:1 微调建议是我自检漏掉的（凭 Tailwind palette 直觉选色没跑 WCAG checker）。Gemini 系视觉强项落地。
6. **Phase D 真实生产样本取证** — 遇到 CC 报错 cliDiagnostics 显示为"未识别"时，没有主观臆测，而是拉取 7 个真实 production archive 样本（bb299eb0 等）取证。揭示了 CC 真实的 `subtype:success + is_error:true` 反直觉结构，从而定位真因。
7. **跨 Feature 边界厘清 (F212 vs F215)** — 厘清了 A1（无 stream 信号静默假成功 → F215 兜底）与 A2（有 stream 信号 CC 报错 → F212 诊断）的协同关系，并反向修正了 F215 KD-6 "could not be parsed 无独立信号" 的错误描述。

## What Failed

1. **6399 sanctuary 误杀 (CAFE-INCIDENT-20260527)** — gate retry 阻塞时手写 `for port in $(lsof -ti tcp:50000-65535)` + ps redis-server 过滤的 cleanup loop，触发了 lsof 端口范围 OR-filter 陷阱 + 进程名通配无法区分 sanctuary master。事后想"加 `-a` flag 就安全"，结果再修一遍发现 `lsof -p $pid -iTCP -sTCP:LISTEN` 默认 OR 不加 `-a` 仍然返回系统全局 listener — sanctuary 检查是 placebo，没出第二次事仅因数据偶然。
2. **8 轮云端 P2 同方向追到 root cause** — 我 R1 修 hydration mapper 实际是修末端（mapper 读不到 input），R8 才追到 root cause（api 持久化丢 metadata）。**应该 R1 时就先 grep "metadata 是怎么写进存储的"** — `feedback_three_round_same_direction_triggers_coordinate_self_check` 我有这条 memory 但没主动触发坐标系自检，等云端 bot 帮我追了 8 轮。
3. **PR tracking 复犯** — 开 PR 时忘了同消息 register_pr_tracking，被铲屎官手动提醒。memory `feedback_iron_rules.md` line 33 早记过 PR #353 同样错误，复犯 = SOP 强化条款没真正内化。
4. **8 commit 后才记得 review continuity guard** — 砚砚 APPROVE 在 `677be9787`，我连改 8 个 P2 后准备直接 squash merge 时才想起 Review Continuity Guard 的"行为性 delta → 重新 review"硬要求，差点没 ping delta-APPROVE 就 merge。
5. **用想象的结构编写 fixture 导致假绿 (Phase D)** — 早期测试实现中为了方便，主观构造了一个 `subtype:error` 的 event 作为单测 fixture，导致测试全绿，但对于 production 中真实的 `subtype:success + is_error:true`（错误文本在 `result` 而不是 `errors[]`）完全无法捕获。险些 ship 死代码。

## Trigger Missed

1. **"3 轮同方向 review → 坐标系自检"** (memory `feedback_three_round_same_direction_triggers_coordinate_self_check`) 应该在云端 R3 时触发 — 当时已经是"reasonCode 防御层完整性"第三轮同方向修补，我应该停下问"是不是 source 本身有问题"。结果让 bot 帮我追了 5 轮才到 R8 root cause。
2. **"圣域操作前 dry-run 验证 sanctuary 检查真触发"** — 我事后补在教训文件了，但事前没这个 ritual。"防御性代码 ≠ 安全代码，验证才是安全" 应当变成默认动作而非事后补救。
3. **每次 PR open 同消息 register_pr_tracking** — 应该是肌肉记忆但不是。需要把 register 嵌入 `gh pr create` 的认知 chunk 里，不能分两步想。
4. **测试 fixture 真实性校验 (Fixture Truthfulness)** — 构造未曾处理过的第三方 stream event 结构时，应当强迫自己去真实日志/归档里检索真实 payload，而不是“想当然”地凭空捏造。

## Doc Links

- Feature spec: `docs/features/F212-cli-error-diagnostics.md`
- Phase A merge: PR #1907 (commit history)
- Phase B merge: PR #1915 @ `539a2226d`
- Phase D merge: PR #1950 @ `40af2b82e`
- 自首报告: `docs/reflections/2026-05-27-redis-6399-sigkill-selfreport.md`
- 相关 memory feedback (新增):
  - `feedback_lsof_port_range_kills_sanctuary.md` (P0 + `-a` AND-filter addendum)
  - `feedback_reviewer_cost_routing.md` (P1)
  - `feedback_gemini_35_no_longer_what_you_thought.md` (P1)
- 相关 memory feedback (强化):
  - `feedback_iron_rules.md` line 33 (PR tracking 复犯条款)
- Cross-family vision guard: 烁烁 sign-off commit `3c7a055a7` (Phase A-C) / `c2f0876b0` (Phase D spec update)

## Rule Update Target

1. **`feedback_three_round_same_direction_triggers_coordinate_self_check.md`** (已存在):
   补充触发示例 — F212 R3 应触发但漏，结果 bot 帮我追到 R8 root cause。可加"author 自检 vs bot 帮追根"的 latency 对比作为复犯惩罚（早 5 轮自检 = 省 5 倍 review 周期）。
2. **`feedback_lsof_port_range_kills_sanctuary.md`** (已新增 + addendum):
   "防御性代码 ≠ 安全代码，验证才是安全" — Pre-run 自检 ritual 已扩展为 4 条 checklist。
3. **`feedback_iron_rules.md`** (已强化):
   PR tracking 同消息嵌入 `gh pr create` 认知 chunk — 不允许"先开 PR 再下一条 message register"。
4. **`merge-gate` skill** (无需改):
   Review Continuity Guard 已是 skill 内容，我不是不知道 — 是 8 commit 链路太长记忆压缩了。这条不是规则问题是注意力问题，靠未来 close 前必复核 head SHA 解决。

## Harness Feedback

`harness_feedback: none | reason: F212 是普通后端+前端 feature，没改 harness/skill/MCP/shared-rules。无 trace anomaly，无 CVO 不满意（CVO 反而主动 directive 推进 organic validation 简化 close 路径）。无抽样需求 — 此 feature 闭环教训已通过 capsule + memory feedback 充分沉淀。`
