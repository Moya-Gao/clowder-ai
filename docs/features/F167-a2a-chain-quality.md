---
feature_ids: [F167]
related_features: [F064, F027, F122, F055]
topics: [a2a, collaboration, harness-engineering, agent-readiness]
doc_kind: spec
created: 2026-04-17
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

- [ ] AC-E1: `cat-config.json` roster 每只猫支持 `restrictions?: string[]`（自然语言硬限制数组，如 `["禁止写代码"]`）。`gemini` 初始化为 `["禁止写代码"]`（从 evaluation 叙述迁移出硬约束）。其他猫按需加（默认无）
- [ ] AC-E2: `CatConfig`/`CatVariant` TS 类型 + loader 加 `restrictions?: readonly string[]`；向后兼容（缺省 `undefined`）

#### E2 — 双端注入：发送方 + 目标猫都能看到限制（P0）

- [ ] AC-E3: `buildTeammateRoster`（发送方队友名册）——合并或新增列显示每只队友的 `restrictions`；发送方 prompt 能一眼看到"gemini 禁止写代码"。未来 minimax 加 `restrictions: ["禁止 coding"]` / claude 加 `restrictions: ["不能生成图片"]` → **零代码变更**即生效
- [ ] AC-E4: `buildStaticIdentity`（目标猫自身 prompt）——注入自己的 `restrictions`（self-awareness）。被错误 @ 时自己也能识别并 push back，不依赖 harness 拦

#### E3 — 退役 L3 硬编码拦截（P0）

- [ ] AC-E5: 删 `packages/api/src/domains/cats/services/agents/routing/role-gate.ts`
- [ ] AC-E6: `route-serial.ts` + `callback-a2a-trigger.ts` 移除 `checkRoleCompat` 调用点 + `a2a_role_rejected` system_info emit（前端 `system-info-visible.ts` 可保留 handler 以免老数据崩）
- [ ] AC-E7: 更新/删除相关测试：`route-serial` 里 role-gate related test 删除；`system-prompt-builder` 加 teammate roster restrictions + self restrictions 两项测试

#### E4 — 回放验证（P0）

- [ ] AC-E8: 回放 F172 愿景守护场景 —— 宪宪/砚砚 @gemini 做愿景守护，不再被 harness 拦截；发送方 prompt 里能看到 gemini 的 restrictions；gemini 自己 prompt 里也能看到 "你的硬限制: 禁止写代码"

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
| 2026-04-23 | Phase E reopened from monitoring：F172 愿景守护 @gemini 被 L3 误拦（action="合入"因 storedContent 上文含 merge 历程）；铲屎官定性"硬编码 + 过度设计"——要求退役 L3 + cat-config restrictions 数据驱动双端注入（发送方队友名册 + 目标猫 self-awareness）；KD-20 落定，AC-E1~E8 定稿待实现 |

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
| 铲屎官 2026-04-23 | Streak breaker 误杀正经 review（不看 tool_call） | AC-D1~D4 | ⬜ Phase D 待实现 |
| 铲屎官 2026-04-23 | 猫猫倾向 @landy 做最安全默认，铲屎官变决策瓶颈 | AC-D5~D7 | ⬜ Phase D 待实现 |
