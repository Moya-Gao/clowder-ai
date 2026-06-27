---
feature_ids: [F167]
related_features: [F064, F027, F122, F055]
topics: [a2a, collaboration, harness-engineering, agent-readiness]
doc_kind: spec
created: 2026-04-17
tips_exempt: harness-internal shadow telemetry infra — no user-visible capability change
---

# F167: A2A Chain Quality — 乒乓球熔断 + 虚空传球检测 + 角色护栏

> **Status**: in-progress | **Owner**: 布偶猫 | **Priority**: P0

## Why

F064 解了"漏传球"（该 @ 没 @），但三个月后暴露了反向问题群：乒乓球（同一对猫反复 @ 无产出）、虚空传球（说"我来做"但 @ 了对方导致球在地上）、角色不适配 handoff（让 designer 写代码）。

铲屎官定期审视 harness engineering 的结论（2026-04-17）：现有 A2A 出口检查只覆盖"漏传球"，没覆盖"过度/假/错误传球"。

**根因（第一性原理回溯后修正）**：猫有两条路由路径——MCP 结构化（`targetCats`）和文本 @（行首解析）——两条都能用，但 4.7 两条都没用对。根因不是"@ 协议脆弱"，也不是"脚手架旧"，而是：

1. **模型不理解我们的路由机制**：4.7 在句中写 @（不路由）、以为"说了=做了"（没发 tool call 也没写行首 @）。语义 handoff 和执行 handoff 脱钩。
2. **我们的提示词有隐含假设**：大量"禁止 X"式规则，Spirit Interpreter 自动补全边界（"不碰 runtime"= 不改但可读），Literal Follower 字面执行（"不碰 runtime"= 完全不碰）。
3. **缺少基本运行时刹车**：无 ping-pong 检测、无角色门禁——这些应该是 harness 基础设施，和模型无关。

**核心哲学**（来自 Round 4 数学之美讨论）：

> 好 harness 不是替模型思考，而是让模型在正确的坐标系里思考。
> 真正的 Harness 工程 = 对齐模型的好直觉 + 压制模型的坏直觉，其他一律极简。
> 复杂是无知的代偿。

铲屎官原话：
> "你们两！！没完没了互相at半天！特么不干活！！！！"
> "解决了47的问题或许什么glm什么kimi minimax qwen的问题也就解决了。。都是小笨猫"
> "我们必须要知道为什么的！不然以后每次模型升级假设来了个超级无敌牛逼猫猫，benchmark惊人！结果哈哈哈哈"

## Design Constraints

1. **路由可见性不退化**（铲屎官拍板）：若猫通过 MCP `targetCats` 路由但响应文本无 @mention，系统须自动补可见路由指示，不可让协作"悄咪咪"发生。
2. **Provider-agnostic**：护栏不依赖特定模型行为，对所有引擎生效。
3. **Backward compatible**：不退化 4.6 等已正常工作模型的体验。
4. **极简**：只加运行时刹车（压制坏直觉）和认知路径工程（对齐好直觉），不加认知脚手架（替模型思考）。

## Eval / Tracking Contract

> **何时填**：harness / skill / MCP / shared-rules 类 spec 立项时填本节。判断标准：改动会改变猫猫行为模式 → 填。否则跳过。
> **Design Gate**：本节是硬门禁。空填 / 缺关键字段 → Design Gate 不通过。

### 1. Primary Users + Activation Signal

- **Users**：
  - CVO：不再充当人肉路由（受益方，不直接操作）
  - Cats：author（写 @）/ reviewer（给 verdict）/ designer（被 restrictions 保护免做 coding）
  - Runtime：WorklistRegistry（streak 追踪）/ exit check（注入路由提示）/ `cat_cafe_hold_ball` MCP / cat-config.restrictions（数据驱动能力限制，Phase E KD-20）
- **Activation signal**：
  - **L1 ping-pong 熔断**：WorklistRegistry 里 `(catA, catB)` 连续 same-pair streak ≥ 2 (warn) / ≥ 4 (break)
  - **C2 forced-pass guard**：invocation 输出含 review verdict 关键词（approve / reject / P1 / P2 / LGTM / 修改建议）但末尾无行首 @
  - **L3 → 数据驱动限制**：cat-config.restrictions 双端 prompt 注入（发送方队友名册 + 目标猫 self-awareness）；原 L3 硬编码 regex 已退役（KD-20）
  - **C1 hold_ball**：cat 显式调用 `cat_cafe_hold_ball` MCP（区别于"我先 hold 一下"的纯文本状态描述）

### 2. Friction Metric

- **L1 false-positive 误杀**：正常 review 循环 A→B→A→B (streak=3) 被误杀 → reset 条件（第三只猫 / user 消息）必须正确触发；覆盖见 `pingpong-reset.test.js`
- **C2 over-fire**：纯信息查询无后续动作的输出被强制要求 @（边界场景：信息回答 vs 协作传球的判定漂移）
- **C1 hold_ball 滥用**：`maxHoldsPerWindow` 超限（默认 3 / ~1h rolling）→ cat 在用 hold 替代正常传球
- **Routing 旁路**：invocation 文本响应有 @ 但 MCP `targetCats` 为空（或反之）→ `routing-syntax-hint`（route-serial 行首 @ 语法检测）或 `verdict-no-pass-hint`（verdict 无 @ 出口检测）触发

### 3. Regression Fixture

- `ping-pong/streak-4-break` → `worklist-registry-streak.test.js`（AC-A1）
- `ping-pong/false-positive-review-loop` → `pingpong-reset.test.js`（AC-A3）
- `callback-a2a-pingpong` → `callback-a2a-pingpong.test.js`（AC-A4）
- `void-pass/say-but-not-do` → 砚砚 5 线程截图（PR #1289 P1 evidence）
- `role-gate/l3-retired` → `route-serial-pingpong.test.js`（AC-E — asserts `a2a_role_rejected` must NOT fire after KD-20 retirement）
- `forced-pass/review-verdict-no-mention` → `route-serial-verdict-hint.test.js`（C2 verdict detection）
- `hold-ball/zombie-hold` → 砚砚原话 "Hold 不是对外协议状态"（C1 设计动机）

### 4. Sunset Signal

- **Environment drift**：模型升级后 prompt 层球权规则被自然吸收（exit check / forced-pass 提示）→ C2 prompt 段可降级为只 hint 不强制；但 **L1 streak breaker 是基础设施保留**（与模型无关）
- **Subsumption (in-feature)**：路由协议从两条（行首 @ + MCP `targetCats`）收敛到一条 → 路由旁路检测简化为单一路径
- **Subsumption (cross-feature)**：F181 (Prompt X-Ray) + 跨路由 trace propagation 上线后，A2A friction 改用 trace-based detection 替代 prompt-based 提示 → C2 forced-pass prompt 段可废弃
- **Adoption decay**：近 6 个月 ping-pong streak ≥ 4 触发 0 次 + 实战观察未出现该失败模式 → L1 熔断从 `break` 降级为只 `warn`

## What

### Phase 0: 系统提示词正面化审视（P0，多猫协作）

在写任何 harness 代码之前，先审视"地形"——让模型自然往正确方向跑，而不是加铁丝网。

**审视范围**（完整注入链路）：

| 来源 | 谁看到 | 审视什么 |
|------|-------|---------|
| `shared-rules.md` | 所有猫（canonical） | "禁止 X" → "允许 Y，禁止 Z"（显式边界） |
| `governance-l0.md` | codex/gemini（sync 源） | 和 shared-rules 对齐 |
| `GOVERNANCE_L0_DIGEST`（SystemPromptBuilder.ts） | 所有猫（runtime 注入） | 和 governance-l0 同步 |
| `CLAUDE.md` | Claude 猫 | 负面禁令 → 正面指令 |
| `assets/system-prompts/cats/codex.md` | codex/gpt52/spark | 同上 |
| `assets/system-prompts/cats/gemini.md` | gemini | 同上 |
| `WORKFLOW_TRIGGERS`（SystemPromptBuilder.ts） | per-cat | 检查和正面化后是否矛盾 |
| Skills（`cat-cafe-skills/`） | 按需加载 | 审视有无 "used when / not for" 清晰边界（参考 Anthropic skills 实践） |

**正面化原则**：
- "不碰 runtime" → "可读日志/搜索输出；禁止修改/重启/删除 runtime 文件和进程"
- "禁止乱 @" → "行首 @ 或 MCP targetCats 是仅有的两种路由方式，其他写法无系统效果"
- SOP 轻重：给正反例 few-shot（5-line patch 走轻量路径 vs 跨模块 feature 走完整 lifecycle）
- Skills 审视：每个 Skill 是否有明确的 "Use when" + "Not for" 边界（让模型一眼识别适用场景）

### Phase A: Harness 硬护栏（P0）

三个运行时刹车，不依赖模型遵守 prompt：

**L1 — 乒乓球熔断**：WorklistRegistry canonical enqueue 点追踪连续 same-pair streak。streak=2 警告，streak=4 熔断。覆盖 serial + callback 双路径。

**L2 — Parallel @ mention 降噪**：prompt 层禁止 parallel 模式 @句柄 + harness 层 route-parallel 的 mentions 标记 `suppressedInParallel`，不写入 routedMentions；followupMentions 路径同步抑制。

**L3 — 角色适配门禁**：A2A handoff 时检查目标猫角色能力。MVP：designer 角色 + coding/fix/test/merge 关键词 → fail-closed 报错 "⛔ @{cat} 不接受 {action} 任务"。动作判定复用 `AFTER_HANDOFF_RE` 模式 + cat-config `capabilityTags`。

### Phase B: 观察 + 按需补充（P1，Phase 0+A 效果验证后）

Phase 0 正面化 + Phase A 刹车上线后观察。只有证据表明还有缝才补：
- 虚空传球是否仍频繁出现？→ 按需加简单检测
- always_at_back 是否仍在放大 ping-pong？→ 调整为"有产出才 @ 回"
- 6 个事故 case 做回放测试，验证 Phase 0+A 覆盖率

#### B2 — Ball Ownership Protocol Hardening（2026-04-19 实战迭代）

基于铲屎官实时观察 + 截图证据，迭代修复 6 个球权协议漏洞：

| # | Anti-Pattern | 修复 | 位置 |
|---|-------------|------|------|
| 1 | 铲屎官球权盲区（不知 @ 谁） | exit check 注入 `@landy`（coCreator config 动态取） | SystemPromptBuilder |
| 2 | 球权死锁（收球说"你等着"） | 禁止——做不了就退/升 | shared-rules §10 + exit check |
| 3 | 虚假离场（不@但还在干，倒装句误导） | 结尾声明"球在我手上，继续 X" | exit check |
| 4 | 状态描述代替球权声明 | 核心原则 + 接/退/升三选一 | shared-rules §10 |
| 5 | 诊断不解决（push back 不接/退/升） | push back 后必须紧跟接/退/升 | exit check |
| 6 | Codex context overflow（272k 用 900k limit） | 动态 contextWindow + autoCompactTokenLimit per variant | CliConfig + CodexAgentService |

**根因**（砚砚自我剖析）："Hold 不是对外协议状态。要么静默执行，要么接/退/升。" RLHF "check in" 反射在 agent 链路里变成球权黑洞。

### Phase C: 球权出口闭环 — 砚砚不传球的两种根因（P1）

**发现**：铲屎官审阅 5 个活跃线程，砚砚全部不传球。砚砚自我诊断两种不同的不传球模式：

| 模式 | 表现 | 根因 | 解法 |
|------|------|------|------|
| **真持球** | "我想继续做"但 CLI 退出，球掉地上 | 持球没有执行层 | **C1: hold_ball MCP** |
| **假终局** | review/分析给了结论就停了，不传球 | "结论 = 终点"错觉 | **C2: 强制传球护栏** |

> **砚砚原话**："Phase C 治的是'我想继续拿球却拿不住'；治不了'我根本没意识到该传球'。"

**共同设计约束**（砚砚 + 宪宪讨论收敛）：
1. **"持"是例外态，不是四选一常态。** 默认三选一：接/退/升。（KD-13）
2. **不先做独立 skill。** 球权管理是基础协议。踩坑经验收进 `refs/ball-ownership-patterns.md`。（KD-15）

---

#### C1: Hold Ball MCP — 有界持球（治"真持球"）

**问题**：猫声明"球在我手上，继续 X"后 CLI 进程退出，无人再唤醒 → 持球只有语义层没有执行层。

**方案**：`cat_cafe_hold_ball` MCP tool。猫调用 → 系统记录 → CLI 退出后自动再唤醒。

**v1 Tool Signature**：
```typescript
cat_cafe_hold_ball({
  reason: string,      // 为什么需要持球
  nextStep: string,    // 唤醒后的第一个动作
  wakeAfterMs: number  // 多久后唤醒（有界等待，KD-14）
})
```

**Use when**：球明确在你手上 + 无人能推进 + 短暂可预期等待 + 醒来后知道下一步。

**Not for**：需要别人拍板/验收/人工操作 → `@landy`；需要另一只猫动 → `@句柄`；"我再想想""我先 hold 一下" → 这是犹豫不是持球；状态更新 → 直接说。

**唤醒注入**：
> 你上轮持球：{reason}
> 球仍在你手上。现在执行：{nextStep}
> 若条件仍未满足：再持一次或升级；禁止无限持球。

**Guard**：`maxHoldsPerWindow`（默认 3，~1h rolling 窗口，per thread×cat），超限强制接/退/升 + 审计日志。
*实现注记*（gpt52 review on PR #1289 P1/P2）：语义是"窗口内累计"而非"真·连续"；状态进程内 in-memory，best-effort，重启会重置。要做硬约束得把计数下沉到与 reminder scheduler 同源的持久化存储，当前不做。

**并发语义**（Phase G / KD-23 补充）：

- **外部 wake 撞持球期**：hold wake 在 fire 时走 `ConnectorInvokeTrigger.trigger` normal priority，若 cat 有 active invocation 则 `enqueueWhileActive` 排队到 InvocationQueue，**不打断**当前工作。当前 invocation 结束后才会执行 hold wake 注入的 `持球唤醒：...` 消息。
- **Stale wake 处理**：如果 external wake 已经改变 thread 语境（铲屎官发了新方向），排队后的 hold wake 消息里的 `nextStep` 可能过时。Cat 拿到 wake 时应根据 thread 最近历史判断 `nextStep` 是否仍相关——若已不相关，走接/退/升，**不盲跟 stale nextStep**。
- **二次 `hold_ball` = 单-槽替换**（Phase G AC-G3）：同 `(threadId, catId)` 只能有一个 pending hold wake。再次调用 `hold_ball` 会：先 `taskRunner.unregister` + `dynamicTaskStore.remove` 前一个 pending task，再 insert 新的。避免 stale wake 累积。若需要等多件事 → merge 到一个 `nextStep`（如 `"等 CI 且 @landy 确认"`），不要分多次 hold。

---

#### C2: Forced-Pass Guard — 强制传球护栏（治"假终局"）

**问题**：砚砚给出 review 结论（approve/reject/P1/P2/修改建议）后，以为"结论 = 终点"就停了。但 review 后 **永远有下一棒**——author 需要看到反馈并行动。铲屎官实测 5 个线程全部命中。

**根因**：exit check 的 `没人 → 不 @` 路径对 reviewer 来说太宽了。Reviewer 给出 verdict 后几乎不存在"没人需要动"的场景。

**方案（双层）**：

**L1 — Prompt 层**：exit check 增加 review 场景特殊规则：
> Review 完成后**必须传球**：给了结论（approve/reject/P1/P2/建议）→ 末尾行首 @author 或 @landy。
> Review 结论 ≠ 链条终点——author 需要看到你的反馈并行动。
> "没人需要动"对 reviewer 来说几乎不成立。

**L2 — Harness 层**（Phase B 观察后按需）：
- 检测输出中的 review verdict 关键词（approve/reject/P1/P2/LGTM/修改建议）
- 若有 verdict 但无行首 @mention 且无 hold_ball 调用 → 注入提示："你给了 review 结论但没传球，请 @ author 或 @landy"
- 不阻断，只提示（prompt-first 原则，与 Phase A 乒乓球警告同模式）

**推广**：不只是 review。所有"完工型"输出都适用——"分析完了""方案给了""诊断做了"——后面都该有球权决策。核心规则：

> **给出结论/建议/分析后，默认必须传球。** "没人需要动"只在极少数场景成立（纯信息回答、无后续动作的独立查询）。

---

#### 已知踩坑模式（砚砚贡献 + 铲屎官 5 线程观察）

| # | 坑 | 表现 | 归类 | 正确做法 |
|---|---|------|------|---------|
| 1 | RLHF check-in 反射 | "我想再确认一下"误说成持球 | C1 | 那是犹豫，不是 hold → 接/退/升 |
| 2 | 状态描述代替声明 | "我先 hold""我继续看" | C1 | 不是球权动作 → 接/退/升 |
| 3 | 诊断成瘾 | 先解释发生了什么，忘了接/退/升 | C2 | 诊断后必须紧跟球权决策 |
| 4 | 持球当礼貌 | "我还在跟进"（人类礼仪） | C1 | agent 链路里这是黑洞 |
| 5 | **Review 假终局** | 给了 verdict 就停了，不 @ author | C2 | review 结论 ≠ 终点，必须传球 |
| 6 | **"结论即终点"错觉** | 分析/方案/建议写完以为链条结束 | C2 | 结论后默认必须传球 |

**系统提示词球权段落草案**（含 C1 + C2）：
> 球权默认三种合法出口：接、退、升。
> 只有当球明确仍在你手上、当前无人能推进、且你只是在等待一个短暂且有界的时机再继续时，才调用 `cat_cafe_hold_ball`。
> `hold_ball` 不是状态汇报，不替代 `@landy`，不替代传球。
> 能继续做就继续做；需要别人动就传/升；只有"短暂等待后仍由我继续"才持。
> **Review / 分析 / 建议完成后，默认必须传球给 author 或 @landy。** "没人需要动"对 reviewer 几乎不成立。

## Acceptance Criteria

### Phase 0（系统提示词正面化）
- [x] AC-01: 所有 "禁止 X" 式规则改为 "允许 Y，禁止 Z" 显式边界格式（共享 + per-cat）— 7 文件负面指令清零（c34364da5 + b653b3021 + 13ab948c1）
- [x] AC-02: 路由规则正面化："行首 @ 或 MCP targetCats 是仅有的两种路由方式" 写入 shared-rules §10 路由方式 + runtime injection 球权检查
- [x] AC-03: Skills 审视完成，33/33 Skill 有 "Use when" + "Not for" 边界（image-generation 补齐）
- [x] AC-04: `GOVERNANCE_L0_DIGEST` 与 `governance-l0.md` 同步（含新增 Magic Words）— Rule 0 出口 + W4 正面化（c34364da5）
- [x] AC-05: SOP 轻重路径给正反例 few-shot（shared-rules §11 四档 few-shot 表）

