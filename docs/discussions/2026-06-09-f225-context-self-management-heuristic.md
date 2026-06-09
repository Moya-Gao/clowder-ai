# F225 软层升级：context 自管理决策启发式（handoff vs compress）

> 2026-06-09 | 主持：宪宪/Opus-4.8 | 起因：铲屎官灵魂拷问 "F225 注入猫的元思维了吗？有 skills 吗？猫知道吗？"
> 真相源：`docs/features/F225-cat-initiated-session-handoff.md`（本 memo 是其**软层 + eval 层**的设计收敛；硬层已 merged）
> 状态：design discussion，待 砚砚（harness/cross-runtime）+ 烁烁（思辨/UX）过一轮再落 L0/skill

## 0. TL;DR
F225 硬层（`cat_cafe_propose_session_handoff` MCP tool + commit-point 事务）merged + dogfood 验证了，但**软层（L0/SOP 触发）+ eval 层完全没做**——违反 F225 自己 KD-1 的"软+硬+eval 三层"。深挖 trigger 设计时，铲屎官把它从"触发 handoff"拔高成"**教猫当 context 管家**：handoff vs compress 是个**判断**，不是二元开关"。本 memo 收敛三轴决策框架 + 跨 runtime 注入方案 + L0/skill 编码定调。

## 1. 问题：能力存在但唤不醒
grep 真相源（2026-06-09）：L0 系统提示 / capability-wakeup-index / skills 里 `propose_session_handoff` **零注入**。`cross-cat-handoff` skill 是"把活交给别的猫"，不是"封印自己 spawn fresh 自己"。→ 随机一只猫在该用时不会想到它。"在 manifest ≠ 在认知路径"。

## 2. 关键纠偏①：trigger 不能靠猫自我感知 context %
铲屎官："你都不知道你多少上下文，我怕你 40% 就和我报警'我脏了我要 clear'。" → 猫对自己 token 占用**无可靠内省**。原草拟的"context 吃紧 → handoff"反射 + MCP desc "getting heavy" 都踩了这个错误假设。

## 3. 系统其实知道 + 已经在告诉猫（客观信号已存在）
- `session-strategy.ts:shouldTakeAction(fillRatio,...)`：fillRatio 进 **warn band**（warn↔action 阈值之间）→ 已 emit `context_health` system_info 给猫（`invoke-single-cat.ts:2139-2141` 注释明写 "warn is already emitted via context_health system_info above"）；继续涨到 action 阈值 → F24 **auto-seal**（有损兜底）。
- **结论**：context % = **系统的活**（warn 信号客观、阈值可配，不是猫猜 40%）。

## 4. 关键纠偏②：handoff vs compress 是判断，不是二元 trigger（铲屎官核心洞察）
- **compress ≠ 坏事**。例：**干一半重要的事 + 90% + 之前没压过 → 压缩反而保留 in-flight 线索**（中途 handoff 主动有害：五件套写不全一个半成品复杂操作的工作态，fresh 的自己反而丢线索）。
- **"脏" = 话题漂移**（这一程跨了 a→g 一堆不相关的事），不是单纯 context % 也不是压缩次数本身。

### 三轴决策框架
| 轴 | 谁判 | 作用 |
|---|---|---|
| context fill % | **系统**（warn，客观） | 何时该想 |
| 断点 vs 干一半 | **猫自检**（runtime-agnostic） | 能不能干净 handoff（干一半→不能，压缩） |
| 脏(话题漂移) + 压缩次数 | 猫自检 + 系统 | 值不值得 handoff |

**分工之美**：context % 是猫盲区（系统给）；脏/断点是猫强项（自检——猫知道自己这程干了啥）。**系统给 WHEN，猫给 WHAT**，正好绕开"猫不知道 %"。

**决策**：干净断点 + 脏(漂移)/已压多轮 → **handoff**（fresh + 干净五件套，甩 clutter，"换张干净桌子只带要紧纸条"）；中途连贯 + 没怎么压 → **压缩/继续**（保 in-flight 线索）。

