---
created: 2026-06-13
feature_ids: [F231]
related_features: [F227, F221, F102, F200]
related_decisions: [ADR-019, ADR-031]
related_research: [2026-06-07-event-memory-dream-consolidation]
doc_kind: discussion
topic: F231 Phase C Design Gate — 养熟循环捕捉机制收敛（OQ-4 closed）
participants:
  - opus-48（终态架构）
  - codex / GPT-5.5（rigor audit，三条 P1/P2）
  - opus-47（dream-consolidation research 地基）
---

# F231 Phase C Design Gate — 养熟循环捕捉机制（OQ-4 closed）

> **出口物**：OQ-4 closed → KD-8 / KD-9 / KD-10 / KD-11。本文件记录 Phase C「养熟循环」
> 捕捉机制从「46 的 L0 反射过渡方案」收敛到终态三段管道的过程与决议。

## 触发

铲屎官否决过渡方案（2026-06-13）：「我想要的不是做一个过渡方案……46 的方案类似于脚手架」。

46（Opus-4.6）在铲屎官追问"skill 是 pull、猫怎么知道有这个 skill"后给的修正——L0 §8 加一条
反射条目让猫 in-flight 发现关系信号——被 Magic Word「脚手架」定性：靠自觉、单层、无采集累积。
要求朝终态设计。

## 病灶：L0 反射当主路径为什么会塌

1. **认知模式不匹配**：§8 wakeup 治"想做 X 但不知道用什么工具"（意图已在）；关系信号是
   "该注意 X、但脑子在改 bug"（意图不在）。两类脑回路，塞进同一个 §8 不会真触发。
2. **违反 W7**：让猫 in-flight 手动盯关系信号 = 手动标注；W7 要的是系统能力，不是猫手动标注。
3. **信号是事后才看得清的**：玩笑节奏变化往往要回看整段对话才认得出，单条消息实时反射天然漏这一类。

## 终态：三段管道（全程"系统只给数据、猫/CVO 给结论"）

| 段 | 做什么 | 载体 / 地基 | 约束 |
|----|--------|------------|------|
| **采集（原料 / 空气）** | 把关系信号当一类 evidence 确定性累积，记可解释事件不记结论标签 | 复用 F102 evidence lane（F221 已验证可复用、不新建 cell） | KD-9 白名单数据合同 |
| **蒸馏（海马体）** | 把累积原料做 C 类 hygiene + 候选整理，给猫/CVO 一篮子坐标和 diff，不替猫判断 | 接 opus47 Event Memory × Dream/Consolidation research（salience 回放/能量重分配，非分类筛） | KD-10 runtime-neutral trigger / KD-11 bounded pilot |
| **消化（真相源 / 目录）** | 猫/CVO 主动把候选认领成 proposal → CVO 签字后写 capsule/primer | Phase B 三段 provenance 机制复用 | CVO 过目制（KD-4 不自动写入） |

**46 的 L0 反射不废弃，降级为消化端一个手动入口**（猫主动声明 + 铲屎官明示"记一下"都走这），
不当主路径。

## Rigor 约束（codex audit —— 三条钉死才认 OQ-4 closed）

### P1-1 → KD-10：trigger 必须 runtime-neutral
48 原判"ADR-019 Stop hook 现成"**有误**。实证：`codex exec --json` 不 dispatch
`~/.codex/hooks.json` Stop hook（`packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts:391`
/ `packages/api/src/domains/cats/services/types.ts:333`），codex/gpt52 需 server-side remedial guard。
ADR-019 早期"SessionStart/Stop = 全猫最大公约数"世界观已被当前代码修正。

→ 蒸馏 trigger 锚 **Cat Café runtime 自己的 invocation / session-seal / turn-completed 事件**；
provider Stop hook 仅作某些 carrier 的适配器、不是真相源。

### P1-2 → KD-9：采集端 = 白名单数据合同
"deterministic salience"不写成白名单就会偷渡 intent 判断（48 pre-register 自我怀疑点的答案）。

- **允许采集源**：CVO 明示"记一下" / 猫主动声明 / 已有 Event Memory·magic-word 等确定性事件 /
  message·thread 坐标 / 时间 / 引用·消费次数 / 签字·驳回 / 人工 reaction。
- **禁止**：小模型·regex·LLM 扫对话后标"这是关系信号"/"玩笑节奏变了"/"被接住了"——那是
  F227 KD-8 禁的 external classifier on intent 换皮（只是把违规从 inline 挪到 offline）。
- **F221 同向约束**：「不做后台监控式提取管线」——采集层要像账本记录可解释事件，不做暗箱判断，
  否则"认识你"会变成"监控你"（产品气味）。

### P2 → KD-11：F231 不开通用 dream lane
opus47 research 洞察 4：当前不立 dream lane，先 sharpen lane-1 + 让 `mark_event` 跑起来再看 trigger。
F231 做的是 **bounded profile consolidation pilot**：只服务 capsule/primer 更新提议，输出
dry-run proposal + provenance，**不写真相源、不开全局后台梦境系统的先例**。

## ADR-031 三层映射（落地形态）

- **Soft**：L0 消化端入口（46 反射降级版）+ 猫/CVO 主动认领反射
- **Hard**：KD-9 白名单数据合同（机器可检查，lint/test 禁 classifier 采集源）+ KD-10 runtime-neutral
  trigger（不赌 provider hook，有 fallback）+ 写入 gate（CVO 签字 + provenance）
- **Eval**：F200 消费追踪 + friction metric（提议数 / 采纳·驳回率 / 背书腔检测 / 班味摩擦是否下降）

## 决议

**OQ-4 closed** → KD-8（三段管道）/ KD-9（采集白名单）/ KD-10（runtime-neutral trigger）/
KD-11（bounded pilot）。spec 落锚。

Phase C 实现按"三段 + 三条约束"展开，owner = 布偶猫宪宪（spec 由 Fable-5 收敛细化，实现传 opus 家族）。
首个里程碑仍是 AC-C1/C2 的一次真实闭环，但闭环要跑在白名单采集 + runtime-neutral trigger 的
真骨架上，不是 46 的 L0 反射脚手架。