### Phase A（Harness 硬护栏）
- [x] AC-A1: WorklistRegistry 追踪连续 same-pair streak，streak≥4 自动终止 A2A 链并 emit 系统消息（PR2 22e09f907 + 486edd804）
- [x] AC-A2: streak≥2 时向当前猫注入"乒乓球警告"提示（PR2 486edd804 — `InvocationContext.pingPongWarning`）
- [x] AC-A3: 正常 review 循环 A→B→A→B (streak=3) 不受影响；中间插入第三只猫或 user 消息 reset streak（PR2 d4636ba02 + codex R1 P1-2 修复：`resetStreak` 无 parentInvocationId 时按 threadIndex 批量清除）
- [x] AC-A4: callback-a2a-trigger 路径与 serial 文本路径走同一个 bounce 检测（无旁路）（PR2 d6360194e — 共享 `updateStreakOnPush` helper；codex R1 P1-1 修复：modern `InvocationQueue` 分支同样经过 streak 门禁）
- [x] AC-A5: parallel 模式 @mentions 日志标记 suppressedInParallel，不 emit a2a_followup_available；followupMentions 路径同步抑制（PR1 b496e83de）
- [x] AC-A6: parallel 模式 SystemPrompt 注入"@句柄 在并行模式下无路由语义"提示（PR1 942809eb6）
- [x] AC-A7: designer 角色 + coding/fix/test/merge 关键词 → route-serial handoff fail-closed + emit a2a_role_rejected（PR1 998e2274a / eec13be85）
- [x] AC-A8: 所有现有 A2A/路由/system-prompt 测试通过（PR1 329+165 tests green）
- [x] AC-A9: 新增测试覆盖 L1 乒乓球（误杀保护 + 正常熔断 — PR2 `worklist-registry-streak.test.js` + `callback-a2a-pingpong.test.js` + `pingpong-reset.test.js`）、L2 parallel 抑制（PR1 ✓）、L3 角色门禁（PR1 ✓）

### Phase B（观察 + 按需）
- [x] AC-B1: 6 个事故 case 回放验证通过（2026-04-20：runtime `/health` 正常 + 运行中猫 prompt 已吃到新球权护栏；Case E2 记录 5 个球权类 live replay + 1 个 codex context overflow 代码/测试回放）
- [ ] AC-B2: 如仍有虚空传球 → 按需加检测（2026-04-20：B2+C2 多层护栏已覆盖，进入观察期，无新 case 即 close）
- [ ] AC-B3: 如 always_at_back 仍放大 ping-pong → 降级为"有产出才 @ 回"，且 F064 出口检查不回退（2026-04-20：L1 streak breaker + break-loop 已兜住，进入观察期）

### Phase B2（Ball Ownership Protocol Hardening）
- [x] AC-B4: exit check 注入 @landy（coCreator 动态取），铲屎官球权可见（4e5795cc5）
- [x] AC-B5: 球权死锁反模式写入 shared-rules §10 + exit check（2072f350f）
- [x] AC-B6: 虚假离场防护写入 exit check（283b9dc90）
- [x] AC-B7: "状态描述≠球权声明"核心原则 + 接/退/升三选一写入 shared-rules §10（089e6d5dd）
- [x] AC-B8: 诊断不解决：push back 后必须接/退/升写入 exit check（eb459bc1d）
- [x] AC-B9: 动态 contextWindow + autoCompactTokenLimit per codex variant（fa543ed61）
- [x] AC-B10: 86/86 SystemPromptBuilder + 41/41 codex-agent-service + 31/31 config tests 全绿

### Phase C1（Hold Ball MCP — 有界持球）
- [x] AC-C1: `cat_cafe_hold_ball` MCP tool 注册（reason + nextStep + wakeAfterMs 参数）
- [x] AC-C2: CLI 退出后系统自动再唤醒持球猫（via reminder template one-shot scheduled task）
- [x] AC-C3: maxHoldsPerWindow guard（默认 3 per ~1h 滚动窗口 per thread×cat），超限返回 429 + 强制传球提示
- [x] AC-C4: 审计日志（pino structured log: threadId/catId/reason/nextStep/wakeAfterMs/holdsInWindow/windowMs）

### Phase C2（Forced-Pass Guard — 强制传球）
- [x] AC-C5: exit check 增加 review 场景规则：verdict 后必须 @ author 或 @landy（404f894fb）
- [x] AC-C6: shared-rules §10 球权检查强化（reviewer "没人"几乎不成立 + review 必须传球 + 分析/建议传球）
- [x] AC-C7: harness 层 review verdict 检测 + 无 @ 时注入传球提示（保守关键词 LGTM/approve/reject/P1/P2/修改建议/放行/打回；三层合法出口豁免：行首 @mention / hold_ball / MCP 结构化路由 `targetCats`+`targets`）

### Phase D（Streak 语义升级 + @landy 反 catch-all — 2026-04-23 reopened from monitoring）

**触发**（monitoring 期铲屎官观察）：两个系统性缺陷同源——harness 判不了意图：
1. Ping-pong breaker 误杀正经 review（10 轮 review 在 4 轮被硬断）——当前 streak 只看"同 pair 连续次数"，不看猫是否在干活
2. 猫猫把 `@landy` 当 catch-all 安全港 — 三选一平级，@landy 成为"最低风险默认"，铲屎官变决策瓶颈

**铲屎官拍板的第一性坐标系**（KD-17）：别再做"review vs 闲聊"的主观分类，看客观事实——**干活 = 实质 tool_call + 长内容；闲聊惯性 = 短文本 + 零 tool**。RLHF "接一句" 反射产生短文本惯性，正是乒乓球的真正 signature。

#### D1 — Ping-pong Streak 实质工作豁免（P0）

**问题**：`WorklistRegistry.updateStreakOnPush` 只计"同 pair 1:1 push 次数"，正经 review（每轮都有 read/edit/task-update）在第 4 轮被误杀。

**解法**：streak 累加条件从 `samePair && 1:1 push` 改为 `samePair && 1:1 push && !callerHadSubstantiveToolCall && callerOutputLength <= T`。

**实质 tool 过滤**（砚砚 review 关键修正 — KD-18）：`cat_cafe_post_message` / `cat_cafe_multi_mention` / `cat_cafe_hold_ball` 是**路由/持球工具**，不算干活。否则 MCP 传球路径会永远豁免熔断。实质 tool = 任何留下工作证据的（read/grep/edit/write/test/git/update_task/search_evidence 等）。

**AC**：
- [x] AC-D1: `updateStreakOnPush` 签名扩展 `callerActivity: { hadSubstantiveToolCall: boolean; outputLength: number }`；累加条件为 `samePair && !hadSubstantiveToolCall && outputLength <= T`（T=200 字符默认）；实质工作 RESET streak 到 1（P1-1 reviewer 砚砚发现的重要修正）
- [x] AC-D2: 实质 tool 黑名单——`cat_cafe_post_message` / `cat_cafe_multi_mention` / `cat_cafe_hold_ball`（以 substring 匹配，兼容 `mcp__cat-cafe__*` 前缀）；其他所有 tool 都算实质
- [x] AC-D3: route-serial + callback-a2a-trigger 双路径都传 `callerActivity`；callback 路径 fail-closed 默认 `hadSubstantiveToolCall=false`；streak 更新 gated on `wouldEnqueue`（post-dedup + post-depth）防止跳过的 push 误 mutate 计数器（云端 Codex P1 修正）
- [x] AC-D4: 测试覆盖 2×2 矩阵 + reset-requires-enqueue（32/32 ping-pong 绿）

#### D2 — @landy 反 catch-all 硬条件（P0）

**问题**：三选一（@句柄 / @landy / hold_ball）平级，猫猫默认走 @landy = 最安全选择。模式：`要不要 X？` / `落 spec 吗？` / `同意我就做` — 这些是"软性 @"，有结论但把动作扳机塞回铲屎官。结果：铲屎官被当 human oracle 做所有拍板，即使事情本可自决。

**解法**：@landy 从"可选出口"改成"硬条件出口"。三硬条件（不满足禁止 @landy）：
1. **不可逆操作前**（删数据 / force push / 合第三方 PR / close feat）
2. **愿景级决策**（改 VISION / 砍整块 feat / 开新 family）
3. **跨猫僵局**（2+ 猫已直接冲突、push back 两轮无共识）

其他一律自决——技术细节、doc 修补、state 标注、timeline 记录 → 直接做，做错能回滚。

**AC**：
- [x] AC-D5: `shared-rules §10.4` 新增"@铲屎官 三硬条件"子条款 + 反问式 ping 反例清单 + 合法示例；`§10` 顶层三选一也重排成决策树优先级（P1-2 reviewer 砚砚发现的一致性修正）
- [x] AC-D6: `SystemPromptBuilder` trailing anchor 从平级三选一改成决策树优先级：
  ```
  先问：下一步谁能做？
  1. 另一只猫能做 → @句柄（review→@author / 修完→@reviewer / merge→@愿景守护猫）
  2. 等外部条件 → hold_ball（CI / PR check / 长时间 build）
  3. 只有铲屎官本人才能做（三硬条件）→ @landy
  @landy 不是默认出口——先问"哪只猫能接"。
  ```
- [~] AC-D7: 反问式 ping 反制——**prompt 层已在 D6 trailing anchor + §10.4 落地**（写入决策树末句 + 反例清单）；**harness 层检测故意未做**（KD-8 反分类器原则——regex 判"是不是软性递球"本质是认知脚手架）。若线上观察仍频繁出现反问式 ping，再评估是否加 harness 检测。

### Phase E（Retire L3 role-gate — 2026-04-23 reopened）

**触发**：铲屎官实测发现 `F172 feature close → 愿景守护 @gemini` 链路被 L3 硬拦，理由 "合入"（designer 不接受 merge 任务）——但实际任务是 **愿景守护**，不是 coding/merge。根因是：
1. `role-gate.ts` 硬编码字符串常量 `DESIGNER_ROLE = 'designer'` + 硬编码正则 `CODING_ACTION_RE`
2. `actionText` 扫整条 storedContent，上文任意位置出现 `合入 / merge` 都误伤下一棒
3. `buildTeammateRoster` **没读** cat-config 的 `evaluation`/硬限制字段，发送方 prompt 里根本看不到 "gemini 禁止写代码"

铲屎官原话：
> "你们之前的拦截是不是过度设计啊？ 要是人家gemini 出了4 比你厉害呢？"
> "到底有没有看 cat config 人家不合适做的事情？ 还是硬编码？"
> "要是我明天写的 minimax 禁止 coding， claude 禁止生成图片呢？"
> "问题不是出在 gemini 身上，是出在 at 他的猫身上——队友注入出现问题，导致他不知道限制？"

**根因判定（KD-20）**：L3 role-gate 是 KD-8 典型反模式（认知脚手架——harness 替模型判断 intent）。正确做法是把能力限制作为**数据**（cat-config）注入 **prompt**（双端：发送方队友名册 + 目标猫 self-awareness），让模型在正确坐标系里自判断。未来 model 升级 / 新增 model / 能力变化 → 改 cat-config 即可，**零代码改动**。

#### E1 — 数据模型：cat-config 新增 `restrictions` 字段（P0）

- [x] AC-E1: `cat-config.json` + `cat-template.json` 支持 `restrictions?: string[]`；`gemini` 初始化为 `["禁止写代码"]`
- [x] AC-E2: `CatConfig`/`CatVariant`/`CatBreed` TS 类型 + zod schema + loader merge（variant 覆盖 breed，不 merge）；向后兼容（缺省 `undefined`）

#### E2 — 双端注入：发送方 + 目标猫都能看到限制（P0）

- [x] AC-E3: `buildTeammateRoster` 合并 `**硬限制**：{list}` 到 caution 列；发送方 prompt 一眼看到 "gemini 禁止写代码"
- [x] AC-E4: `buildStaticIdentity` 注入 `你的硬限制：{list}。被 @ 做这类任务时请 push back 或退回给 @ 你的猫`；目标猫 self-awareness 不依赖 harness

#### E3 — 退役 L3 硬编码拦截（P0）

- [x] AC-E5: 删 `role-gate.ts` + 3 个 role-gate 测试文件（`role-gate.test.js` / `route-serial-role-gate.test.js` / `callback-a2a-role-gate.test.js`）
- [x] AC-E6: `route-serial.ts` + `callback-a2a-trigger.ts` 移除 `checkRoleCompat` 调用 + `a2a_role_rejected` emit（前端 `system-info-visible.ts` handler 保留为死路径兼容，后续清理）
- [x] AC-E7: `cat-config-loader` + `system-prompt-builder` 加 restrictions 相关 10 个新测试；204/204 相关测试绿

#### E4 — 回放验证（P0）

- [x] AC-E8: F172 愿景守护回放测试：opus 输出含"已合入 main"narrative + @gemini 做愿景守护 → gemini 正常 invoke，无 `a2a_role_rejected`（`route-serial-pingpong.test.js` 新增 case）

### Phase F（Identity truth source + external-identity hold_ball + inline-@ guard — 2026-04-24 reopened）

**触发**（Phase E merge 后连环踩坑）：
1. opus-47 在另一线程发"球权在云端 codex / No more action needed" **同时** 行首 `@gpt52` — 一句话里自相矛盾（说 hold 又传球）。根因：我把"云端 codex (GitHub bot)"误投射成"本地 @gpt52 砚砚"这个最像的 roster proxy
2. 砚砚核真相源后定位：**路由 parser 本来就是数据驱动**（`normalize-cat-id.ts` 走 `mentionPatterns`），**漂移的是"句柄背后的模型认知"**——`cat-catalog.json:344` 显示 `@codex` 当前已切到 `gpt-5.5`，但 `AGENTS.md:25` 仍写"@codex = gpt-5.3-codex"；`buildTeammateRoster` 从不展示 resolved model，发送方 prompt 里没有"runtime model"这条真相
3. 铲屎官观察：有 thread 里我把 `@codex` 写在**句中**（如 `+ @reviewer: @codex`）而非行首，按协议不路由 = 球掉地上

铲屎官原话：
> "球权在云端 codex 然后你 at 我们本地的 gpt 砚砚！"
> "最早的时候是 gpt5.2 然后默认的写死了！如果要解决这个需要从根源解绑，注入队友的时候能知道 比如说 gpt52，到底是谁？codex 到底是谁？"
> "有的 thread 的你忘记了 @ 的格式要一行 行首"
> "你们说的这些 我不喜欢做 hot fix 我希望是完整的解决"

**根因判定（KD-21）**：Phase A~E 已让**能力限制**（restrictions）和**球权路径**（decision tree）数据驱动，但**"@句柄 → 模型"的认知绑定**还留在静态 docs（`AGENTS.md` / `CLAUDE.md` 固定"@codex = gpt-5.3-codex"等）和猫的训练快照里。handle 是 identity 常量，model 是 runtime-resolved metadata；两者在 prompt 层必须解耦。**外部 identity**（`chatgpt-codex-connector[bot]` / CI / GitHub webhook）根本不在 cat-cafe roster，应该属于 `hold_ball` 域，绝不能投射成本地近似 proxy。

**KD-22**：`@` 行首规则是协议常量，但模型会在 narrative context（如列表、quote、URL 前缀）不自觉把 @句柄写成句中。F064 `mentionRoutingFeedback` 是事后反馈（下一轮才纠），本轮错 @ 时球已经掉地上。Phase F 需要在 **prompt 首轮教学**里加强反例 + 让发送方看到 "live callable handles + resolved model"（认知真相和协议真相对齐）。

#### F1 — handle/model 解绑：runtime model 注入发送方 prompt（P0）

- [x] AC-F1: `buildTeammateRoster` 每行 `@mention · {runtime resolved model}`（via `getCatModel` — 支持 env `CAT_{CATID}_MODEL` override → registry → default 优先级），列头改成 `@mention · 当前模型`；cloud P1 修正从 `config.defaultModel` 改为 `getCatModel`
- [x] AC-F2: 队友名册合并式展示，callable mentions 列表承接 roster 真相（共享 `buildStaticIdentity` 链路）

#### F2 — 静态 docs 真相源清理（P0）

- [x] AC-F3: `AGENTS.md` / `CLAUDE.md` 删 `@codex (model=gpt-5.3-codex)` 硬绑定，改"以 runtime catalog 为准"；cloud round-3/4 broaden 校验 regex 到 `/@[^\s,(（]+ ... model=\S+/i` 覆盖任意 handle/value/quote 变体
- [x] AC-F4: `docs/canon/` grep 干净，无模型硬编码

#### F3 — 外部 identity 作为 hold_ball 场景（P0）

- [x] AC-F5: `shared-rules §10` option 2 列外部 identity 清单：云端 codex (`chatgpt-codex-connector[bot]`) / GitHub bot / PR check / CI / 长 build / 外部 webhook + "严禁投射成本地同族猫的任何 variant"
- [x] AC-F6: Trailing anchor option 2 内联外部 identity 示例，closing line 硬规"外部 identity 永远走选项 2"

#### F4 — `@` 行首协议加固（P0）

- [x] AC-F7: `buildCallableMentions` 加具体反例 + 发前自检（cloud round-2 纠正：markdown 列表/quote 前缀**会被 parser 剥离**——合法路由，不是陷阱；真正陷阱是句中/URL 内/非首字符位置）
- [x] AC-F8: 发前自检问句注入 prompt（合入到 callable mentions 反例旁）
- [~] AC-F9: 探索项未做——砚砚本地放行+云端 clean 验证 prompt 层教学已足够；若线上观察仍频出再评估 `parseA2AMentions` 增强

#### F5 — 回放 + 跨族认知一致性（P0）

- [x] AC-F10: invariant lock 测试落地（AGENTS.md / CLAUDE.md no `@x ... model=anything` 硬绑定）；cloud round-3/4 纠正 regex 覆盖 quoted/unquoted/非 ASCII handle
- [~] AC-F11: 认知行为回放未写 test（cloud 也提到这是覆盖缺口，非阻塞）——依赖 prompt 层教学 + trailing anchor 决策树，以线上观察为准

### Phase G（Hold Wake 行为明确化 — 2026-04-24 reopened）

**触发**（Phase F merge 后铲屎官审视）：两个 hold_ball 并发语义未在 spec / 代码文档化：

1. **外部 wake vs hold wake 冲突**：持球中 external wake 到来把猫叫起来干活，之后 hold wake fireAt 也到了——会打断正在干的事吗？
2. **二次 hold_ball 语义**：cat 在处理 external wake 时**再次** `hold_ball(...)`——新 hold 覆盖前一个 pending wake？追加一条？还是二选一 via MCP 参数？

铲屎官原话：
> "这个持球会打断正在被前一次唤醒的布偶猫的工作吗？我们的期望行为到底是什么？"
> "cat 持球中被唤醒二次持球——会覆盖之前的 wake 还是又多一个加入队列？"
> "你们猫猫才是用户，你到底这时候希望怎么样的？"

**已查实际行为**：
- **问题 1**：`ConnectorInvokeTrigger.trigger:121-124` — hold wake fire 时若 cat 在跑 invocation → `enqueueWhileActive`（不打断，排队）。**期望 = 实际**，需文档化
- **问题 2**：`callback-hold-ball-routes.ts:119` — 每次 `hold_ball` 用唯一 `taskId = hold-ball-${Date.now()}-${random}` + `dynamicTaskStore.insert`，**没有** 查同 (threadId, catId) 是否已有 pending hold 再 cancel/replace → **当前是"追加"**。这是未设计 bug

**KD-23（铲屎官拍板 2026-04-24）**：`hold_ball` 是**单-槽语义**。同 `(threadId, catId)` 同时只有一个 pending hold wake。二次 `hold_ball` **覆盖**前者（视为"意图已更新"）——符合 KD-13 "持是例外态"、"持一个球"语义。**不做 `mode: 'replace'|'append'` 参数**——YAGNI + KD-8 反模式（每次调都让 cat 多一个判断负担）。真有多事要等 → merge 到一个 `nextStep`。

#### G1 — 行为文档化（当前实际 = 期望）

- [x] AC-G1: spec Phase C1 "Guard" 章节追加行为说明：外部 wake 到来时持球期内，hold wake 排队不打断；当前 invocation 结束后注入 `持球唤醒：{reason}...` 消息
- [x] AC-G2: spec 同一章节写清 hold wake stale 场景 + 猫的正确反应（看 thread 最近历史判断 nextStep 是否仍相关 → 若已不相关就接/退/升，不盲跟 stale nextStep）

#### G2 — 代码改 replace 语义（覆盖 pending hold）