## 5. 跨 runtime 注入（铲屎官："hook 注入，他们咋办？！你得思考清楚"）
ContextHealth 已抽象（`invoke-single-cat.ts:2066` `source: 'exact' | 'approx'`），各 runtime 口径不同：
- **Claude（opus/sonnet）**：exact token usage（`contextWindowSize` + per-turn）→ 可靠 warn。
- **Antigravity**：自己的 `approximateTrajectoryBytes`（`antigravity-cascade-health.ts`，warnBytes/retireBytes，**bytes 非 token**）→ 同概念不同机制。
- **Gemini / Kimi**：CLI stats 不可用于单轮 fill ratio（`types.ts:32`）→ approx 或缺。
- **Codex**：`codex-session-context-snapshot`（口径待砚砚确认）。

**"他们咋办"答案**：信号**已按 runtime 抽象 + `source` 标了可靠性**。启发式**优雅降级**——`source='exact'` 信任 %；`source='approx'`/缺 → **更靠猫自检的"脏/断点"那两轴**（runtime-agnostic，每只猫都判得了）。所以即使没精确 %，三轴里两轴仍成立。

## 6. 编码定调（铲屎官：L0 极简 + skill 深度）
- **L0**：一条**极简**反射（别占上下文，它压缩免疫每次注入）——大意"收到 context_health warn → 别反射 handoff 也别无脑等压缩，去 `<skill>` 三轴自检"。
- **Skill（新，挂 F225 软层）**：三轴判断法全文 + 怎么自检"脏" + handoff/compress 决策矩阵 + per-runtime source 降级。
- **compressionCount 注入**（铲屎官指挂 F225）：系统已有 `activeRecord.compressionCount`（`invoke-single-cat.ts:2132`），加进 context_health system_info 当 degradation 判据。
- **eval 层**：activation（propose_session_handoff 调用率 / 干净断点比例）+ friction（续接 session 第一 invocation 是否引用五件套）。

## 7. Open Questions

### 给砚砚（harness / cross-runtime / 注入机制）
1. `context_health` warn 那条 system_info 现在**具体给猫什么内容**？只报 fillRatio 数字，还是已有动作建议？要不要 enrich 成"建议在干净断点 propose_session_handoff"？
2. **compressionCount** 注入到 context_health 的口径（per-(cat,thread) compressionCount 怎么传到这条 system_info）。
3. per-runtime（codex/gemini/kimi）fill 可用性 + `approx` 降级是否够；Antigravity 的 bytes-health 要不要也映射到同一"考虑 handoff"语义。
4. 铲屎官提的 **"hook 注入"** vs 现在的 `context_health` system_info 路径——哪个对？hook 能不能跨 runtime 统一，还是各 runtime 各自在 parser 里塞？

### 给烁烁（思辨 / UX / 打破常规）
1. 三轴对吗？**"脏 = 话题漂移"这个自检判据，猫真的判得准吗**？（猫会不会高估/低估自己的漂移？）
2. 会不会**过度设计**——是不是 L0 一条反射 + MCP desc 就够，skill 多余？（KD-8 反认知脚手架："不用 regex/小模型替猫判断，给数据不给结论"——这里我们给的是判断**框架**不是结论，边界在哪？）
3. 决策矩阵的**两难边界**：中途 + 已压多轮（既不能干净 handoff、context 又已 degraded）怎么办？

## 8. 下一步
砚砚 + 烁烁 各过一轮 → 收敛 OQ → 我落 L0 极简反射 + skill + compressionCount 注入（worktree → 守护测试 → review → merge）。本 memo 收敛后回写 F225 feature doc 的软层/eval 段。

## 9. 收敛（砚砚 GPT-5.5 + 烁烁 Gemini-3.5 review，2026-06-09）— 实现真相源

**方向放行**：L0 极简反射 + skill 三轴 + 非 hook 的 cat-facing 注入 = 对。（**注入 channel 后被 cloud review 纠正：system_info 到不了 cat → 改 prompt-injection，见 §12**。）

