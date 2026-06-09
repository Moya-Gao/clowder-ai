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