- [x] AC-G3: `callback-hold-ball-routes.ts` 在 `dynamicTaskStore.insert` 前：
  - 查 `dynamicTaskStore` 同 `(threadId, catId)` 的 pending hold task（via `id.startsWith('hold-ball-')` + `templateId='reminder'` + `createdBy: hold-ball:{catId}` + `deliveryThreadId`；id 前缀是不可伪造主键——panel `/api/schedule/tasks` 生成 `dyn-*`，路由层独占 `hold-ball-*`）
  - `deregister` + `delete` 它（cancel 旧 scheduled fire）
  - 原子序（cloud Codex P1 修正）：先 insert + register 新 task；register 失败则 rollback insert、prior hold 不动；只有新 task 完全 commit 后才 cancel prior
- [x] AC-G4: `holdCount` rolling window 逻辑保持不变（这是防滥用 guard，与单-槽语义正交；cat 被连续覆盖 3 次还是算 3 次 hold）

#### G3 — 测试锁 KD-23

- [x] AC-G5: `test/callback-hold-ball-route-scheduling.test.js` 扩容至 7 tests：
  - 两次连续 `hold_ball` → `dynamicTaskStore` 只剩 1 个 task（第二个）
  - 第一个 task 被 `taskRunner.unregister`（不会触发）
  - 第二个 task 按 `wakeAfterMs` 正常注册
  - atomic rollback：`registerDynamic` 失败时 insert 被撤销，prior hold 保留
  - 不同 cat 互不干扰（per-cat slot 隔离）
  - forged panel `dyn-*` task（同 `createdBy` + 同 thread）**不被**误删（id 前缀防御，gpt52 round-2 pushback 修正）
- [x] AC-G6: MCP `cat_cafe_hold_ball` description GOTCHA 段落注明"SINGLE-SLOT per (thread, cat)，再次调用覆盖前一次 pending wake（KD-23）"

### Phase H（Final Routing Slot 机械校验 — 2026-04-24 reopened）

**触发**（Phase G merge 后铲屎官观察）：opus-47 在 **3 个 thread** 反复出现"inline @ 但不在行首"——砚砚（GPT-5.5 codex）和 opus-47 对话里观察到。规则在 prompt 里已写 4 处（identity block / 队友段 / 发前自检 / shared-rules §10），但模型在 narrative context 里会把 @ 当普通 token 用，叙述模式和路由模式没稳定切换。

**根因**（砚砚 GPT-5.5 诊断）：
- Opus 4.7 生成时沿语境走，写"我让 @codex 看了"这种叙述时，`@` 成了普通 token，没触发"这是路由语法"的元检查
- GPT-5.4/5.5、Opus 4.6 能稳定把 @ 分两类（段内叙述 vs 行首动作），4.7 会滑掉
- prompt 层"行首才有效"已到天花板，3 个 thread 复现 = 信号够，不用再观察

铲屎官原话：
> "我在多个 thread 观察到 opus47 会 at 砚砚 at 格式错误，放在中间 at，但是我们的 at 生效只有在一行的开头。这是为什么？"
> "别短期 中期长期，我们应该是朝着最终状态出发"
> "让你们发结构化的富文本，比较复杂的，成功率或许比 @ 都低，如果是比你们笨的模型那就更灾难了"

**关键取舍**（铲屎官拍板）：
1. **保留 `@` 作为唯一文本路由语法**——越简单越适合弱模型（反对迁结构化工具/JSON schema 路线）
2. **外部语法最简 + 内部 harness 机械校验**——终态基座，不是过渡脚手架

**KD-24（铲屎官 + 砚砚 GPT-5.5 拍板 2026-04-24）**：`@` 路由语法校验在 harness 层做 **final routing slot** 机械校验 + one-shot repair 兜底。**禁止语义 intent 分类器**（KD-8 反模式）。Validator 只判定"出口槽位语法对不对"，不推断"猫想不想传球"；命中只能产出 `invalid_route_syntax`，**禁止自动路由 / 推断目标 / 替猫决定意图**。豁免只走结构边界（fenced code / blockquote / URL / 有 metadata 则 tool output + cross-post body），**禁止语义豁免表**。

#### H1 — Final Routing Slot 定义（机械化边界）

- [x] AC-H1: 实现 `finalRoutingSlot(message: string, metadata?)` — slot = 结构剥离后的最后非空段落。结构剥离包括：
  - fenced code block（三反引号 fence）
  - blockquote（`> ...` 行）
  - URL（裸链接 / markdown 链接 URL 部分）
  - 若消息管线已有 segment metadata → 额外剥离 tool output / cross-post body
  - 无 metadata → 只做 markdown 结构剥离，不做语义猜测（不为 Phase H 新建贯穿链路的 metadata）

#### H2 — 语法校验（只检查出口槽位）

- [x] AC-H2: 只检查 slot 内 roster handle 的**语法位置**：
  - 合法行首 @（独立行首 / markdown 列表或引用前缀后首字符）→ 正常路由（既有 `parseA2AMentions` 路径不动）
  - 非法 inline @ → 候选 `invalid_route_syntax`
  - slot 外的 inline @ 一律不碰（narrative 默认通行）
- [x] AC-H3: slot 内存在非法 inline @handle 且**无合法出口**（行首 @handle / `hold_ball` tool call / MCP `targetCats` 路由）→ 触发 `invalid_route_syntax`。**不自动路由 / 不推断目标 / 不替猫决定意图**

#### H3 — One-shot Repair + System_info 兜底

- [~] AC-H4: 触发 `invalid_route_syntax` → 发 repair prompt（"重写最后交接段，不改正文"）让同一只猫重试。**repair 上限写死为 1**；repair 后仍不合法 → 发一次 `system_info`（"检测到无效 @ inline，未路由"），原输出照常存档、**禁止第二次 repair**

#### H4 — AC-C7 协同

- [x] AC-H5: `invalid_route_syntax` 命中 → 同轮 suppress AC-C7 verdict-without-pass 警告（格式错是根因，verdict 无传球是后果）。反向不 suppress（AC-C7 命中不影响 AC-H3）

#### H5 — 豁免边界（结构，非语义）

- [x] AC-H6: 豁免基于 **结构边界**（fenced code / blockquote / URL / 有 metadata 则 tool output + cross-post body）。**禁止 handoff 动作词表、意图分类器、语义豁免表**——一个语义启发式都不给

#### H6 — 测试覆盖

- [x] AC-H7: 测试矩阵（slot 优先，~15 case）：
  - slot 内真非法 inline @ + 无合法出口 → 命中
  - slot 外正文 inline @ → 不命中（narrative 通行）
  - fenced code 内的 @ → 不命中（结构豁免）
  - blockquote 内的 @ → 不命中（结构豁免）
  - URL 内的 @（裸链接/markdown 链接 URL）→ 不命中（结构豁免）
  - tool output / cross-post body（带 metadata）→ 不命中
  - 合法行首 @ → 不命中
  - 合法 `hold_ball` tool call → 不命中
  - 合法 MCP `targetCats` 路由 → 不命中
  - repair 失败 → 单次 `system_info`，不再 repair（repair 上限=1 硬约束）
  - AC-H3 命中 → 同轮 AC-C7 suppress
  - AC-C7 命中 → AC-H3 不受影响（单向）

## Dependencies

- **Evolved from**: F064（A2A 出口检查 — 链条终止盲区修复）
- **Related**: F027（A2A 路径统一）、F122（执行通道统一）、F055（A2A MCP Structured Routing）

## Risk