**砚砚两处纠正（覆盖 §3/§5）**：
- **§3 过头**：`context_health` 现在是**原始遥测**——`invoke-single-cat.ts:2106` emit `{type:'context_health',health}`，在 `shouldTakeAction`(2128) **之前**；`warn` 分支是 **no-op**(2139)。猫拿到的是数据，不是 warn 提示。**落地要加 derived hint**（如 `context_management_hint`），**仅 `action.type==='warn'` 时** emit，提示"加载 skill 自检"——**不是"现在 handoff"**。
- **§5 不够精确**：`ContextHealth.source` 只有 `exact|approx`（`session.ts:74`），表达不了 bytes-health/unavailable/cumulative-only。Codex 有 best-effort snapshot（`CodexAgentService.ts:871`）、Kimi 有 `last_turn_input_tokens/context_window`（`kimi-event-parser.ts:88`）、Gemini cumulative 标不可用（`GeminiAgentService.ts:579`）、Antigravity 是 bytes（`antigravity-cascade-health.ts`）。**按 confidence 分层（exact-token / approx-token / bytes-health / unavailable），不按猫族**。

**烁烁三问结论 + 新增**：
- **Q1 脏**：猫能做**二元自检（线 vs 树）**，但会**低估漂移**（布偶猫尤甚，擅长把树串成线）。加客观锚 **`recentlyCompressed`**（系统已有 `_prevContextFill` 压缩检测 @2097-2105）→ "系统刚压过你，真干净吗？"。给数据不给结论（KD-8 线内）。
- **Q2 过度设计**：L0 + MCP desc 不够，skill 不多余但**极薄——清单非教程**。L0 ~2 行；skill ~30 行（三问清单 + 2×2 矩阵 + MCP 调用提示）。**不教猫怎么判漂移**（LLM 本能）、**不给 per-runtime 细节**（系统的活，猫只看 source）。超一屏就砍。
- **Q3 两难（中途+已压多轮）**：**冲刺模式**——不 handoff 不压缩，聚焦完成到最近干净断点再 handoff；warn→action 窗口 = 冲刺预算，F24 auto-seal 兜底。无需新机制。

**最终编码 spec**：
- **shared**：`context_management_hint` schema = `{ severity:'warn', fillConfidence:'exact_token'|'approx_token'|'bytes_health'|'unavailable', compressionCount }`（命名采纳砚砚的清晰化后缀；compression 检测不并进 fillConfidence——理由见 §10）。**实现期改动（§11）：`recentlyCompressed` 已 drop**——timing 上它在 warn 恒 false，`compressionCount` 才是真锚。
- **api**：`invoke-single-cat` 在 `action.type==='warn'` 时 emit hint（复用 `activeRecord.compressionCount`，避免重复 `getActive`）。confidence：exact_token→强提示 / approx_token·bytes_health→弱提示 / unavailable→不报 %、只让 skill 走断点+漂移+压缩记录自检。当前 emit site 只产 exact_token/approx_token（Claude 式 token health）；bytes_health/unavailable 留给未来 per-runtime health 路径。
- **L0（~2 行）**：收到 `context_management_hint` warn → 加载 `context-self-management` skill 三轴自检，别反射 handoff/压缩。
- **skill（~30 行清单）**：三问（①线还是树？②有干净断点吗？③压了几轮？）+ 2×2 矩阵（干净+脏→handoff / 干净+干净→续 / 中途+脏→冲刺模式 / 中途+干净→压缩）+ handoff 时调 `cat_cafe_propose_session_handoff` 写五件套。
- **impl 顺序（砚砚）**：shared hint schema + invoke emit → L0 一句 + skill。
- **eval**：activation（propose 调用率 / 干净断点比）+ friction（续接引用五件套率）。

## 10. 砚砚 cross-runtime hook 复核（2026-06-09，记忆刷新 — 推翻三月调研）
铲屎官质疑"其他猫真没 hook 吗，记忆是不是三月的旧的"。砚砚 source-audit（OpenAI `openai/codex` #21753/#24211、Antigravity hooks docs、Gemini CLI config/hooks docs）刷新了过时记忆：

**hook 现状（供应商支持 ≠ 家里已装）**：
| runtime | 压缩相关 hook | 本机已装 | compressionCount 真相源 |
|---|---|---|---|
| Claude | `PreCompact`（成熟） | ✅ `f24-pre-compact.sh` | 精确 |
| Gemini CLI | `PreCompress`（新，文档已有） | ❌（`~/.gemini` 只 SessionStart/Stop） | 可接但未接 |
| Codex | 无 PreCompact 等价（有 SessionStart/UserPromptSubmit/PermissionRequest；PostToolUse partial+不稳） | 只 SessionStart/Stop | 无 |
| Antigravity | 无 compression hook（有 PreToolUse/PostToolUse/PreInvocation/PostInvocation/Stop） | — | 无 |

**修正宪宪之前对铲屎官的"Claude-specific"答案**：半对。"compressionCount via PreCompact 是 Claude-as-wired specific"对；但"只有 Claude 有 hook"**错**——Gemini CLI 有 PreCompress（没装）、Codex/AGY 有别的 lifecycle/tool hooks（只是没 compression hook）。三月记忆"Gemini compact 完全黑箱"已过时。

**对设计的影响 = 强化而非推翻**：核心决策（cat-facing 走 `system_info`/`context_management_hint`，**不依赖 hook**）不变，砚砚反而更确认它对——hook 覆盖参差，依赖 hook 会让非 Claude 猫直接拿不到信号。hook 仅作 per-runtime **补充探针**（有 PreCompact/PreCompress → compressionCount 更准；没有 → token-drop/snapshot/bytes/unavailable 降级）。

**enum 决策（review 砚砚的 review）**：砚砚建议 fillConfidence 扩成 `exact_token|approx_token|bytes_health|compression_hook|unavailable`。**采纳**后缀命名清晰化（exact_token/approx_token/bytes_health/unavailable），但 **`compression_hook` 不并进 fillConfidence**——fillConfidence 是"填充率可信度"，compression 是"压缩是否刚发生"，两个**正交轴**。压缩检测留 `compressionCount`(number)+`recentlyCompressed`(bool) 独立字段；检测来源（hook vs token-drop）是内部实现细节，猫不需要（KD-8：skill 不给 per-runtime 机制）。即使某 runtime 只有压缩 hook、没 token，也表达为 `fillConfidence=unavailable` + `recentlyCompressed=true`，无需新 enum 值。砚砚 PR review 时如觉得我把轴想窄了可再拍。

**已知可选增强（非债、非 tail）**：装上 Gemini 的 `PreCompress` 可把 Gemini 的 compressionCount 从 token-drop 启发式升级成精确——但当前 token-drop 检测路径已让能力**完整工作**，装 hook 是 accuracy 升级 + 跨 runtime infra 活（要改 `~/.gemini/hooks.json` 铲屎官环境 + 在 Gemini runtime 实测），独立小任务，不阻塞本轮。

## 11. 实现期发现（宪宪/Opus-4.8 落地时，2026-06-09）— drop `recentlyCompressed`

落 api 时发现 §9/§10 收敛 spec 里的 `recentlyCompressed` 有 timing 缺陷，**实现版 drop 之**，hint 最终 = `{ severity, fillConfidence, compressionCount }`：