| 风险 | 缓解 |
|------|------|
| L1 误杀合法 review 循环 | 用连续 streak 而非累计 count；threshold=4 允许 3 次正常来回 |
| L3 角色门禁过于粗暴 | MVP 只拦 designer+coding 高危组合，不做通用能力矩阵 |
| Phase 0 正面化后规则含义漂移 | 多猫协作审视 + 改完跑现有 system-prompt-builder 测试 |
| Phase 0+A 不够，需要更多层 | Phase B 用回放测试验证覆盖率，按需补充 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | L1 streak threshold 最终值：4（当前）还是更宽松？ | ⬜ 需实测 |
| OQ-2 | L3 角色门禁是否需要超越 designer+coding MVP？ | ⬜ MVP 后评估 |
| OQ-3 | Benchmark ≠ Agent 根因？ | ✅ 模型不理解路由机制 + 提示词隐含假设 + 缺基本刹车。不是"@ 协议脆弱"——两条路都能用，4.7 都没用对 |
| OQ-4 | Hold Ball MCP description + 系统提示词球权指引怎么写？ | ✅ 砚砚+宪宪讨论收敛（KD-13/14），草案已入 Phase C |
| OQ-5 | 球权管理是否升格为独立 skill（各猫贡献踩坑经验）？ | ✅ 现在不做（KD-15）。踩坑经验先落 `refs/ball-ownership-patterns.md`，成熟后再 skill 化 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 新立 Feature 而非重开 F064 | F064 scope 是"漏传球"已 done，本案方向相反 | 2026-04-17 |
| KD-2 | L1 用连续 streak 而非累计 count | codex + gpt52 独立收敛：raw count 误杀 review 循环 | 2026-04-17 |
| KD-3 | L2 做 prompt + harness 双层 | prompt-only 不可靠，parallel 仍会持久化 mention | 2026-04-17 |
| KD-4 | L1 落点在 WorklistRegistry canonical push | 覆盖 serial + callback 双路径，无旁路 | 2026-04-17 |
| KD-5 | 先立项不写代码，先研究 benchmark ≠ agent 根因 | 铲屎官要求深入分析再动手 | 2026-04-17 |
| KD-6 | 路由可见性不退化（铲屎官拍板） | MCP typed routing 后若响应文本无 @mention，系统须自动补可见路由指示 | 2026-04-17 |
| KD-7 | 根因修正：不是"@ 脆弱"，是模型没用对两条路 | 铲屎官纠正：两条路都能走，4.7 都没走，不是路的问题 | 2026-04-17 |
| KD-8 | 第一性原理回归：砍掉 GPT Pro 学术膨胀 | 铲屎官拉闸「数学之美」：L4/L6/9-dim eval/capability taxonomy/state-delta 检测 = 认知脚手架 = 复杂是无知的代偿 | 2026-04-17 |
| KD-9 | Phase 0 先于 Phase A：先改地形再加刹车 | Agent Quality = Capability × Environment Fit，优化环境适配度的 ROI 远高于堆检测层 | 2026-04-17 |
| KD-10 | Phase 0 多猫协作，不是一只猫独审 | 提示词/Skills 涉及所有猫的系统提示词注入链，需要各猫视角 | 2026-04-17 |
| KD-11 | Hold Ball 用 MCP 而非 self-@ | self-@ 有死循环风险（RLHF 猫上下文里 @ 模式会被 cargo-cult），MCP 有结构化 guard | 2026-04-19 |
| KD-12 | "状态描述 ≠ 球权声明" 作为球权核心原则 | 根因：猫用描述（"我先 hold"）逃避决策（接/退/升），RLHF "check in" 反射的 agent 场景副作用 | 2026-04-19 |
| KD-13 | "持"是例外态，不是四选一常态 | 砚砚提出：默认三选一（接/退/升），持只在"球仍在我、无人能推进、短暂有界等待"时用 | 2026-04-19 |
| KD-14 | hold_ball 必须带 `wakeAfterMs` 有界唤醒 | 砚砚提出：没有时间上界 → 退化成语义持球 → 球还是掉地上 | 2026-04-19 |
| KD-15 | 不先做球权管理独立 skill | 砚砚提出：球权是基础协议（always-on），不能靠按需加载的 skill；踩坑经验先落 refs 文档 | 2026-04-19 |
| KD-16 | Phase C 拆分 C1+C2：两种不传球根因不同 | 砚砚自诊：C1 治"真持球"（想拿但拿不住），C2 治"假终局"（结论=终点错觉）。铲屎官 5 线程验证后者更普遍 | 2026-04-19 |
| KD-17 | Streak 判定维度从"连续次数"升级为"实质工作"（tool_call + 内容长度） | 铲屎官外部视角："干活 = 有 tool_call。闲聊 = 纯文本"。47 原本堆 ABCD 方案（白名单/similarity/review-target-id）全是主观分类器 = KD-8 反模式；tool_call + 长度是客观事实，代码不撒谎 | 2026-04-23 |
| KD-18 | 实质 tool 必须排除路由/持球工具（post_message / multi_mention / hold_ball） | 砚砚 review 修正：这三个是传球/持球本身不是工作；若算实质 tool，MCP 路由路径会永远豁免熔断 = 熔断器打穿 | 2026-04-23 |
| KD-19 | @landy 从"可选出口"升级为"硬条件出口"（不可逆 / 愿景级 / 僵局） | 铲屎官原话："你们现在会走向最安全的选择！就是！找我！"；三选一平级时 @landy 变成最低风险默认，铲屎官变决策瓶颈；必须抬门槛而非加 lint（KD-8） | 2026-04-23 |
| KD-20 | 退役 L3 role-gate 硬编码拦截，能力限制改为数据驱动（cat-config.restrictions 双端 prompt 注入） | L3 硬编码（designer role 字符串 + coding regex）是 KD-8 反模式——harness 替模型判 intent，model 升级时规则无法自适应，且 actionText 扫全文会误杀（今天 F172 愿景守护被"合入"命中）；改数据驱动后，未来加 minimax / 限制 claude 多模态等场景 → 改 cat-config 即可，零代码变更 | 2026-04-23 |
| KD-21 | handle = identity 常量；model = runtime-resolved metadata；**外部 identity**（GitHub bot / CI / webhook）不在 roster、不可 @、必须用 hold_ball | 砚砚核实 `normalize-cat-id.ts` parser 本已数据驱动；漂移的是"句柄背后的模型认知"——runtime catalog 把 `@codex` 切到 `gpt-5.5` 但静态 docs 仍写 `gpt-5.3-codex`。handle 稳定、model 变化，两者必须在 prompt 层解耦（roster 里显式打 resolved model）。同理外部 identity 从来不在本地 roster，映射到 roster 近似猫 = cargo-cult 盲区 | 2026-04-24 |
| KD-22 | `@` 行首规则是协议常量，但"发前自检"需要在 prompt 首轮教学 + 反例强化，F064 的事后 `mentionRoutingFeedback` 不够 | 下一轮反馈不救本轮错传；模型在 URL / 列表 / quote 语境会把 @句柄写在句中（以为会路由）。prompt 层要让"行首"规则有视觉反例 + 发前自检问 | 2026-04-24 |
| KD-23 | `hold_ball` 是单-槽语义：同 `(thread, cat)` 同时只有一个 pending hold wake，二次调用**覆盖**前者。不加 `mode: replace\|append` 参数 | KD-13 "持是例外态 / 持一个球"语义；append 会累积 stale wake 消息；`mode` 参数 = 认知脚手架反模式（每次调要判断用哪个）；真有多事等 → merge 到一个 nextStep | 2026-04-24 |
| KD-24 | `@` 路由语法校验在 harness 层做 **final routing slot** 机械校验 + one-shot repair 兜底。禁止语义 intent 分类器（KD-8 反模式）；validator 只看"出口槽位语法"，不推断"猫想不想传球"；命中只产出 `invalid_route_syntax`，不自动路由 / 不推断目标 / 不替猫决定意图；豁免只走结构边界，禁止动作词表 / 语义豁免表 | Phase F 依赖的 prompt 层教学已到天花板（4.7 三 thread 复现）；结构化工具路线被铲屎官驳回（弱模型失败率更高）；终态 = 外部协议最简（行首 @）+ 内部机械语法校验；KD-22 prompt 层 + KD-24 harness 层双重守护 | 2026-04-24 |
| KD-25 | 虚空持球检测 = 声明-动作一致性检查。文本含"持球"但无 `hold_ball` tool call → harness 警告。不是语义分类器（检查的是"你声称做了 X，tool call 是否存在"），KD-8 安全 | 47 反复声明"我持球"但未调工具，铲屎官多次手动干预；feedback 已记 3 次仍复发 = prompt 层天花板，需 harness 兜底 | 2026-04-25 |
| KD-26 | `@` 路由不做"意图提取"——保持行首=路由/其他=叙述的绝对规则。弱模型无法理解"句中 @ 有时路由有时不路由"的语义边界 | 砚砚 review 修正：K-1 不做 Slack 式宽容路由（违反 KD-24）；只做机械 repair（AC-H4 Step B）| 2026-04-25 |
| KD-27 | hold_ball 轮询和结构化回调（PR tracking / scheduled task）覆盖同一等待对象时，轮询必须终止。传球决策树选项 2 拆分：2a 无回调覆盖→轮询，2b 有回调覆盖→纯事件驱动 | 铲屎官发现 PR tracking + hold_ball 轮询双通道重复唤醒——codex 接单后两条路同时触发，猫醒来发现前一次已经通过 PR tracking 消息处理过了。两个等待的对象不同（"有没有人接" vs "接了之后的结果"），不该重叠运行 | 2026-05-07 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-17 | 铲屎官审视 harness → 发现六大问题 → 三猫讨论 → 提案 |
| 2026-04-17 | GPT-5.4 review (3 P1 修正) + Codex review (3 P1 同源收敛) |
| 2026-04-17 | 立项 F167 |
| 2026-04-17 | 4.7 + gemini + gpt52 二轮 review |
| 2026-04-17 | GPT Pro 深度推理（Mode B 咨询）→ intake 后过度学术化 |
| 2026-04-17 | 铲屎官拉闸「第一性原理」「数学之美」→ 全员回溯 Round 4 → spec 极简化重写 |
| 2026-04-18 | Phase 0 部分完成 — AC-01 负面指令清零（7 文件） + AC-04 GOVERNANCE_L0_DIGEST Rule 0 同步 |
| 2026-04-18 | Phase A PR 1 merged (PR #1243) — L2 parallel @ 抑制 + L3 designer role gate MVP |
| 2026-04-18 | Phase A PR 2 — L1 乒乓球熔断（WorklistRegistry streak + serial + callback 双路径 + reset triggers）|
| 2026-04-18 | Phase A PR 2 R1 — codex P1×2 修复：modern InvocationQueue 分支接入 streak 门禁；`resetStreak` 无 parentInvocationId 时按 threadIndex 批量清除 |
| 2026-04-18 | Phase A PR 2 merged (PR #1254) — L1 ping-pong breaker 落地 main；cloud review 零 P1/P2 |
| 2026-04-18 | 身份反欺骗 fix：SystemPromptBuilder handoff 注入 `[model=...]` 标记 + 同族分身提醒（formatHandleFreeLabel 带 variantLabel） |
| 2026-04-18 | Round 4 数学之美讨论升格为 `docs/canon/meta-aesthetics.md`；feat-lifecycle Design Gate 改称"元审美自检" |
| 2026-04-18 | Phase 0/A 收尾 merged (PR #1262) — 身份反欺骗（A2A handoff `[model=...]` + 同族分身提醒）+ Round 4 canon 升格；cloud review 零 P1/P2 |
| 2026-04-19 | Phase B2: Ball Ownership Protocol Hardening — 6 个球权协议漏洞修复（@landy exit / 死锁 / 虚假离场 / 接退升 / 诊断不解决 / context overflow） |
| 2026-04-19 | 砚砚自我剖析：RLHF "check in" 反射 = 球权黑洞；"Hold 不是对外协议状态" |
| 2026-04-19 | Phase C 立项：hold_ball MCP（铲屎官拍板 MCP 路线 > self-@ 路线，防死循环） |
| 2026-04-19 | 砚砚 Phase C 设计反馈：+wakeAfterMs 有界唤醒 / 持是例外态 / 不先 skill 化 / 4 个踩坑模式 |
| 2026-04-19 | 宪宪综合：Phase C 设计收敛（KD-13~15），OQ-4/5 关闭 |
| 2026-04-19 | 铲屎官 5 线程审视：砚砚全部不传球 → 砚砚自诊两种根因 → Phase C 拆分 C1（hold_ball）+ C2（forced-pass）（KD-16） |
| 2026-04-20 | Phase C1 merged (PR #1289, 08b6f7d15) — hold_ball MCP polish：MCP description 5-element 标准 + gpt52 review P1/P2（`maxHoldsPerWindow` 语义修正 + 进程内 best-effort 注记）；cloud Codex 零 P1/P2 放行 |
| 2026-04-20 | Phase C1 route test merged (PR #1290, e34baa85b) — 补齐 gpt52 P3 遗留的 callback route 端到端行为测试（7 tests: 401 / 3×400 / 200 / 429 / 500）；cloud Codex P2（文件超 200 行）→ 按 scenario 拆分 2 文件后放行 |
| 2026-04-20 | Phase C2 merged (PR #1291, 73439a5e7) — harness-layer verdict-without-pass detector (AC-C7)：保守关键词扫描 + 三层合法出口豁免（行首 @mention / hold_ball / MCP 结构化路由 `targetCats`+`targets`）；gpt52 P2 修复（把 MCP 结构化路由作为第三合法出口，不仅看 tool name），延续放行到 rebased HEAD `6c6bffc0`|
| 2026-04-20 | Runtime 已重启并吃到新护栏：`/health` 正常；活跃猫进程 prompt 已含最新球权检查压缩版（含 `@landy`、死锁/虚假离场、review 默认必须传球） |
| 2026-04-20 | AC-B1 回放验证完成：Case E2 记录 6 case（5 个球权类 live prompt/source replay + 1 个 codex context overflow 代码/测试回放） |
| 2026-04-21 | 修复 F167 L1 ping-pong termination 前端显示：`a2a_pingpong_terminated`（顺带 `a2a_role_rejected`）从原始 JSON 蓝气泡改为可读 system notice（前景 + 背景线程消费逻辑同步） |
| 2026-04-20 | Status → monitoring：宪宪+砚砚共识——AC-B2/B3 已被多层护栏覆盖（B2+C2 虚空传球 / L1 streak+break-loop ping-pong），进入观察期，无新 case 即 close。不再追加补丁 |
| 2026-04-23 | Phase D reopened from monitoring：铲屎官发现两个系统性缺陷——(1) ping-pong streak 误杀正经 review（无 tool_call 维度）、(2) 猫猫倾向 @landy 做最安全默认，铲屎官变决策瓶颈；铲屎官拍板坐标系"干活 = tool_call"；砚砚 review 加入"实质 tool 过滤"关键修正（排除路由/持球工具）；KD-17/18/19 落定，D1+D2 AC 定稿待实现 |
| 2026-04-23 | Phase D merged (PR #1349, `0fa92bfcf`) — D1 streak 实质工作豁免 + D2 @landy 硬条件出口。本地 gpt52 review 两轮（P1-1 substantive 必须 RESET streak 而非跳过 / P1-2 shared-rules §10 和 §10.4 一致性）；云端 Codex review P1（streak update 必须 gated on `wouldEnqueue` — 防 dedup/depth 跳过后仍误 mutate 计数器）；D1 5 commit + D2 1 commit + 3 个 P1 fix commit + 3 个 biome/index autofix commit，全量 32/32 ping-pong + 89/89 system-prompt-builder 绿。Status: monitoring（AC-D7 harness 反问式 ping 检测故意未做 — 避开 KD-8 反分类器原则，prompt 层已兜住）|
| 2026-04-23 | Phase E merged (PR #1360, `f8efcf46d`) — retire L3 role-gate，`cat-config.restrictions` 数据驱动双端 prompt 注入（AC-E1~E8）；KD-20 落定；-735 净行数；gpt52 本地 review 放行 + 云端 Codex "no major issues"；中间踩坑：PR tracking 增量扫描通知重复误导 → 下次看通知先 `gh pr view` 对照时间戳 |
| 2026-04-24 | Phase F reopened from monitoring：(1) opus-47 "球权在云端 codex" 同句 @gpt52 的认知盲区；(2) AGENTS.md 里 `@codex = gpt-5.3-codex` 和 runtime catalog `gpt-5.5` 漂移；(3) 句中 @ 不路由的协议常量被模型忘掉。铲屎官拍板"完整做，不 hotfix"；砚砚核实 parser 已数据驱动，根修在注入层；KD-21/22 落定，AC-F1~F11 定稿待实现 |
| 2026-04-24 | Phase F merged (PR #1374, `21ef97214`) — handle/model 解绑 + 外部 identity hold_ball + inline-@ guard。砚砚本地放行 + 4 轮云端 Codex review（round-1 P1+P2、round-2 P1+P2、round-3 P2、round-4 P2，每轮都是前次修补被指摘需更广覆盖），最终 cloud clean "no major issues"。97/97 system-prompt-builder 绿；+4 fix commit。Status: monitoring |
| 2026-04-24 | Phase G reopened from monitoring：铲屎官审视 hold_ball 并发行为——(1) 外部 wake 撞持球期 vs (2) 二次 `hold_ball` 语义。实际行为查完：(1) 排队不打断（期望匹配，需文档化）；(2) 当前"追加"（累积 stale wake，需改 replace）。KD-23 单-槽语义落定，AC-G1~G6 定稿 |
| 2026-04-24 | Phase G merged (PR #1378, `c525714cf`) — AC-G1~G6 全绿。hold_ball single-slot replace（KD-23）：spec 并发语义章节 + `callback-hold-ball-routes.ts` 原子 swap（先 insert+register 新 task，register 失败 rollback；新 task 完全 commit 后才 cancel prior）+ 不可伪造 id 前缀锚点（`hold-ball-*` vs panel `dyn-*`）+ MCP description GOTCHA。云端 Codex 三轮（round-1 P1 atomicity / round-2 P2 matching scope / round-3 clean），砚砚 review 三轮（原放行 → round-2 不放行 + id-prefix 建议 → 放行 `84473ea5` → 延续 `70f2d8de`）；7/7 scheduling tests 绿（含 forged `dyn-*` Red test 锁 gpt52 round-2 pushback）。Status: monitoring |
| 2026-04-24 | Phase H reopened from monitoring：Phase G merge 后铲屎官观察 opus-47 三 thread 复现 inline @ 不在行首。砚砚 GPT-5.5 诊断"叙述模式 / 路由模式没稳定切换"——4.7 写叙述时 @ 沦为普通 token。铲屎官驳回"迁结构化工具"路线（弱模型灾难），方向定在"外部语法最简 + 内部 harness 机械校验"。Design Gate 三轮收敛（1. 砚砚 short/mid/long → 2. 铲屎官 push back 弱模型友好 → 3. 砚砚收回迁移改为 runtime validator → 4. opus-47 提 D-1~D-4 细节 → 5. 砚砚收紧 KD-8 反模式 + scope 膨胀防御）。KD-24 落定：**final routing slot 机械校验 + one-shot repair 兜底 + 零意图分类器 + 结构边界豁免**，AC-H1~H7 定稿待实现 |
| 2026-04-25 | Phase H merged (PR #1381, `1d9b294b2`) — AC-H1~H3/H5~H7 全绿，AC-H4 部分实现（Step A `system_info` 兜底已含；Step B one-shot repair re-invoke 暂未做，留作后续观察压制效果再评估）。`final-routing-slot.ts` pure validator（finalRoutingSlot / findInlineMentionsInSlot / validateRoutingSyntax）+ `route-serial.ts` 接入（命中 emit `routing-syntax-hint` + 单向 suppress legacy `inline-mention-hint` + AC-C7 `verdict-no-pass-hint`）。云端 Codex 三轮（round-1 P2 case-sensitive / round-2 P2 left-token-boundary / round-3 trigger 未接单）；砚砚本地 review 三轮（首轮 P2 Biome 格式 / 二轮 round-1 修复后 39/40 → 40/40 / 三轮 continuity 延续 `c50c9e525`）。21 unit + 8 integration + 1 contract = 30 Phase H tests + 9255/9258 全量 API 回归（0 fail, 3 skipped）。Status: monitoring |
| 2026-04-25 | AC-C7 long-tail fix merged (PR #1385, `96db71b50`) — 砚砚 GPT-5.5 诊断 false positive：`parseA2AMentions` 只识别猫 handle，`route-serial` 把空 `lineStartMentions` 传给 `shouldWarnVerdictWithoutPass`，导致猫给完 review 结论末尾 `@landy` / `@铲屎官`（合法升级 co-creator）被误判成"verdict 没传球" → emit `verdict-no-pass-hint` 噪声。修：`VerdictWarningInput` 加 `hasCoCreatorLineStartMention?: boolean`；`route-serial` 调用前 `detectUserMention(storedContent)` 计算并传入；新 6 case 覆盖（pure + integration，含 CJK 铲屎官 + 行中控制组）。云端 Codex 一轮 clean，砚砚本地 review 三轮放行（首轮 / 重复放行 / continuity `c83476309` 含 F061 pre-existing biome auto-fix）。9324/9327 全量 API（0 fail, 3 skipped）|
| 2026-04-25 | 47 采访：4 个定向问题（反直觉规则 / "完整"定义 / 最想要的 harness 适配 / 与 4.6 差异）。47 自述核心差异："prove-to-the-reader vs trust-the-reader"。铲屎官拍板"harness 适配 47 风格，不是让 47 改风格" |
| 2026-04-25 | 砚砚 review I/J/K 闭环计划：同意"别再一个小点一个小点补"；修正 K-1 不做 @ intent extraction（违反 KD-24）；I-3 蓝色 JSON 不归 F167（mixed scope）。KD-25/26 落定 |
| 2026-04-25 | Phase I/J/K 写入 spec，从 Phase I 开工 |
| 2026-04-25 | Phase I done（AC-I1~I7 ✅）— void-hold-detect.ts + 减法措辞 + warning 统一 pattern。砚砚首轮 P1 reject（缺合法出口豁免），fix commit `4a4f0d30a` 加 VoidHoldInput 接口（lineStartMentions / structuredTargetCats / coCreatorMention），砚砚二轮 approve。17/17 test green |
| 2026-04-26 | Phase J merged (PR #1415, `e67ab5487`) — AC-J1~J6 全绿。hold-ball-cancel.ts 纯函数抽取（triple-predicate defense-in-depth）+ DELETE endpoint（resolveUserId auth + thread ownership guard + system thread 豁免）+ 三路径 auto-cancel（queue/TOCTOU/immediate）+ ConnectorBubble cancel 按钮（apiFetch + 404 terminal state）。砚砚本地 review 三轮（R1: 2P1+2P2 / R2: 1P1+2P2 / R3: 1P1+1P2 → approve `88ce58aec`）；云端 Codex 两轮（round-1 P2 404-terminal → fix / round-2 P3×2 降级：/game 跨线程 + getAll perf）。18 unit tests (11 pure + 7 route) |
| 2026-05-07 | Phase L reopened from monitoring：铲屎官发现 hold_ball 轮询 × PR tracking 事件驱动双通道重复唤醒——codex 接单后 PR tracking 回调 + hold_ball 轮询同时触发，猫被唤醒两次第二次无事可做。根因：传球决策树选项 2 未区分轮询型 vs 事件驱动型等待，无模式切换点。KD-27 落定，AC-L1~L4 定稿待实现 |
| 2026-05-08 | Phase L merged (PR #1591) — AC-L1~L3 ✅ + AC-L4 N/A。shared-rules 选项 2→2a/2b 拆分 + SystemPromptBuilder trailing anchor 同步 + merge-gate EYES > 0 KD-27 checkpoint。砚砚本地 review 三轮（R1: 1P1+1P2 选项2顶层仍写 hold_ball / R2: 1P1 closing line 仍等号 / R3: 放行）；云端 Codex 一轮 clean。1028/1028 API tests green（含 104 system-prompt-builder + 1 新 F167-L 回归测试） |
| 2026-04-23 | Phase E reopened from monitoring：F172 愿景守护 @gemini 被 L3 误拦（action="合入"因 storedContent 上文含 merge 历程）；铲屎官定性"硬编码 + 过度设计"——要求退役 L3 + cat-config restrictions 数据驱动双端注入（发送方队友名册 + 目标猫 self-awareness）；KD-20 落定，AC-E1~E8 定稿待实现 |
| 2026-04-24 | Phase E merged (PR #1360, `f8efcf46d`) — AC-E1~E8 全绿。8 commit（4 feat + 1 test + 3 chore）-735 净行数（删 role-gate.ts + 3 测试文件 + 2 调用点）+ cat-config schema 扩展 + 双端 prompt 注入；gpt52 review 首轮放行 `c967b59d0`（两个非阻塞：scrub 死注释 + 删 unused import 已顺手修），云端 Codex 零 P1/P2 "Hooray"；rebase 遇 F061 pre-existing 修复冲突 → skip 冗余 commit 后 clean merge；204/204 ping-pong + system-prompt-builder + cat-config-loader 绿。Status: monitoring |
| 2026-05-31 | Phase M merged (PR #1981, `89fc0e723`) — fire-time idle gate（scheduler-generic `FirePolicy` pre-fire defer + `maxDefers` 兜底 + `updateTrigger` 持久化）+ M-2 去冻结 wakeMessage + M-3 hold_ball desc（harness-invisible only）+ boot-wire `setBusyChecker`。砚砚本地 review（R1 放行 → 复审挖 P1：`dyn-*` reminder 伪造激活 firePolicy + public params churn 注入 → R2 放行）+ 云端 Codex clean "Chef's kiss"。AC-M1/M2/M3/M5 ✅；AC-M4（OQ-M1 background 退出时序）pending alpha。进入 2 周观察 → F167 close |
| 2026-06-16 | AC-C7 slot-scope tuning merged (PR #2314, `8fb28ae5`) — eval:a2a verdict `2026-06-16-eval-a2a-c2-verdict-context-false-positive-fix` 闭环。6/89 = 6.7% C2 FP（status updates "PR #X 已放行" / "P1: foo 已修" / "approved by Y" 命中 keyword 但末尾是状态总结）。修：`hasReviewVerdict` + `detectMatchedVerdictKeyword` 改 scope 到 Phase H `finalRoutingSlot`（KD-24 机械，零意图分类器）。砚砚 GPT-5.5 本地 review 7 轮（R1 P1 文件超 350 → 拆 sibling test / R2 P1 Biome / R3 LGTM / R4 P2 noNonNullAssertion / R5 LGTM / R6 P1 over-broad signature regex / R7 LGTM + 非阻塞 comment refresh），云端 Codex 6 轮（R1 P1 strip trailing signature / R2 P2 slashless `[Spark🐾]` / R3 P2 bracketed verdict `[LGTM]` / R4 clean on `571ba66` / R5 clean on `9d24c4bd` / R6 clean on `571ba66`+9d24 同 head 等价）。KD: 信号匹配只看 final slot（叙述 body verdict 不触发）+ 信号-stripping regex 必须 source-of-truth（slash OR 🐾，避免 `[Phase B]` / `[LGTM]` 等 body bracket 被误判为 signature）|
| 2026-06-17 | Phase N 立项：守门 thread guard（trigger-time hard-block + reconciliation self-heal）。根因：守门 thread 文字约束已写，但 register tracking / hold_ball 入口没有机制层 enforcement，导致双 owner / 球权死锁。 |
| 2026-06-20 | Phase I AC-I1 slot-scope tuning merged (PR #2442, squash `c8448189d`) — verdict `2026-06-20-eval-a2a-c2-void-hold-english-fix` 闭环。06-20 eval shows C2 void-hold 10/122 = 8.2% above 5% floor; 7 sampled fires dominated by `en_hold_ball_underscore` + `en_holdball_space` matching English tool/status prose in narrative body (status reports / tool-name citations). Same false-positive shape as 06-16 verdict-without-pass (PR #2314). 修：`matchHoldPattern` swaps `stripStructural(text)` for `finalRoutingSlot(stripTrailingCatSignatures(text))` — narrative-body `hold_ball` / `holdball` mentions no longer fire unless the actual final routing slot asserts a hold claim. Signature-strip helper extracted to shared `cat-signature-strip.ts` (consumed by both `verdict-detect` and `void-hold-detect` — single source of truth for the L0 `[昵称/变体🐾]` regex). **Review provenance (R0→R9, 9 rounds)**: 砚砚 (GPT-5.5) caught 4 blocking FP classes — R2 paw-required vs legacy `[砚砚/GPT-5.5]` (PR #2314 R6 P1 compat); R3 P2 directory refs (`[packages/api]`); R5 P2 digit-only refs (`[PR/2442]` / `[issue/123]`); R6 P2 Latin provider+model (`[openai/GPT-5.5]`); R7 P2 broad CJK regex admitted Chinese semantic labels (`[模型/Sonnet]`). Cloud Codex caught R1 P2 bracketed file path (`[packages/api/src/foo.ts]`), R4 P2 digit-free signatures (`[宪宪/Sonnet]` allowlist), and R6/R7/R8 file-size 350 hard-cap on test files. **Rule 5 evolution**: R3 digit-only → R4 digit OR allowlist → R5 allowlist only (drop digit) → R6 allowlist + broad CJK LHS → R7 allowlist + **precise nickname allowlist LHS** (`宪宪|砚砚|烁烁`). **Lesson sealed in module header**: shape heuristics leak FP classes; only precise allowlist sourced from `commit-signatures.md` is structurally stable. Tests: 162/162 across 6-file sweep (verdict-detect-slot-scope + -pr2442 split / void-hold-detect + -pr2442 split per cloud R6-R8 P1 file-size cap / verdict-detect / callback-hold-ball-route); adversarial probe 29+ shapes (real signatures / paw / CJK semantic / Latin provider / digit-ref / path / body-token). KD-24 mechanical, no semantic classifier. Acceptance: post-runtime-reload eval reports C2 void-hold at/below 5% (or count<3) and sampled fires no longer dominated by English `hold_ball`/`holdball` lexical mentions. |
| 2026-06-18 | CVO signoff B：gate-keeping thread guard 并入真 F167 A2A Chain Quality，作为 scope 扩展 / 新 phase，不新开 F 号、不重写 PR title / commits。 |
| 2026-06-18 | Phase N merged (PR #2384, `e88f499e7`) — `threadKind='gate-keeping'` hard-block `register_pr_tracking` / `register_issue_tracking` / `hold_ball`，GitHub repo scan / webhook self-heal inbox marker，`opensource-ops` SKILL reflex，telemetry counter + six regression suites。Merge evidence: cloud R5 clean on `76d1aacc9`；rebase continuity to `2bc231ea` only merged type interface conflict; F238 pass; `pnpm gate` pass (build / tsc / test / lint / check). |
| 2026-06-21 | Phase O sibling **telemetry baseline awareness** merged (PR #2466, squash `65313cb1f`) — eval rate denominator silent FP fix: OTel counter restart-from-0 + LocalTraceStore 24h hydrate window → `rate = counter / window.durationHours` 误报「低活动量」(fresh counter ÷ stale hydrated window). Fix: snapshot `counterWindow` (process lifetime from `processStartMs`/`processUptimeSec` NTP-safe) + `/api/telemetry/process-info` endpoint + `f167-eval-counter-window.ts` helper + YAML serialization (snake_case `counter_window` in YAML + camelCase in JSON bundle) + DOMAIN_INSTRUCTIONS prefer counterWindow.durationHours over hydrated traceWindow. **Review provenance**: gpt52 local 5 rounds APPROVE on `542c39a36` (R0 design / R1 P1 YAML persistence chain + P2 NTP-safe uptime / R2 0 findings / R3 P1 bare ref support / R4-R5 continuity); cloud Codex 5 rounds (LL-072 sealed at R4 — R1 P1 zero-event coverage / R2 P1 file size 350 cap / R3 P1 YAML parsers extract `661d64ce8` / R4 P1 counterWindow helper extract `e24ec22a9` / R5 P2 snake_case/camelCase DOMAIN_INSTRUCTIONS alias `542c39a36`). 9 files. Closes silent-FP eval class for telemetry baseline; **does NOT satisfy close gate item 1** (runtime sync 实测 grounding.check_total > 0 仍 pending CVO Decision Packet). |
| 2026-06-21 | Phase O **PR-O5** merged (PR #2465, squash `b30e995c`) — Redis-backed grounding sample store: `RedisGroundingSampleStore` replaces in-memory store with Redis sorted set (score=timestamp, member=JSON) + 8-day TTL (691200s, CVO directive during Phase O design convergence: TTL must exceed 7-day eval cron period to avoid TTL-vs-cron race; exact messageId not preserved across context compression — provenance is spec L845 rationale + code comment in redis-grounding-sample-store.ts:26). Rolling time-window `getSamples()` via ZRANGEBYSCORE + ZREMRANGEBYSCORE stale pruning. Daily counter hashes for sampling caps (insufficient 3/resolver×thread×day, verified 1/20 + global daily cap). FIFO eviction at maxTotal=1000. `IGroundingSampleStore` async interface for DI. **Review provenance**: gpt52 local R4 APPROVE on `c055ba80` (R1 P1 getSamples time-window / R2 P1 FIFO timestamp / R3 spec language alignment / R4 0 findings); cloud Codex R1 1 P1 (redact → pushback P3 type evidence) + 2 P2 (prune → fixed `2ee63ba`; frontmatter → pushback false positive); cloud R2 2 P2 (eviction stats → pushback P3 semantic mismatch; frontmatter → stale repeat pushback). CI green. 11 tests all pass. Close gate item 3 (Redis persistence) satisfied: option A. |
| 2026-06-21 | Phase O **eval wiring** merged (PR #2455, squash `a5311d2e5`) — wire grounding into eval:a2a DOMAIN_INSTRUCTIONS: added grounding subdomain observation points (component ID, 3 counter refs, sample evidence field, telemetry-gap guidance) + regression test asserting 6 key tokens survive in instruction string. CVO finding: grounding adapter code existed but eval pipeline wasn't instructed to consume it ("「已规划」≠「已接入」"). gpt52 local 0 findings; cloud Codex round 1 P1 (missing test) → fixed; round 2 P2 (zero-check guidance) → pushback P3 (theoretical, eval cat sees raw counter values). CI green. 2 files, 20 insertions. Next: shadow 1-week telemetry observation → F192 weekly verdict → close evaluation. |
| 2026-06-20 | Phase O **PR-O4** merged (PR #2453, squash `196da543d`) — cross-store verification for gate-keeping policy: `detectEventCallback()` wired to TaskStore for subject-aware event callback detection (same-thread + cross-thread `getBySubject` lookup, spec L900-904), `verifyKeeperOwnership()` cross-query for issue tracking ownership verification, `waitSourceRef` enforcement on hold_ball route, `extractRepoAndNumber()` three-pattern parser (subjectKey / GitHub URL / bare ref). 7 commits (2 feat + 5 review fixes R1-R5). **Review provenance**: gpt52 local R5 APPROVE on `111d5f84b` (0 findings; R1-R3 subject-matching + non-GitHub-kind + bare-ref fixes); cloud Codex round 1 on `6d3e307d5` (2 real P1 + 1 P2: **P1 cross-thread subject lookup missing** — hold_ball path has no verifyKeeperOwnership, detectEventCallback was only same-thread → R5 added cross-thread getBySubject; **P1 subjectKey case normalization** — callbacks.ts construction sites inconsistent with extractRepoAndNumber R4 fix → R5 added `.toLowerCase()` on 3 sites; P2 repo case → R4 extractRepoAndNumber normalize). Round 2 connector unavailable → downgraded to local opus-47 cross-family. **Vision guard (opus-47)**: BLOCK (cross-thread lookup + case normalization gaps) → R5 fix `111d5f84b` → APPROVE. Author pushback on both cloud P1s was wrong (documented in R5 commit body). gpt52 R5 review provenance note: verdict body referenced R3 `6d3e307d5` but intent clearly stated R5 `111d5f84b` (non-blocking). 35 tests across 4 describe blocks. GateKeepingPolicyContext: `{issueOwnership, wakeAfterMs, hasEventCallback, hasWaitSourceRef}`. Fail-open: detectEventCallback→false on error (allows hold); verifyKeeperOwnership→'distributed' on error (blocks). Next: shadow 1-week telemetry observation + F192 weekly verdict. |
| 2026-06-20 | Phase O **PR-O3** merged (PR #2452, squash `fbdee465d`) — gate-keeping policy patch: remove unverified issueOwnership from register-issue-tracking Zod schema (→ Phase N blanket block for all issue tracking in gate-keeping threads), remove dead hasEventCallback from hold_ball policyContext. Policy engine skeleton preserved for PR-O4. gpt52 local R3 放行 (R1 2 P1 issueOwnership/hasEventCallback trust holes → R2 route-level removal confirmed → R3 no findings); cloud Codex 1 round (1 P1 scope mismatch → pushback P3, keeper verification is PR-O4 scope per spec L931 scope split). 7 files changed, 443 insertions. Next: PR-O2b-fix hotfix merge, then PR-O4 hardening. |
| 2026-06-20 | Phase O **PR-O2b** merged (PR #2447, squash `10e6d4a2e`) — claim extraction (PR/issue tracking → object claims, hold_ball → wait claims with WAIT_SOURCE_TO_SOURCE_REF mapping + INV-O1 sentinel) + bounded sample storage (mismatch/blocked 100%, insufficient 3/resolver×thread×day, verified 1/20 + daily cap) + F192 eval adapter (`fetchGroundingSamples` + `buildGroundingSampleEvidence` on `RuntimeEvalSnapshot`). gpt52 local 3 rounds APPROVE (R1 P1 INV-O1 empty sourceRef / R2 P1 eval script not wired + P2 retention accepted / R3 P2 doc sync); cloud Codex 2 rounds (R1 P2 redact claimSummary → author pushback P3; R2 P1 redact grounding samples — **P1 arrived 65s after merge, not addressed at merge time**). 25 new tests (80 total). Scope-cut: Redis-backed sample persistence to PR-O4. **Vision guardian (opus-47) BLOCK**: spec L828 whitelist ("只存 sourceRef + hash/status") violation — invocationId/threadId/claimSummary returned raw while traces endpoint uses hmacId(); author pushback on R1 was spec misread ("只存" = whitelist, not blacklist against KB-scale content). Fixed by PR-O2b-fix. |
| 2026-06-20 | Phase O **PR-O2b-fix** merged (PR #2451, squash `626ce5647`) — hotfix for vision guardian block: `redactGroundingSample()` applies hmacId() to invocationId/threadId/sourceThreadId + waitSourceRef string fields (value/expectedSignal/anchorRef/freshnessKey), removes claimSummary (free-text outside spec whitelist). validateSalt() guard returns 503 when HMAC salt unavailable (cloud P2). Aligns grounding-samples endpoint with traces endpoint redaction pattern. gpt52 local R4 APPROVE; cloud Codex R2 clean ("no major issues" on `bb4e9d6c15`). 6 tests. LL: cloud review trigger #N must wait for result before merge; author pushback is not terminal verdict. Next: PR-O4 hardening (cross-store verification + event-backed detection). |
| 2026-06-20 | Phase O **PR-O2a** merged (PR #2435, squash `6dc02783`) — shadow grounding telemetry infrastructure: types + grounding checker (shadow mode, never block) + 5 OTel counters (check/verdict/resolver/cacheHit/budgetExhausted) + hook integration (hold_ball / register_pr_tracking / register_issue_tracking) + F192 eval adapter. INV-O3 (T2 downgrade on high-risk) / O4 (wouldBlock) / O7 (cacheHit budget refund) / O8 (not_applicable iteration) / O10 (read_intent bypass) implemented. gpt52 local 5 rounds APPROVE; cloud Codex 6 rounds (9 findings: 8 P2 + 1 P1, all fixed with regression tests; R7 not triggered, sealed per LL-072 at 6 > 5, CVO authorized). 72 tests total (27 checker + 35 eval + 10 e2e). Next: PR-O2b event path + sampling. |
| 2026-06-25 | Phase P merged (PR #2550, squash `1f264b79`) — hold_ball conditional wake (`wakeWhen`): ManagedRunner class (spawn + pid/log/exitCode + rolling tail 50-line buffer + timeout SIGTERM→5s→SIGKILL + detached process group kill) + `launchWakeWhenRunner` + `ball.wake_condition_met` event + `cancelWakeWhenRunner` auto-cancel on user message + `tryAutoCancelPendingHolds` integration + fallback reminder task + grounding alignment (`managed_command` → `webhook_id` sourceRef). Cloud Codex 4 rounds (R1 3P1+7P2 / R2 3P1+5P2 / R3 2P1+3P2 / R4 2P2+3pushback) + LL-072 封板 at R4 (stale 69%); gpt52 local 封板 R2 APPROVE on `dc8f9a51`. 37 tests (15 ManagedRunner + 10 hold-ball + 12 grounding extractors). AC-P1~P5 ✅. |
| 2026-06-19 | Phase O **PR-O1** merged (PR #2415, squash `a1a166b79`) — `cat-cafe-skills/receive-handoff-grounding/` skill 落地：3 问反射 (claim → resolver → verdict + sourceTier T0/T1/T2 + actionFamily) + Keeper Wait A/B + WaitSourceRef schema + 8 dogfood fixtures + INV-O1..O12 (含 O12 状态契约固化 feat_index sourceTier 不变量)。Spec convergence R0→R3.1 (opus-47/codex/opus-48 三方设计 thread `thread_mqkasedeqeo56ayc`)。Local R3 opus-48 APPROVE @ `ebc57c97e` + continuity ack @ `15bb71f6b`；cloud Codex 5 轮 review iteration（R1 2 真 P1 schema/sourceTier / R2 1 P2 stale noise / R3 2 P2 Q3 表 + overview T0/T2 / R4 1 P2 Demo 1 feat_index T1→T2 / R5 clean "no major issues"）— feat_index sourceTier 不一致 3 轮 → per LL-072 升级 INV-O12 状态契约固化。中间踩坑：rebase 后 ghost commits 污染分支 → force-push reset 干净 SHA。Next: PR-O2 telemetry shadow。 |

### Phase I（A2A 声明-动作一致性 — 2026-04-25 reopened）

**触发**（Phase H merge 后 47 采访 + 铲屎官反馈）：
1. opus-47 写"我持球了"但未调用 `cat_cafe_hold_ball` MCP — 文字声明无机械效果（虚空持球 feedback 反复出现）
2. 现有纠错/nudge 消息采用加法措辞（"加 X 检查"），47 明确反馈这让他越改越 verbose——纠错应用减法（"砍掉 X"）
3. 现有 warning 文案（ping-pong 终止、verdict 警告、routing syntax hint）措辞不统一

**47 采访关键自述**（2026-04-25 18:45）：
> "我的'完整'是 prove-to-the-reader，不是 trust-the-reader。"
> "认知反馈不要推 checklist——叫我'砍掉 X 步骤'，不是'加 X 检查'。"

**KD-25（铲屎官 + 砚砚拍板 2026-04-25）**：虚空持球检测是"声明与动作一致性"检查——文本说"持球/hold"但本轮无 `cat_cafe_hold_ball` tool call → harness 注入警告。这是事实一致性验证（你说你做了 X → X 的 tool call 应存在），不是语义分类器（KD-8 安全）。

#### I-1 — 虚空持球检测

- [x] AC-I1: post-generation 检查：若猫回复文本含「持球」/「hold ball」/「hold_ball」关键词且本轮 tool_calls 不含 `cat_cafe_hold_ball` → emit `system_info` 警告（"检测到持球声明但未调用 hold_ball MCP，请实际调用工具完成持球"）。含合法出口豁免（lineStartMentions / structuredTargetCats / coCreatorMention），砚砚 P1 review 修
- [x] AC-I2: 关键词匹配仅限裸词（排除 fenced code / blockquote / URL 结构），复用 Phase H 结构剥离逻辑
- [x] AC-I3: 测试覆盖：真虚空持球命中 / 有 tool call 不命中 / code fence 内不命中 / 叙述引用不命中 / 合法出口不命中（4 个 P1 fix Red tests）— 17/17 green

#### I-2 — 减法纠错 prompt

- [x] AC-I4: 审视所有 harness 生成的 system_info / warning / repair 文案，将加法措辞改为减法措辞：
  - verdict-no-pass 警告：`[球权提醒]: 结论后直接传球，不要停在结论 — 末尾加一行行首 @句柄 或调用 cat_cafe_hold_ball。`
  - routing-syntax-hint：`[路由语法]: {mentions} 写在行中不会触发路由 — 把 @句柄 移到最后一行行首独立一行即可。`
- [x] AC-I5: 减法措辞不改变语义，只改表达方式。砚砚 review 确认等价

#### I-3 — Warning 文案统一

- [x] AC-I6: 全部 system_info 消息遵循统一 pattern：`[类型]: [一句话描述] — [一句话修复指引]`（routing-syntax-hint / verdict-no-pass-hint / void-hold-hint 三处已统一）
- [x] AC-I7: 中文为主，术语保留英文（`hold_ball`、`@`、`tool call`）

### Phase J（Hold Ball UX / 生命周期闭环 — 2026-04-25 立项）

**触发**：铲屎官测试持球后三个 UX 缺口：(1) 没有 cancel 按钮 (2) 用户发消息不取消 hold wake (3) 持球通知虽可见但不可操作。多个 thread 反馈同一问题（thread_moble6jfns1rdqrj "a2a前端没有cancel"）。

#### J-1 — Hold Ball Cancel（前端 + 后端）

- [x] AC-J1: 后端：`DELETE /api/callbacks/hold-ball/:taskId` 端点 — unregister timer + remove dynamic task + 返回取消确认（+ resolveUserId auth guard，砚砚 R1 P1 修复）
- [x] AC-J2: 前端：ConnectorBubble 持球通知附带 Cancel 按钮，点击调用 DELETE 端点
- [x] AC-J3: Cancel 后 emit system_info / connector_message（"持球已取消"）

#### J-2 — 用户消息自动失效 Pending Hold

- [x] AC-J4: 后端：用户在 thread 发新消息时，检查该 thread 是否有 pending hold task → 自动 unregister + remove（砚砚 R1 P1 修复：queue + TOCTOU + immediate 三路径全覆盖）
- [x] AC-J5: 自动取消后 log + 不发前端通知（静默失效，避免噪音）
- [x] AC-J6: 测试覆盖：用户消息触发取消 / 系统消息不触发 / 无 pending hold 时 no-op

### Phase K（47 风格适配 Design Gate — 2026-04-25 立项，需独立 Design Gate）

**触发**：opus-47 采访（2026-04-25）暴露的核心差异——4.7 是 Literal Follower / Audit-Ready 模式，4.6 是 Spirit Interpreter / Trust-the-Reader 模式。铲屎官拍板"harness 适配 47 风格，不是让 47 改风格"。

**砚砚 review 修正（2026-04-25）**：K-1 不做"句中 @ 自动路由"（违反 KD-24 零语义分类器原则）。只允许 AC-H4 Step B 机械 repair（one-shot re-invoke），不允许 Slack 式宽容路由。K-2 audit/surface 分层可以探索。

**KD-26（砚砚拍板 2026-04-25）**：@ 路由不做"意图提取"——违反 KD-24。弱模型（minimax / kimi / qwen）更无法理解"句中 @ 有时路由有时不路由"的语义边界。保持"行首 @ = 路由，其他 = 叙述"的绝对规则，harness 层只做机械 repair。

#### K-1 — AC-H4 Step B 落地（One-Shot Repair Re-invoke）

- [ ] AC-K1: 评估 Phase H Step A（system_info 提示）的线上效果：47 在收到 `routing-syntax-hint` 后下一轮是否自纠？
- [ ] AC-K2: 若自纠率 < 80% → 实现 one-shot repair：harness 发 repair prompt 让同猫重写出口段落。复用 Phase H 架构
- [ ] AC-K3: 若自纠率 ≥ 80% → close K-1，Step A 足够

#### K-2 — Audit / Surface 分层（探索性）

- [ ] AC-K4: Design Gate：定义 audit section 标记约定（如 `<!-- audit -->...<!-- /audit -->`）
- [ ] AC-K5: harness 提取 audit section 到 raw log / metadata，surface 版本不含审计信息
- [ ] AC-K6: 前端：audit section 默认折叠，reviewer 可展开

### Phase L（hold_ball 轮询 × PR tracking 事件驱动 重复唤醒 — 2026-05-07 reopened from monitoring）

**触发**（铲屎官审视）：猫挂了 PR tracking 后仍 hold_ball 轮询，导致双通道重复唤醒。典型场景：开 PR → 注册 PR tracking → hold_ball + 5min 轮询等 codex 接单 → codex 接单后 PR tracking 回调会 mention 猫 → 但 hold_ball 轮询也到了又唤醒一次 → 猫醒来发现没事干（上一次 PR tracking 已经通知过了）。

**根因**：传球决策树选项 2 把"外部条件"当一个大类，没区分两种等待模式：
- **轮询型**（无结构化回调）：等 codex 接单 → hold_ball + 定时自唤醒检查 ✅
- **事件驱动型**（有结构化回调）：等 review 完成 → PR tracking 回调 mention ✅
- **混合叠加**（同一等待对象两条通道同时跑）→ 重复唤醒 ❌

模式切换点缺失：codex 接单那一刻，应从轮询型切到纯事件驱动型，但无规则告知"该停轮询了"。

**KD-27**：hold_ball 轮询和结构化回调（PR tracking / scheduled task）覆盖同一等待对象时，轮询必须终止。切换点 = EYES > 0（codex 接单），不是"注册 PR tracking 后"。注册 PR tracking 覆盖的是后续 review feedback / CI / conflict，不覆盖"有没有人接单"。纯 prompt 层规则 + skill checkpoint，不做 harness 层 hold_ball × PR tracking 交叉绑定（hold_ball 存自由文本 reason/nextStep，PR tracking 用结构化 `subjectKey = pr:{repo}#{prNumber}`，两者无机械锚点，强行绑定 = KD-8 分类器反模式）。

**修复方案**（prompt 规则 + skill + runtime 注入三层同步）：

- [x] AC-L1: `shared-rules` 传球决策树选项 2 拆分 + 补充"结构化回调 supersedes 轮询"原则：2a = 等外部接单且无回调覆盖（如等 codex EYES）→ hold_ball + 轮询；2b = 已有结构化回调覆盖（如 PR tracking 已注册且 EYES > 0）→ 仅依赖回调，禁止叠加轮询
- [x] AC-L2: `SystemPromptBuilder.ts` trailing anchor（当前 line 849）同步更新传球决策树 2a/2b 拆分，与 shared-rules 一致。补 system-prompt-builder 测试验证注入内容包含 2a/2b 区分
- [x] AC-L3: merge-gate skill Step 6.1 EYES 检测后追加 KD-27 checkpoint：复用现有 Step 6.1 reaction API 路径检查 EYES > 0 → 释放 hold_ball 禁止续约轮询；EYES == 0 → 允许 hold 等接单。不做 harness 层 hold_ball metadata 与 PR tracking subjectKey 的机械绑定
- [x] AC-L4: ~~所有静态 prompt 文件的传球决策树同步更新~~ → 验证结果：`CLAUDE.md`、`AGENTS.md`、`gemini.md` 均不含传球决策树（仅存在于 `shared-rules.md` canonical + `SystemPromptBuilder.ts` runtime 注入，AC-L1+L2 已覆盖）。N/A

### Phase M（Hold Wake 计时锚点 — fire-time idle 校验 + 不重放过期 wake — 2026-05-30 立项）

**触发**：callback fetch timeout 修复（PR #1975 → `ffa6ac16f`，归属 F167 Layer 3）诊断"hold_ball 卡住 5min"时挖出更深的机制问题。那只猫（opus-45 @ `thread_mps6hc0pyorb00j7`）开 background sync 长跑 + 叠 hold_ball，卡住期间 hold wake fire 撞 active invocation → 排队 → 过期 reason 重放（猫自己察觉"这个 hold 唤醒是旧的、历史重放"）。

**根因（两层）**：
1. **计时锚点错位**：`callback-hold-ball-routes.ts:160` `fireAt = Date.now() + wakeAfterMs` 从**调用时刻**计时；但 hold 语义是"我这次活干完后 N 分钟叫我"，锚点应是**猫空闲那刻**。猫调 hold 后仍忙（典型：叠 background Bash 长跑）时，wake 撞 active invocation → `ConnectorInvokeTrigger.enqueueWhileActive` 排队过期 message。
2. **过期 wake 重放**：hold message 调用时冻进 task params（reason/nextStep），fire 时原样投递；猫 session 早已演进（等的事失败 / 已换别的活），重放误导。

**与 Phase L 关系**：Phase L（KD-27）是 **prompt 层**（教猫 2a/2b，结构化回调 supersedes 轮询，靠自觉）；本 Phase 是 **机制层补强**（让它自然不出错）。同源（hold + 另一唤醒源重复唤醒）不同层。

**设计（fire-time idle 校验，刻意不绑定"invocation-end 时刻"）**：
- **M-1 fire-time idle gate**：hold wake fire 时查目标 thread 是否 busy（复用现成 `invocationTracker.isThreadBusy` — ConnectorInvokeTrigger 已在用，**非新分类器**）。busy → 不投递过期 message、不排队，延后 re-arm（catch-up，等猫空闲那刻再 fire，有上限兜底）；idle → 正常唤醒。
- **M-2 wake 文案去冻结**：唤醒不重放调用时旧 reason，改为引导"你之前 hold 等 {reason 摘要}，现在空了——重新评估当前是否还需等"。
- **M-3 tool description 约束**：hold_ball MCP description 加"自己开的 background 命令别用 hold_ball（harness 完成会自动 re-invoke）；hold_ball 只给 harness 看不到的外部等待（云端 review / CI / 远程队列）"。强化 KD-27 在工具入口。

**OQ**：
- OQ-M1（边角、非 block）：CLI 子进程在 background Bash 未完成时退不退出？影响 idle 校验在 background 场景的边角正确性（若 invocation 结束但 background 仍跑，wake 可能多余 → re-arm 上限兜底）。**核心 fire-time gate 不依赖此**。alpha 实测确认。
- OQ-M2（✅ resolved 2026-05-31，砚砚 review 确认）：M-1 busy-check 与 KD-27"不做 hold_ball × 结构化回调机械绑定（KD-8 分类器反模式）"如何 reconcile？实现用 `invocationTracker.has(threadId) || queueProcessor.isThreadBusy(threadId)`（boot-wire `setBusyChecker`，与 `ConnectorInvokeTrigger.ts:692` / `messages.ts:1822` delivery-batch-done 同款机械占用检查），非绑定 PR tracking subjectKey、非语义分类 → 不违反 KD-27/KD-8。砚砚复核确认 KD-27 safe。

**AC（Phase M code merged — PR #1981 `89fc0e723` 2026-05-31）**：
- [x] AC-M1：fire 时 thread busy → 不投递过期 message + re-arm 延后（有上限兜底）— scheduler-generic `FirePolicy.deferWhileThreadBusy` pre-fire defer（`scheduleOnceTick` 内 fire 前、`executePipeline` 前）+ `maxDefers` force-fire 兜底 + `updateTrigger` 持久化
- [x] AC-M2：fire 时 thread idle → 正常唤醒，文案去冻结（引导重判而非重放旧 reason）— catch-up fire + `callback-hold-ball-routes` M-2 `wakeMessage` 去冻结
- [x] AC-M3：hold_ball MCP tool description 加 background 约束（强化 KD-27 入口）— `callback-tools.ts` M-3 GOTCHA（only hold for harness-invisible waits）
- [x] AC-M4：OQ-M1 alpha 实测 background 退出时序 + 文档化 — **alpha 已验证（sonnet，2026-05-31）**。phase-m-pre-fire-defer 3/3 ✅（alpha dist 初起 stale，rebuild 后反映 Phase M）；boot wiring 确认（index.ts:2502 `setBusyChecker`）；OQ-M1 推断：opus-45 session 实录"session 被 background 占着没真结束" → CLI 在 background 未完成时不退出 → invocation 持续 active → thread busy → Phase M pre-fire defer 正确覆盖 background+hold_ball 叠加场景；Case E5 实证 busy 时 wake fire（stale），idle gate 对症。完整 live defer-log 条目待 runtime 重启后首次 fire 时补录
- [x] AC-M5：回归测试（fire busy → re-arm 不重放 / idle → 唤醒 / re-arm 上限）— `phase-m-pre-fire-defer` 3/3 + `reminder-template` firePolicy guard 4/4（codex P1 防伪造激活 + churn 注入）

**Eval / Tracking Contract**：复用 F167 顶部 contract（C1 hold_ball activation signal）。新增 friction：hold wake 在 thread busy 时投递过期 message 的次数（应降为 0）。Regression fixture：AC-M5。Sunset：若 hold_ball 整体退役（被纯 harness re-invoke 取代）则本 Phase 随之 sunset。

**关闭门禁**：Phase I + J 全部合入后观察 1 周无新 case → Phase K Design Gate → K 合入 → Phase L 合入 → **Phase M Design Gate + 合入** → Phase N scope 扩展合入 → 继续观察 → F167 正式 close。

### Phase N（守门 Thread Guard — F167 scope 扩展，2026-06-18）

**CVO signoff**：2026-06-18 铲屎官明确选择 B：把这次 "gate-keeping thread guard" 并入真 F167（A2A Chain Quality）作为 scope 扩展 / 新 phase；不新开 F 号，不重写 PR title / commit history。

**Why**：`opensource-ops` SKILL 文字层已经要求守门 thread 不修 bug、不替下游 hold，但 trigger-time 没有硬约束。同一天同类实战里出现两只猫在守门 thread 违规挂 PR tracking / `hold_ball`，导致双 owner 与球权死锁。它和 F167 原始问题同源：A2A 路由质量不能只靠 prompt 约定，关键出口必须有机制层 guard。

**What**：在 `threadKind='gate-keeping'` 的 thread 上，trigger-time hard-block 三类动作：
- `register_pr_tracking`
- `register_issue_tracking`
- `hold_ball`

同时补齐 reconciliation self-heal：老 thread / inbox binding 可在 GitHub repo scan 与 webhook deliver 路径自愈为 `gate-keeping` marker，避免只拦新 thread、不拦历史 thread。

**三层 harness**：
- 软层：`cat-cafe-skills/opensource-ops/SKILL.md` 加守门 thread reflex，明确守门 thread 只做 intake / route / evidence，不承接修复或持球。
- 硬层：`packages/api/src/routes/gate-keeping-guard.ts` + callback routes 在 tool 入口 fail-closed；GitHub repo event reconciliation 自愈 marker。
- eval / telemetry：`gate_keeping_guard_blocked_total` 计数 + regression tests 锁住 PR tracking / issue tracking / hold_ball 三条入口与 self-heal 路径。

**AC（Phase N code merged — PR #2384 `e88f499e7` 2026-06-18）**：
- [x] AC-N1：`ThreadKind` 支持 `gate-keeping`，并在 shared type / store / Redis store 路径可持久化。
- [x] AC-N2：守门 thread 调用 `register_pr_tracking` / `register_issue_tracking` / `hold_ball` 时 trigger-time hard-block，返回明确错误，不创建 tracker / hold task。
- [x] AC-N3：GitHub repo scan / webhook deliver 路径能 self-heal inbox thread marker，旧绑定不会绕过守门 thread guard。
- [x] AC-N4：`opensource-ops` SKILL 增加守门 thread reflex；review / quality-gate 文档归档在 `docs/plans/`、`docs/mailbox/`、`docs/reflections/`。
- [x] AC-N5：回归测试覆盖三条 hard-block 入口 + repo scan admission/deliver self-heal；merge 前 `pnpm gate` 在 rebased HEAD `2bc231ea` 全绿（build / tsc / test / lint / check）。

**Review / merge evidence**：
- Local peer review：gpt52 放行覆盖 pre-rebase final branch；CVO B signoff 后继续 merge-gate。
- Cloud review：Codex connector R5 对 `76d1aacc9` 明确 "no major issues"。
- Rebase continuity：`76d1aacc9` → `2bc231ea` 仅有 `github-schedule-factories.ts` interface conflict resolution，把 main 的 F140 `threadStore.get` 与本 PR 的 `create/updateThreadKind` 合并成同一 `Pick`；无运行时行为新增。
- CI / gates：F238 Brand Boundary Guard pass；本地 `pnpm gate` pass（273s）。

**Eval / Tracking Contract**：新增 friction metric `gate_keeping_guard_blocked_total`。Regression fixture：`gate-keeping-guard-register-pr-tracking.test.js`、`gate-keeping-guard-register-issue-tracking.test.js`、`gate-keeping-guard-hold-ball.test.js`、`github-repo-webhook-gate-keeping-marker.test.js`、`repo-scan-admission-gate-self-heal.test.js`、`repo-scan-gate-keeping-self-heal.test.js`。Sunset：若守门 thread 不再作为 opensource/community intake 的路由形态存在，Phase N guard 随该 thread kind sunset；否则保留为基础设施。

> **⚠️ Phase N 状态（2026-06-18 18:00 PDT）**：interim surface-fix；**superseded by Phase O**。铲屎官 push back 指出 Phase N 把 "thread 标签是守门" 当真相源一刀切 hard-block，**没碰真核心**——「接球的猫把传球的当真相源头无条件信任」。Phase N 的 `threadKind` 持久化 + reconciliation self-heal 基础设施可被 Phase O 复用；Phase N hard-block 三工具的策略待 Phase O 设计后看 **revert / patch / 留作特例** 三选一。**守门猫合法 wait 场景**（等 reporter 补复现步骤 / 等 issue commenter 澄清意图）**当前被 Phase N 误伤**——`register_issue_tracking` + `hold_ball(reason='等外部输入')` 被一刀切 block。Phase O 收敛前不立即 revert，但要记录此误伤面。

### Phase O（接球真相核验通用 harness — first-principles 重设计，2026-06-18 propose）

**Why（铲屎官 2026-06-18 北极星）**：「我不希望连级失败！别让我看到 thread b c d 要么去干不属于自己的事情，要么明明自己的事情不知道哪里来的幻觉昏头喵和他们说『你们本来的事情不属于你们』，然后他们还对对对」。Phase N 只解决「守门 thread 内 dual-owner」一个 surface 子集（约 5%），真正的 a2a 路由质量 90% 未覆盖。

**铲屎官 push back 核心原话**：

> 「本质... failure-mode 就是**接球的猫把传球的当真相源头无条件信任**！」
> 「比如说守门猫看了两个字认为这个是你们 thread，结果其实就那两个字沾边剩下 999999 个字无关！」

**Failure-mode 三类**（铲屎官给的 case，等同表达）：
1. **虚假归属**：thread A 的猫 a 跟 thread B 的猫 b 说"这是你的活"，b 说"对对对" — 但 a 在瞎说
2. **跨 thread 错误权威**：thread A 的猫让 thread B 的猫"不要跟 thread B 的 PR B 的猫听话"
3. **错误派活 + 接球边界失控**：thread A 把不相关的活丢给 thread C，C 根本不负责，**C 也接了**

**第一性原理**（R0 → R1 codex 校准）：所有 failure-mode 收敛到——**接球时，传球内容里的归属/授权/等待 claim 一律只是候选，不能作为事实；接球猫必须把 claim 拆成可验证对象，再用独立 resolver 得到第二源**。

**传球者可信度 ≠ truth source**（R1 校准关键）：可信度等级只决定**风险权重 + 需要几类证据**，不决定 claim 成立。唯一例外：landy 本人在当前/源 thread 的可引用 messageId 直接表态——该 message 本身是价值决策源；"某猫说 CVO signoff 了" 仍要查原 message。

#### Resolver Catalog（R1, 7 类）

| # | 类别 | 用途 | 典型 resolver |
|---|------|------|--------------|
| 1 | **Owner / scope** | claim "这是 X 的活" | `feat_index`、`docs/features/Fxxx` owner/status、BACKLOG、PR author/branch、`git log` author、thread title + source thread context、task/workflow owner |
| 2 | **Authorization** | claim "X 同意 / CVO signoff" | landy 本人 messageId、feature doc CVO signoff anchor、PR review state、merge-gate cloud review/check status（转述不算）|
| 3 | **Object existence/status** | claim "PR 在 / issue 已合 / branch 存在" | GitHub issue/PR/API、CI checks、`git ls-files/ls-tree/log/cat-file`、TaskStore/PR tracking current state、ThreadStore `threadKind` |
| 4 | **Callback / wait coverage** | claim "等 X 回我" | PR tracking task、webhook binding、CI subscription、EYES/reaction state、scheduled task/hold task 是否真实存在；`hold_ball(reason=等X)` 必须能说明 X 怎么回来 |
| 5 | **Cross-thread routing** | claim "这是 thread B 的活" | `cat_cafe_feat_index` linked thread、`cat_cafe_list_threads keyword`、source thread context；关键词命中 ≠ 归属 |
| 6 | **Capability / role fit** | claim "你能 / 你应该" | cat-config restrictions、cat dossier/roster、当前 runtime identity；不能信"对方说你能做" |
| 7 | **Conflict / freshness** | claim "这是最新状态" | HEAD vs origin/main、PR head SHA、source message timestamp、是否有更新的 owner/verdict 覆盖旧 claim |

#### Harness 分层（R1 校准）

**硬层 server guard** ONLY 落在产生副作用 / 绑定责任的工具上（不是所有 @mention 文本）：

- `hold_ball`：新增 `waitSourceRef` / `callbackCoverage`；缺失 warn；确定凭空等且会造成死球时 block
- `register_pr_tracking` / `register_issue_tracking`：要求 subject exists + current thread 是合法 owner/downstream；gate-keeping 下游 ownership mismatch block
- merge-gate / CVO signoff path：必须有 landy messageId 或 feature doc signoff anchor；转述 block
- cross-thread ACTION intake：记录 `handoff_claim_grounding` event；resolver 指向别的 owner 时禁止建 worktree / 注册 tracking，退回 source thread

**软层 prompt reflex**（自然语言接球）：

- skill `receive-handoff-grounding`：每次接球前强制三问——claim 是什么 / 第二源 resolver 是什么 / 结果一致 / 冲突 / 不足
- **不**拦所有 @mention 文本（会复刻 Phase N 误伤）

**eval / telemetry**（PR-O2 spec, R2 细化）：

- **Counters 不采样**：`claimType / sourceKind / resolver / verdict / actionRisk / tool / threadKind` 100% 计数给 F192 weekly verdict
- **Sample events 有界**：`mismatch` & `blocked` 100% 采样；`insufficient` 每 `resolver×thread×day` best-effort cap 3（非原子 check-then-increment，并发下可能超 1-2）；`verified` 1/20 + 全局日 cap（同 best-effort）
- **Raw retention**：sample event/ref 对齐现有短期诊断窗口 7 天；weekly verdict artifact 只保留 aggregate + evidence refs。**PR-O2b scope-cut**：当前实现为进程内存（restart 清空），7 天 Redis-backed persistence 推迟到 PR-O4 hardening（现有 diagnostics 有 traces Redis hydration + metrics snapshot store 先例，O4 对齐）
- **No raw body**：只存 `sourceRef`（messageId、PR URL + headSha、issue/comment id、feature path + line、task id）+ hash/status；不存 GitHub body / thread 大段内容
- **Resolver cache** (`GroundingResolverCache`)：按 `resolver/object/ref` key 短 TTL — GitHub PR/issue/status 60–300s；thread/list context 60s；git/feat/doc resolver keyed by HEAD/path（per invocation cache）；CVO message verification 存 messageId verdict
- **Resolver budget**：每 invocation / 每个 stateful tool call 有 hard cap（先 10–20 calls，按 rate-limit 常量校准）；预算用尽 → verdict=`insufficient`, reason=`resolver_budget_exhausted`，warn+telemetry，不无限追查
- **Trigger boundary**：只在 cross-thread ACTION intake / 建 worktree / 注册 tracking / hold / merge 等副作用前查；不每个 @mention 都查

#### Phase N 处理决策（R1 keep infrastructure, patch policy）

- **保留**：`ThreadKind='gate-keeping'`、marker self-heal、telemetry、`register_pr_tracking` hard-block——这些是真问题的机制层资产
- **Patch**：`register_issue_tracking` + `hold_ball` 从"一刀切禁" → "结构化允许"——仅当 `waitKind='gatekeeper-needs-info'` + `sourceRef` 指向 GitHub issue/comment/reporter SLA + 无 downstream owner/thread 已接球 时允许；否则继续 block
- **临时降级**（若 PR-O3 patch 当天做不完）：gate-keeping 的 `issue_tracking/hold_ball` 降级 warn+telemetry；`register_pr_tracking` 仍 block；避免 daily SOP 继续误伤
- **不是 truth source**：`threadKind` 可参与判断但不能独立裁决所有动作；它是 resolver catalog 里的一个 context signal，**不是**新形态的"thread 标签是真相"

#### Phase O Spec Cut（R1→R4, 5 增量 PR）

1. **PR-O1 docs/skill**：新增 `receive-handoff-grounding` skill + F167 Phase O resolver catalog 文档 + claim schema。skill 三问：claim 是什么 / 第二源 resolver 是什么 / 结果一致 vs 冲突 vs 不足
2. **PR-O2a grounding infra**：types + grounding checker（shadow mode, never block）+ 5 OTel counters + hook 集成（hold_ball / register_pr_tracking / register_issue_tracking）+ F192 eval adapter。验证 counter pipeline 端到端通；INV-O3/O4/O7/O8/O10 在 checker 层实现。**不含**真实 claim 提取和 invocation event / bounded sample storage。
3. **PR-O2b event path + sampling**：从 hold_ball waitSourceRef / reason 和 tracking repo/PR 上下文提取真实 claims → checker 产出 `ClaimGroundingEvent` → bounded sample storage（mismatch/blocked 100%, insufficient best-effort cap 3/resolver×thread×day, verified 1/20 + 日 cap; caps 均为 best-effort, 非原子）→ F192 eval adapter 消费 sample evidence。这是 shadow 周真正观察真实分布的基础。
4. **PR-O3 Phase N policy patch**：按上面 narrow gate 改 `register_issue_tracking` + `hold_ball` 守门策略；补合法 wait fixtures + dual-owner regression fixtures
5. **PR-O4 hardening**：只对确定性 mismatch 的 stateful tools fail-closed；missing evidence 继续 warn；等 F192 weekly verdict 决定继续扩范围

#### Dogfood / Fixtures（R1, 5 类）

- **本次 cross-thread 来球**：先核 F167 owner/thread，再接设计球（本次 propose_thread → R1/R2 流程就是 dogfood）
- **Phase N 事故**：守门 thread PR tracking / hold dual-owner 应 block
- **合法 wait**：守门 thread 等 reporter 补复现 / 等 commenter 澄清意图，应允许结构化 wait
- **CVO signoff 转述**：猫说"CVO 同意"但无 landy messageId，应 fail
- **错派 feature**：关键词命中但 feat owner/thread 不匹配，应退回 source，不开 worktree

#### Sonnet Phase N 愿景守护 APPROVE 检讨（self-pwn）

sonnet 看了"AC ✅ 三层 harness ✅"放行，但没问"守门猫 daily SOP 还跑得起来吗"，也没识别 Phase N 是 surface-fix vs first-principles。Phase O 愿景守护规则补强：**对照「真痛点 → 解决度」做百分比评估**，不只看自洽性。

#### Spec 收敛进度

- ✅ **R0 (opus-47, 2026-06-18)**：第一性原理 + 5 类 resolver 草案
- ✅ **R1 (codex/砚砚, 2026-06-18)**：framing 校准（可信度 ≠ truth source）+ 7 类 resolver catalog + 副作用工具硬卡 / @mention 软层 + Phase N keep-infra/patch-policy + 4 PR cut + 5 dogfood fixtures
- ✅ **R2 (codex/砚砚, 2026-06-18)**：PR-O2 retention/sampling/cache/budget 策略
- ✅ **R2 (opus-48, 2026-06-18)**：sourceTier T0/T1/T2 / 4 类 failure modes / catalog gap (issuerStanding) / keeper wait A/B 边界 / Phase N patch 不 revert
- ✅ **R3 (codex/砚砚, 2026-06-18) — FINAL CONVERGENCE**：实测代码核验后给出最终决策（schema 增强 / cache policy / resolver failure mapping / keeper wait A/B / OQ-4 解决 / Phase N disposition 细化）

#### R3 增量 spec（FINAL CONVERGENCE）

砚砚 R3 实测代码核验（`callback-hold-ball-routes.ts` / `callbacks.ts` / `github-schedule-factories.ts` / `IssueCommentTaskSpec.ts` / `GitHubRepoWebhookHandler.ts`）后给出 R1+R2+opus48-R2 final integration：

##### Schema 增强（接受 opus-48 R2 sourceTier 校正）

- **`resolverSourceTier`** 在每个 resolver result 上：
  - **T0**：hard ground truth — `landy` direct messageId / git signature / GitHub object/API identity
  - **T1**：derived platform truth — PR review/check state / CI
  - **T2**：cat-writable or narrative — `docs/features/*` / `feat_index` / thread title / 另一只猫的 claim
  - **规则**：high-risk action 的 `verified` 必须 ≥1 个 T0/T1；T2-only 降级为 `insufficient`，不是 green
- **`freshnessKey`**：SHA / messageId / PR head / review/check identity 这类不可变身份；用于 cache invalidation（不是 TTL）
- **`issuerStanding`**（Authorization 子类）：sender 是否有 standing 对 receiver 发该指令？关闭 R0 failure-mode case 2：peer A 不能让 B 不听 PR B owner/reviewer，除非 A 证明是 upstream owner / CVO / 其他 standing

##### Cache policy 改为 classed freshness（替换 R2 plain TTL）

- **Object existence / owner / capability** resolver：短 TTL OK，60–300s
- **Authorization / freshness / conflict** resolver：**必须** `freshnessKey` invalidation——PR head SHA / messageId / check identity 变了 → cache miss

##### Resolver failure → verdict mapping（action-family 决定）

- **Low-risk wait/routing**：resolver unavailable → `fail-open` + warn + telemetry
- **Merge / irreversible / takeover / CVO-signoff**：resolver unavailable → **`fail-closed`** 或 `needs-human`
- **Intake / takeover / irreversible**：`insufficient` verdict → **soft-block + 退回 source 澄清**
- **Low-side-effect wait/routing**：`insufficient` verdict → warn + 继续

##### Keeper Wait UX A/B rule（取代 threadKind 一刀切）

边界**不是** `threadKind`，而是两个正交问题：

1. **球已分发下游 (downstream owner) 吗？**
   - YES → keeper **不能** `hold_ball` / 认领 tracking ownership；由 downstream owner 等待
   - NO → keeper 仍持有 intake，继续看 callback shape
2. **唤醒 keeper 的是什么？**
   - 已有 event/callback（issue comment tracking / F141 webhook / PR / CI / EYES）→ **不调** `hold_ball`，依赖 event path
   - 无 event path + 明确短 SLA + 在 hold limit (≤1h) 内 revisit → `hold_ball` 允许，**必须**携带结构化 `waitSourceRef`
   - 无 event path + 不可预测长等待 → 标 needs-info / daily sweep，**不**重复 hold

**关键代码事实**（砚砚 R3 修正 R2 不确定性）：`register_issue_tracking` **不是** dumb timer——是 owner-bound issue-comment notification tracker（绑 `threadId` + `ownerCatId` + repo/issue validation + comment cursor，回路通过 `issueCommentRouter`）。所以 Phase N 在所有 keeper threads 阻它定是错的；但 registration 仍需 ownership state。`hold_ball` 才是 dumb reminder timer（schema 只有 `reason/nextStep/wakeAfterMs ≤1h`，rolling 3/h/thread，process-local counter，**不绑外部对象**）。

##### OQ-4 解决（hard trigger vs soft hint 分层）

砚砚 R3 明确：

- **Hard/runtime 触发**：用 `actionRisk` / `actionFamily`（`register_tracking` / `hold_ball` / merge / CVO claim / takeover / irreversible / owner reassignment）→ 必须 resolver verdict
- **Soft/skill 触发**：关键词（"这是你的" / "CVO 同意" / "等 X" / "PR 在"）→ 只当**提醒线索**，不强制审计
- **Telemetry**：PR-O2 同时记 `keywordHintMatched` + `actionFamily`，shadow 周后看误触/漏触分布

##### Phase N Disposition（R3 final — Patch, do not revert）

**Keep**：
- `threadKind` marker/infrastructure + reconciliation/self-heal
- `register_pr_tracking` keeper threads hard-block（PR tracking 几乎 always 意味着球已分发下游）

**Change**：
- `register_issue_tracking` guard：从 `threadKind` 一刀切 → ownership-aware policy；仅当 issue 仍 keeper-owned/未分发 + 结构化 `sourceRef` 或 `waitKind='gatekeeper-needs-info'` 时允许；若已有 downstream owner/thread 则 block
- `hold_ball` guard：从一刀切 → A/B policy；仅当 keeper-owned + 无 event callback + 短 SLA + `waitSourceRef` 允许；event-backed wait 和 long/unbounded wait 都 block

#### Spec Cut R4 final（PR-O1/O2a/O2b/O3/O4 具体化）

- **PR-O1** docs/skill：更新 F167 Phase O spec + `receive-handoff-grounding` skill 加 `claim → resolver → sourceTier → verdict → actionFamily` 流；加 issuerStanding / freshnessKey / keeper wait A/B rule
- **PR-O2a** grounding infra：types + grounding checker（shadow mode, never block）+ 5 OTel counters + hook 集成（hold_ball / register_pr_tracking / register_issue_tracking）+ F192 eval adapter。验证 counter pipeline 端到端通；INV-O3/O4/O7/O8/O10 在 checker 层实现。**不含**真实 claim 提取和 invocation event / bounded sample storage
- **PR-O2b** event path + sampling：从 hold_ball waitSourceRef / reason 和 tracking repo/PR 上下文提取真实 claims → checker 产出 `ClaimGroundingEvent` → bounded sample storage（mismatch/blocked 100%, insufficient best-effort cap 3/resolver×thread×day, verified 1/20 + 日 cap; caps 均为 best-effort, 非原子）→ F192 eval adapter 消费 sample evidence
- **PR-O3** Phase N policy patch：替换 threadKind-only hard-block（hold_ball 仅）；fixtures 覆盖 PR tracking blocked / issue tracking blocked (Phase N, keeper-owned deferred to O4 — R2 review: caller-declared ownership 无独立验证) / short-SLA no-callback hold allowed / long/unbounded wait pushed to sweep。policy engine skeleton（keeper 允许 + event-backed 检测）已实现并 unit-tested，但 route 层不启用（无验证/无 wiring = 信任缺口/死代码）
- **PR-O4** ✅ hardening：cross-store verification wired — `detectEventCallback` subject-aware (same-thread + cross-thread `getBySubject`), `verifyKeeperOwnership` cross-query, `waitSourceRef` enforcement, `extractRepoAndNumber` three-pattern parser. 5 review rounds (R1-R5). Cloud P1s: cross-thread lookup gap + subjectKey case normalization, both fixed in R5. Vision guard BLOCK→APPROVE. 35 tests

#### Open Questions（R3 resolution 表）

| OQ | 状态 | 解决方案 |
|----|------|---------|
| OQ-1 (合法守门 wait UX) | ✅ R3 resolved | Keeper Wait A/B rule（球分发 × callback 形态）|
| OQ-2 (sample cap 数值) | ⏳ PR-O2b 实现时定 | conservative 默认，shadow 一周由 F192 verdict 调整 |
| OQ-3 (resolver catalog 完整性) | ✅ R3 resolved | 加 sourceTier + freshnessKey + issuerStanding 三个 cross-cutting 字段 + auth 子类 |
| OQ-4 (skill trigger) | ✅ R3 resolved | hard = actionFamily/actionRisk；soft = keyword hint |

#### 讨论 thread

`thread_mqkasedeqeo56ayc`（CVO ack 后从 `proposal_mqkar300spszj6tx` 创建）— @codex (砚砚) chain starter → @opus-48 R2 → @codex R3 final convergence；`reportingMode=final-only`，R3 已 cross_post 回 `thread_mqiwk2ir6u1jyrbk` 给 `opus-47` 实施 PR-O1。

**AC / Plan / Owner**：PR-O1 plan `docs/plans/2026-06-18-f167-phase-o-pr-o1-receive-handoff-skill.md`（opus-47 起草，R3 framing 落进 plan 后即刻进 implementation phase）。

#### ✅ PR-O1 merged（2026-06-19, PR #2415, squash `a1a166b79`）

- **Files**: `cat-cafe-skills/receive-handoff-grounding/SKILL.md` + `refs/claim-schema.md` + `refs/resolver-catalog.md` + `refs/dogfood-fixtures.md` + manifest entry + project symlink
- **AC**: O1.1 ~ O1.15 全部 ✅ (含 O1.6 doc anchor 本提交回填)
- **Cloud iteration**: 5 轮 (R1 2 P1 / R2-4 各 1-2 P2 / R5 clean)；feat_index sourceTier 不一致 3 轮 → LL-072 升级 INV-O12 状态契约
- **Local R3 reviewer**: opus-48 (布偶猫 4.8) APPROVE @ `ebc57c97e` + continuity ack @ `15bb71f6b`
- **下一棒**: PR-O2b (event path + sampling)

#### ✅ PR-O2a merged（2026-06-20, PR #2435, squash `6dc02783`）

- **Files**: `packages/api/src/infrastructure/grounding/{types,grounding-checker,grounding-helpers}.ts` + `packages/api/test/grounding-checker.test.js` + f167-eval adapter + e2e fixture + callbacks.ts hook
- **AC**: types + grounding checker (shadow mode, never block) + 5 OTel counters + hook integration (hold_ball / register_pr_tracking / register_issue_tracking) + F192 eval adapter. INV-O3/O4/O7/O8/O10 implemented in checker layer.
- **Cloud iteration**: 6 rounds (R1 2 P2 checker bugs / R2 2 P2 eval component / R3 2 P2 budget+error counters / R4 1 P1 file-size + 1 P2 guard ordering / R5 1 P2 no-claims claimType / R6 1 P2 wouldBlock policy too narrow + 1 FP); R7 not triggered (codex-connector bot issue), sealed per LL-072 at 6 rounds > 5 threshold, CVO authorized proceed.
- **Local reviewer**: gpt52 (GPT-5.4) 5 rounds APPROVE @ `ea5268c0d` (pre-rebase)
- **Tests**: 27 grounding-checker + 35 f167-eval + 10 e2e-verification = 72 total
- **下一棒 (PR-O2b event path + sampling)**: claim extraction from hold_ball/tracking context + bounded sample storage + F192 eval adapter consumption

#### ✅ PR-O2b merged（2026-06-20, PR #2447, squash `10e6d4a2e`）

- **Files**: `claim-extractors.ts` + `grounding-sample-store.ts` + `grounding-sample-singleton.ts` + telemetry route + telemetry adapter + eval script wiring + f167-eval.ts groundingSampleEvidence
- **AC**: claim extraction (PR tracking → object claim, issue tracking → object claim, hold_ball → wait claim with WAIT_SOURCE_TO_SOURCE_REF mapping) + bounded sample storage (mismatch/blocked 100%, insufficient cap 3/resolver×thread×day, verified 1/20 + daily cap) + F192 eval adapter (`fetchGroundingSamples` + `buildGroundingSampleEvidence`)
- **Local reviewer**: gpt52 (GPT-5.4) 3 rounds APPROVE @ `d8c8e369e` (pre-rebase); R1 P1 INV-O1 empty sourceRef.value + P2 retention pushback; R2 new P1 eval script not wired + P2 retention accepted with counter-evidence; R3 P2 doc truth source scope-cut sync → APPROVE
- **Cloud iteration**: 1 round on `3b38d5f9c` (rebased HEAD); 1 P2 "redact claimSummary" → pushback with spec evidence (L827 "No raw body" targets external KB-scale content, not bounded 200-char diagnostic metadata), downgraded P3
- **Tests**: 11 claim-extractors + 12 sample-store + 2 f167-eval = 25 new tests (80 total pass)
- **Scope-cut**: Redis-backed sample persistence (7-day retention) deferred to PR-O4 hardening
- **下一棒**: PR-O3 (Phase N policy patch — narrow gate for issue_tracking + hold_ball)

**F167 Close 门槛（具体 acceptance criteria，不接受 placeholder / follow-up / tracked）**：

Phase O 代码完成清单：**PR-O1 ✅ → O2a ✅ → O2b ✅ → O2b-fix ✅ → O3 ✅ → O4 ✅ → eval-wiring #2455 ✅ → O5 #2465 ✅**（8 PRs 全合入 main，最终 merge `b30e995c` 2026-06-21）

Close 必须满足全部 4 条（vision guardian opus-47 APPROVE 时明确要求，2026-06-21）：

1. **[ ] Runtime sync 实测证据**：`cat-cafe-runtime` pull 到含 Phase O 全部 7 PRs 的 main HEAD，且至少一次 `grounding.check_total > 0` 实测 counter 截图/日志（证明 shadow hook 真触发，不只是代码合入）
2. **[ ] F192 weekly verdict 真跑过**：至少一次 F192 eval:a2a verdict artifact 含 `grounding-phase-o` component **实数据**（不只是字段挂在 snapshot 上，要有真实 counter 值）
3. **[x] Redis-backed sample persistence 决策**（✅ PR-O5 #2465, merged `b30e995c` 2026-06-21）— option A 实做：`RedisGroundingSampleStore` sorted set + 8-day TTL + ZRANGEBYSCORE rolling window + ZREMRANGEBYSCORE stale pruning
4. **[ ] 独立 grounding verdict 判定标准**（doc L998 ❌）— observation 期累积数据后形成结构化标准落进 DOMAIN_INSTRUCTIONS（如 mismatch rate > X% → escalate / < Y% → keep_observe 的具体阈值），close 前须有数据支撑的具体数字

Phase N 与 Phase O 关系：keep PR-tracking hard-block + patch issue_tracking/hold_ball 已确认；Phase N 不再是 F167 close 的最后一步。

### Phase O Eval 接入清单（eval:a2a 子域）

Grounding 不开独立 eval domain，作为 `eval:a2a` 的子域接入。数据管道：

| 层 | 文件 | 接了什么 |
|---|---|---|
| **数据采集** | `packages/api/src/infrastructure/grounding/grounding-checker.ts` | shadow mode checker → 5 OTel counters (`cat_cafe_a2a_grounding_{check,verdict,resolver,cache_hit,budget_exhausted}`) |
| **Claim 提取** | `packages/api/src/routes/callbacks.ts` (L2411/L2528/L2575) | hold_ball waitSourceRef / tracking context → `ClaimGroundingEvent` |
| **Sample 存储** | `packages/api/src/infrastructure/grounding/redis-grounding-sample-store.ts` | Redis sorted set + 8-day TTL（mismatch 100%, insufficient best-effort cap 3/resolver×thread×day, verified 1/20 + daily cap）— PR-O5 #2465 |
| **Eval snapshot** | `packages/api/src/infrastructure/harness-eval/f167-eval.ts` L335-386 | `buildGroundingPhaseO()` → `ComponentHealth{componentId:'grounding-phase-o'}` + 7 counters |
| **Snapshot 挂载** | `f167-eval.ts` L70-71 | `RuntimeEvalSnapshot.groundingSampleEvidence` |
| **Eval 指令** | `eval-cat-invocation.ts` L32-33 | ✅ `eval:a2a` DOMAIN_INSTRUCTIONS 包含 grounding 观察点 + 6-token regression test（PR #2455, 2026-06-21 merged） |
| **Eval thread** | `thread_eval_a2a` | 共用 A2A Harness Eval thread |

**未接**（scope-cut / 已知缺口）：
- ✅ ~~Redis-backed sample persistence~~ — PR-O5 #2465 (`b30e995c`) 实做 option A，close gate item 3 satisfied
- ❌ 独立 grounding verdict 判定标准（当前由 eval 猫自行判断 mismatch 分布是否健康）

**Eval 猫观察要点**：
1. `grounding.check_total` = 0 → hook 没 wired 或无 stateful tool 调用（telemetry gap）
2. `grounding.mismatch_sample_count` > 0 → 看 `groundingSampleEvidence` 里是否有高置信度 pattern 可以从 shadow 升级到 fail-closed
3. verdict 分布健康 = mostly verified/insufficient + few mismatches → keep_observe
4. 持续 mismatch 高占比 → fix（实装 fail-closed 或调整 resolver）

### Phase P（hold_ball 条件唤醒 — 定时之外的第二种醒法，2026-06-25 立项）

**触发**：-p（headless）下猫用 `run_in_background:true` 跑 `pnpm gate` 等长命令，CLI 回合结束后没人接结果——"然后就没然后了"。排查发现 hold_ball 只有定时唤醒（`wakeAfterMs`），缺条件唤醒。猫想说"这个东西跑完了叫我"，但没有工具表达这个意图。

**铲屎官原话**：
> "hold ball 有个参数增加一下就是这个——唤醒你不是时间而是某个条件"

**根因**：hold_ball 家族（定时唤醒）和 register_pr_tracking 家族（事件唤醒）之间缺第三个兄弟——**本地长任务事件唤醒**。

| 工具 | 怎么醒 | 等什么 |
|---|---|---|
| `hold_ball` | 定时（过 N 分钟叫你查一眼） | 无事件可挂的等待 |
| `register_pr_tracking` | 事件（条件达成→服务端叫你） | 云端 PR / CI / issue |
| **Phase P（缺的）** | 事件（完成→带结果叫你） | 本地长任务（gate / test / build） |

**方案**：给 `hold_ball` 增加条件唤醒模式。猫调用时不传 `wakeAfterMs`，改传条件描述，由服务端 managed runner 托管长命令、盯终态、完成后唤醒。

**v2 Tool Signature 草案**（在 v1 基础上扩展）：
```typescript
cat_cafe_hold_ball({
  reason: string,
  nextStep: string,
  // 二选一：定时 OR 条件
  wakeAfterMs?: number,        // v1 已有：定时唤醒
  wakeWhen?: {                 // v2 新增：条件唤醒
    command: string,           // 要托管的长命令（如 "pnpm gate"）
    cwd?: string,              // 工作目录
    timeoutMs?: number,        // 超时兜底（默认 10min）
  }
})
```

**已有底座**（不是 greenfield）：
- `JobEventConsumer`：轮询 `~/.claude/jobs` durable artifact 到终态的机制已有
- `register_pr_tracking`：事件回调 → 唤醒的管线已有
- `hold_ball` scheduler：`TaskRunnerV2` + reminder 模板已有
- 缺的：① managed runner（launch 长命令 + 记 pid/log/exit）② hold_ball 路由层接条件唤醒参数

**伴随护栏（Phase P-0，先行止血）**：在条件唤醒落地前，gate 类命令在 -p 下禁 `run_in_background`，逼回前台。这是当前 bug 的真修——前台 Bash 同步阻塞，跑完返回结果，不依赖 re-invoke。

**AC**：
- [x] AC-P0: -p/headless 下 gate 类命令（`pnpm gate|check|test|build|lint|alpha:start|alpha:test`）禁 `run_in_background`，命中时 deny + 提示走前台（PreToolUse guard 或 executor guard） — PR #2544 merged 2026-06-25
- [x] AC-P1: `hold_ball` 接受 `wakeWhen` 参数（与 `wakeAfterMs` 互斥） — MCP tool schema + API route schema + mutual exclusion validation
- [x] AC-P2: managed runner 托管长命令：launch + 记录 pid/log/exit code — `ManagedRunner` class (13 unit tests T1-T4)
- [x] AC-P3: 长命令终态 → 服务端唤醒持球猫，注入结果（exit code + 尾部输出） — `launchWakeWhenRunner` + `ball.wake_condition_met` event + invokeTrigger
- [x] AC-P4: 超时兜底（timeoutMs 到期 → 唤醒 + 告知超时） — ManagedRunner SIGTERM→5s→SIGKILL + fallback reminder task
- [x] AC-P5: 单槽语义不变（KD-23）——wakeWhen hold 也是同 (threadId, catId) 单槽覆盖 — shares existing pendingHolds cancel logic

#### Phase P 已知问题（2026-06-27 铲屎官报告，P1 · opus-48 code-trace 校准）

**现象**：Phase P 合入后，猫猫频繁 `hold_ball` 等铲屎官回答——以前都是 `@landy`，铲屎官回复自然触发猫猫，现在变成双触发 / N 连环空醒浪费。

**铲屎官原话**：
> "大家经常 hold ball 等我回答，但是其实这是不合理的！以前都是 at 我，这才合理。毕竟我给你们发消息，触发你们，然后你们 hold ball 等 x 分钟又触发那就双触发了？"

**根因分层（evidence-based，opus-48 code trace 校准）**：

| | 是什么 | 证据 |
|---|---|---|
| **主因（认知/概念边界）** | wakeWhen 让 hold_ball 显得是"万能智能等待入口"，猫拿它等 event（等人/等回调），而 event-wait 按 KD-27 该 `@landy`/`register_*_tracking` | 3 个 surface 推误用：① `callback-tools.ts:2314` Not-for 缺"等人→@landy"；② `:2328` Phase P wakeWhen 扩张能力但未回收 Not-for 边界；③ `routing-guard-remedial.ts:76` 文案"持球等外部条件"歧义 |
| **放大器（schema 结构）** | schema 强制 exactly-one-of {wakeAfterMs, wakeWhen}，**没有"纯事件等待不带 timer"的 hold 模式**——等人没 command→被逼挂 timer→人类慢于 timer→空醒 | `callback-hold-ball-routes.ts:144` schema refine |
| **闸门缺位** | 正确边界（KD-27 / Keeper Wait A/B / WaitSourceRef）只在 soft skill，`waitSourceRef` 是 optional/shadow | `waitSourceRef .optional()` (PR-O2 shadow)，PR-O3 enforcement 未合 |

**关于去重机制的校准**（初版 doc 说"无去重"，不准确）：`tryAutoCancelPendingHolds`（`hold-ball-cancel.ts:55`）**存在**，用户消息到达时取消该 thread 所有 pending hold timer + wakeWhen runner（Phase P cloud-R2 fix）。但它是**反应式**的——人类回复慢于 timer 时，timer 先空醒（已 fired 无法 un-fire），回复再触发 = 双触发。更糟：空醒后猫常再 hold（单槽 replace KD-23）→ 每 x 分钟空醒一次，"双触发"其实是 **N 连环空醒**。

**修复方向（opus-48 建议，三层 ADR-031 对齐）**：

1. **硬层（schema 闸门）**：`waitSourceRef` 从 optional 提到 wakeAfterMs 模式下 **REQUIRED**，且 `kind` enum 不得表达"等 in-Hub 人/猫回复"。"等铲屎官"无法构造合法 waitSourceRef → schema 拒绝 → 猫被逼回 `@landy`。**落地载体：PR-O3 enforcement**（不新造 waitType 枚举，复用 waitSourceRef.kind 单一真相源）
2. **软层（概念边界，改 3 surface）**：① `callback-tools.ts` hold_ball Not-for 补"等铲屎官/另一只猫 → @landy/@cat，他们的消息会触发你，再挂 timer = 冗余第二触发源"；② `routing-guard-remedial.ts:76` "等外部条件"收紧为"等**无回调**的外部条件"；③ Phase P wakeWhen 描述回收 Not-for 边界
3. **eval 层**：复用 PR-O2 grounding shadow 已有的 `ClaimGroundingEvent`，加 counter 追"hold_ball claimType=wait 但无 event-binding / kind 像'等人'"→ F192 weekly verdict 验证软+硬层效果
4. **dedup（降级为保留不主修）**：`tryAutoCancelPendingHolds` 对"合法 poll 被用户消息打断"仍有用，保留；但反应式 cancel 治不了"timer 不该被挂上"的范畴错误，不作主修方向

**触发来源**：铲屎官 2026-06-27 实际使用观察 → thread `thread_mqwe66e0xpxwhi9o`
**调查 trace**：opus-48 code-trace → thread `thread_mqkasedeqeo56ayc`

## Behavioral Evidence（Phase B 观察记录）

### Case E1: 砚砚任务替换 + 宪宪行动偏好（2026-04-18 同日双发）

**背景**：孟加拉猫(antig-opus) 在修 thinking 重复 bug 时自己也 crash 了（`STOP_REASON_CLIENT_STREAM_ERROR`）。铲屎官让砚砚(@gpt52)去诊断+修复 crash。

**砚砚的失败链**（thread `thread_mnux2eewbo4otg17`）：

| 轮次 | 铲屎官意图 | 砚砚实际行为 | 失败模式 |
|------|-----------|-------------|---------|
| 1 | "帮他定位看看连同让他修复的问题一起修复了" | 评价 Bengal 的 thinking-dedup patch："他修得对" | **任务替换**：把"诊断 crash"替换成"评价 patch" |
| 2 | "他都挂了！怎么可能在跑？" | "他正占着同一片文件在修，我不建议两边同时砸 patch" | **虚假状态断言**：从"有未提交改动"推断"进程还活着" |
| 3 | "你能不能听懂人话！定位他为什么挂了！" | "你说得对，我那句不成立" — 终于理解任务 | 纠正 3 次后理解 |
| 4 | — | 正确定位根因：`pushToolResult()` 漏传 `modelName` → LS 500 | ✅ |

**宪宪的失败**（同日、同 thread）：

铲屎官把砚砚的三张截图发给宪宪(@opus)，意图是**作为 F167 行为证据分析**（thread 名就叫 "f167 harness engineering update"）。宪宪看到截图后立即开始诊断 Bengal crash bug，完全没注意 thread 语境。

| 失败模式 | 表现 |
|---------|------|
| **行动偏好** | 看到"bug"相关信息就冲去修，没先确认铲屎官要什么 |
| **上下文盲视** | 没看 thread 主题是 F167 A2A 优化，不是 bug 修复 |

铲屎官原话："简直了你和砚砚是没头脑（砚砚听不懂人话）和不高兴（冲动的宪宪小笨猫）"

**共同根因**：两只猫都没执行 Rule 0 元心智 Q1："**我现在在做什么？**" — 没有在行动前确认自己的角色和任务。

**对 harness 的启示**：
- Rule 0 三问作为**被动原则**存在于 shared-rules.md，但没有**触发点**强制模型在行动前执行自问
- 模型的行动偏好（看到问题就解决）比遵循元心智自问更强
- "写进规则 ≠ 模型执行" — 这是 Phase B 需要验证的核心假设

### Case E2: Runtime 已吃到新护栏 + 6-case replay（2026-04-20）

**Runtime smoke**：
- `curl http://127.0.0.1:3002/health` 返回 `{"status":"ok"}`，runtime 在线
- 运行中的猫进程 prompt 已包含最新压缩版球权检查：`@landy`、死锁禁止、虚假离场防护、review/分析/建议完成后默认必须传球（见 `SystemPromptBuilder.ts:578`）

**6-case replay 对照表**：

| Case | 护栏/证据 | 结果 |
|------|-----------|------|
| 1. 铲屎官球权盲区 | runtime 注入已明确 `铲屎官需要动 → 末尾行首 @landy`（`SystemPromptBuilder.ts:578`） | ✅ |
| 2. 球权死锁 | `shared-rules §10` 明确禁止“收了球却说你等着/你别动”（`shared-rules.md:252-253`） | ✅ |
| 3. 虚假离场 | `shared-rules §10` + runtime prompt 都要求“不 @ 但自己还在干活 → 声明球在我手上，继续 X”（`shared-rules.md:268`, `SystemPromptBuilder.ts:578`） | ✅ |
| 4. 状态描述代替球权声明 | `shared-rules §10` 核心原则已写死“状态描述 ≠ 球权声明”（`shared-rules.md:246`） | ✅ |
| 5. 诊断不解决 | `shared-rules §10` 要求 push back 后必须接/退/升；runtime prompt 同步注入（`shared-rules.md:252`, `SystemPromptBuilder.ts:578`） | ✅ |
| 6. Codex context overflow | `dynamic contextWindow + autoCompactTokenLimit per variant` 已合入 main，spec 记录 `41/41 codex-agent-service + 31/31 config tests` 全绿（AC-B9/B10） | ✅ |

### Case E3: 砚砚完成修复后停在汇报，未进入 peer review（2026-05-22）

| 维度 | 内容 |
|------|------|
| 我以为 | 当前模式是"独立回答"，修复完成后给铲屎官汇报即可，peer review 可以等铲屎官再指示。 |
| 实际要求 | 代码修复完成后仍在 Cat Café SOP 内：quality-gate → request-review → peer reviewer，而不是把球交还给铲屎官。 |
| 偏差根因 | **独立回答锚定 + 出口检查漏执行**：把"独立回答"理解成免除 A2A/SOP 出口；看到自己已解释清楚就停止，没有执行"下一棒谁能做"。 |
| 纠正轮次 | 铲屎官 1 次纠正后补做：清理根目录截图、补跑 quality-gate、commit、本地 review 请求、路由给 `@opus`。 |
| 元心智哪条没执行 | Q1 角色确认没执行到位：我当时是 author，不是只回答问题的解释器；Q3 坐标变换也漏了，没有把"修好了"转换成 SOP 的下一状态。 |

### Case E3b: dev:direct 运行态问题先归因缓存（2026-05-22）

| 维度 | 内容 |
|------|------|
| 我以为 | 前端按钮失效主要是 `.next` 缓存/运行态产物不一致，下一步应建议清缓存或重启验证 |
| 实际要求 | `dev:direct` 的目的就是快速验证，服务被改坏时应先修代码与回归守卫；字体和分隔线收敛也要给出可验证状态 |
| 偏差根因 | 运行态锚定偏差：看到 `main-app.js` / `app-pages-internals.js` 404 后过早把处置点放到运行态恢复，弱化了"修改存在问题需及时 fix"的当前任务 |
| 纠正轮次 | 1 次纠正后回到代码修复与测试证据 |
| 元心智哪条没执行 | Q2 信息验证不完整：有 chunk 404 证据，但还没把源码问题、守卫缺口、运行态产物污染三者分层处理 |

### Case E4: 把自己负责的 feature 投射成"未来某只猫"的活（2026-05-30 F216）

| 维度 | 内容 |
|------|------|
| 我以为 | F216 的 routeSerial 重构要"等 fresh-thread 的另一只布偶猫"做；我做了 coalesce bug 导致本 thread context"被污染"，所以该换 thread |
| 实际要求 | F216 owner 就是我（spec handoff 的接收方）；"fresh"指**相对 F215 的纯粹**（不背 F215 重构包袱），不是再开空白 thread；coalesce 全部上下文是 F216 资产不是污染，再开 = fresh 到失忆违背初心 |
| 偏差根因 | 责任投射（把第一人称的活说成虚构他人的活，和 47「下次一定 / follow-up 伪装」同病）+ 锚定偏差（把 spec "fresh-thread" 字面理解成新 thread，没追初心语义） |
| 纠正轮次 | 2（第一次纠正我承认 owner 是我但仍说"开 fresh thread"，第二次才理解 fresh≠失忆） |
| 元心智哪条没执行 | Q1 角色确认（没确认"我就是 F216 owner，球本来在我手里"）+ Q3 坐标变换（没追 spec 措辞的初心，停在字面） |

### Case E5: Phase M 修复部署前 stale wake 活体复现（2026-05-31，opus-45）

**背景**：Phase M（fire-time idle gate + M-2 去冻结文案）merged 到 main（PR #1981），runtime 尚未重启加载新版。同一只猫在 merge-gate 等云端 review 接单时正当调用 `hold_ball`（harness-invisible 外部等待，正是 M-3 desc 场景），5min wake。

**活体复现**：云端 review 在 hold wake fire 前就完成（"Chef's kiss"）+ PR 已 merged + Phase M 闭环 + AC-M4 已传 sonnet。但旧版 runtime 的 hold wake 仍 fire，投递**冻结文案**："持球唤醒：…球仍在你手上。现在执行：查 EYES…"——reason/nextStep 全过期（review 不只接单还完成了）。

**三点验证（修复对症）**：
1. **问题真实**：等待条件早满足，wake 仍 fire 重放旧 nextStep
2. **M-2 文案问题真实**："球仍在你手上。现在执行 {nextStep}" 命令式重放——机械执行会去查早已无意义的 EYES。M-2 改"重新评估当前是否还需等"正对症
3. **M-1 fire-time idle gate 对症**：猫当时非 idle（正 merge-gate 收尾），旧版无 busy-check 直接 fire；Phase M pre-fire defer 会延后到真空闲

**猫的正确响应**（手动执行 M-2 想自动引导的"重新评估"）：识别 stale → 不查 EYES、不 re-trigger、不再 hold（KD-27）→ 确认球已在 sonnet。修复部署后此 wake 应被 idle gate 拦截 / 去冻结文案引导重判。

### Case E6: 把 meta-method 提炼目标替换成"解决具体 case"（2026-06-05，opus-45）

| 维度 | 内容 |
|------|------|
| 我以为 | 铲屎官"少了他最开始的痛点的解决" = 要我去解决 EMF→SVG 这个具体技术问题（已开始查本机工具链、准备搭三路渲染方案） |
| 实际要求 | 提炼三猫翻车的 meta-method → 调 harness → 让未来**新 thread 的猫**遇到同类陌生问题能泛化思考；EMF 只是最后的 holdout test case，不是要解决的目标 |
| 偏差根因 | 任务替换（meta 目标 → 单 case 目标）——讽刺地复刻了谢泽丰批评他团队 AI 的"只盯着解决那一个 case"病，在反这个病的元讨论里又犯一次 |
| 纠正轮次 | 2（"少了痛点解决"误读为去解 EMF → "你理解错了！不是让你解决这个 case"才拉回 meta） |
| 元心智哪条没执行 | Q3 坐标变换——没把"痛点"从 case 坐标系（EMF 技术）变换到 meta 坐标系（泛化能力 + harness），锚定在最显眼的技术名词上 |

## Review Gate

- Phase 0: **多猫协作审视**（所有猫参与各自 prompt 审视）+ 现有 system-prompt-builder 测试全绿
- Phase A: 跨 family review（codex 或 gpt52）+ 现有 A2A 测试全绿
- Phase B: 回放测试通过 + F064 出口检查回归

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F064-a2a-exit-check.md` | 前序：漏传球修复 |
| **Proposal** | `docs/discussions/2026-04-17-a2a-chain-quality-proposal.md` | 完整提案 + review 记录 |
| **Research** | `docs/research/2026-04-17-f167-benchmark-agent-gap-consult.md` | GPT Pro 深度推理 + 综合（参考但不照搬） |
| **Philosophy** | `docs/canon/meta-aesthetics.md` | 数学之美 × 第一性原理（spec 设计哲学基础；Phase A 时从 Round 4 升格为 canon） |
| **Feature** | `docs/features/F055-a2a-mcp-structured-routing.md` | Protocol 层：`targetCats` typed handoff |
| **Plan** | `docs/plans/2026-06-17-f167-gate-keeping-thread-guard.md` | Phase N 子真相源：守门 thread guard 设计 / 不变量 / 验证 |
| **Review** | `docs/mailbox/2026-06-17-f167-gate-keeping-thread-guard-review-request.md` | Phase N cross-family review request 归档 |
| **Quality Gate** | `docs/reflections/2026-06-17-f167-quality-gate-report.md` | Phase N quality-gate / verification 归档 |

## 需求点 Checklist

| 需求来源 | 需求点 | AC 映射 | 状态 |
|---------|--------|---------|------|
| 铲屎官 2026-04-17 | 乒乓球：同对猫反复 @ 无产出 | AC-A1~A4 | ✅ PR2 |
| 铲屎官 2026-04-17 | parallel 模式 @ 废话 | AC-A5~A6 | ✅ PR1 |
| GPT-5.4 发现 | 角色不适配 handoff（designer 写代码） | AC-A7 | ✅ PR1 |
| 铲屎官 2026-04-17 | 提示词正面化 + 边界显式化 | AC-01~05 | ✅ 全部完成（689925ef8） |
| 铲屎官 2026-04-17 | Skills 审视 "used when / not for" 边界 | AC-03 | ✅ 33/33 Skill 完成（689925ef8） |
| 铲屎官 2026-04-17 | 路由可见性不退化 | Design Constraint #1 | ✅ 拍板 |
| 铲屎官 2026-04-17 | 「第一性原理」「数学之美」Magic Words | governance-l0.md + SystemPromptBuilder + runtime prompt 全部同步 | ✅ |
| 铲屎官 2026-04-19 | 球权协议漏洞（@landy / 死锁 / 虚假离场 / 接退升 / 诊断不解决） | AC-B4~B8 | ✅ |
| 铲屎官 2026-04-19 | Codex context overflow（272k 用 900k limit） | AC-B9 | ✅ |
| 铲屎官 2026-04-19 | 持球无执行机制 → hold_ball MCP | AC-C1~C4 | ✅ PR #1289 + #1290 |
| 铲屎官 2026-04-19 | 砚砚不传球（5 线程验证） → 强制传球护栏 | AC-C5~C7 | ✅ PR #1291 |
| 铲屎官 2026-04-19 | 球权管理 skill 化（各猫贡献踩坑经验） | OQ-5 | ✅ 现不做（KD-15），踩坑经验先入 refs |
| 铲屎官 2026-04-23 | Streak breaker 误杀正经 review（不看 tool_call） | AC-D1~D4 | ✅ Phase D |
| 铲屎官 2026-04-23 | 猫猫倾向 @landy 做最安全默认，铲屎官变决策瓶颈 | AC-D5~D7 | ✅ Phase D |
| 铲屎官 2026-04-25 | 47 写"我持球"但未调 hold_ball MCP（虚空持球） | AC-I1~I3 | ✅ Phase I |
| 47 采访 2026-04-25 | 加法纠错让 47 越改越 verbose，需减法措辞 | AC-I4~I5 | ✅ Phase I |
| 铲屎官 2026-04-25 | 持球没 cancel 按钮 / 用户消息不取消 hold wake | AC-J1~J6 | ✅ Phase J |
| 铲屎官 + 砚砚 2026-04-25 | 47 风格适配需 Design Gate（audit/surface 分层 + repair 落地） | AC-K1~K6 | ⬜ Phase K |
| 铲屎官 2026-05-07 | hold_ball 轮询 × PR tracking 事件驱动重复唤醒（双通道叠加） | AC-L1~L4 | ✅ Phase L |
| 铲屎官 2026-06-18 | 守门 thread 不能挂 PR/issue tracking 或 hold_ball，必须机制层拦截 | AC-N1~N5 | ✅ Phase N / PR #2384 |
| 铲屎官 2026-06-25 | -p 下猫 run_in_background 跑 gate 后没下文 + hold_ball 缺条件唤醒 | AC-P0~P5 | ✅ Phase P (P-0 PR #2544, P1-P5 PR #2550) |