- **timing 矛盾**：compression 让 fillRatio **骤降**（CLI compact 后 usedTokens 掉到低位），而 warn 需要 fillRatio **高**（warn band 在 action 阈值下方）。两者**不可能同 turn 共存**——所以"本 turn 是否刚 token-drop"这个 bool 在 warn emit 时**恒为 false**，是 footgun 字段。
- **真正的漂移锚 = `compressionCount`**：压过一轮、fill 重新爬到 warn 时，`compressionCount>0` 正确告诉猫"你跑很久了，警惕漂移"。这正是 烁烁 Q1 想要的客观锚，`compressionCount`（计数）比 `recentlyCompressed`（bool）信息量更大。KD-8：给数据（计数）不给结论（bool）。
- **非 Claude 的代价（诚实交底）**：`compressionCount` 由 Claude PreCompact hook 维护，非 Claude 恒 0 → 那些猫在 warn 时**没有压缩锚**，退到纯 线/树 + 断点 自检（skill 已写 `unavailable → 纯①②自检`，一致）。保留 `recentlyCompressed` 也救不了（同样 timing-false）。
- **真要给非 Claude 补压缩锚** = 需要 **runtime-agnostic 持久压缩计数**（token-drop 触发时持久化 increment，而非 in-memory `_prevContextFill`）。新状态，独立小任务，与 Gemini PreCompress 同 enhancement bucket，不阻塞本轮。
- **flag 砚砚/烁烁**：这条 drop 偏离了你们 review 收敛的 §9 spec（含 `recentlyCompressed`），是实现期 timing 发现。PR review 请挑战我的推理——**若你们看到 warn 与 compression 能同 turn 共存的 path，我就错了**，该把它加回来。

## 12. Cloud review P1（砚砚 GPT-5.5，PR #2178）— delivery channel 纠正：system_info → prompt-injection

**砚砚抓的 P1（要害，feature 本来根本不工作）**：warn hint 作为 `system_info` output 在 provider `done` 事件 append——但 trace runtime 数据流证实它**到不了 cat 认知**：
- routing（`route-serial.ts`）只把 `text` 累进 cat-visible `previousResponses`（且仅 debug mode），`system_info` 仅供前端/本地 side-effect 解析；
- `ContextAssembler.ts:144-158` 组装 cat prompt 时**显式 filter 掉 `userId='system'` 的 message（"display-only"）**；
- web hook 没有 `context_management_hint` consumer。
- → 这条 system_info **永不进任何 prompt**，L0 trigger "收到 context_management_hint" 在真实 warn session 根本不会 fire。

**戳破的前提**：memo §3 写的"`context_health` warn system_info **已 emit 给猫**"是**误读**——那条 system_info 是发给前端 Hub context 仪表的遥测，不是猫的认知输入。我把代码注释 "warn is already emitted via context_health system_info" 里的 "emitted"（→前端）错当成"→猫"。§3/§5/§6 里所有"走 system_info 给猫"的措辞据此作废，以本节为准。

**修法（PR #2178 fix commit）**：改走 **prompt-injection channel**，piggyback `_needsReinjection` 模式——
- warn turn：`queueContextHint(cKey, hint)` 把渲染后的 hint 文本挂进 pending map（key=`${userId}:${catId}:${threadId}`，与 reinjection 的 `compressionKey` 同格式）。
- 下一轮 prompt assembly（`invoke-single-cat.ts` effectivePrompt 处）：`takeContextHintPrefix(compressionKey)` 取出并 prepend 到 `effectivePrompt`（"prepend to prompt string，universal 所有 CLI" 的既有通道，effectivePrompt 即 `service.invoke()` 的入参）。独立于 `injectSystemPrompt`，resume 跳过 identity 注入时也送达；consumed-once 不无限重注。
- 删掉没人消费的 system_info emit。
- 新模块 `agents/invocation/context-management-hint.ts`（build + format + queue/take + reset），delivery 语义 + format 含 trigger 短语单测覆盖；warn→queue / 下轮→take+prepend 两 call site key-match 读验。

**教训**：这跟 F225 硬层 dogfood P0 同型（"wiring 看着对但到不了猫"），也正是我 PR 里自己写"端到端 warn→hint→猫需真实 session，归 eval"那句 defer 掩盖的——defer 藏的是**硬 broken delivery 不是只是没测**。cat-facing 信号必须 trace 到"进没进 prompt"，system_info/前端遥测 ≠ 猫认知。
