# Tech Sharing v4 草稿笔记

> 状态：素材收集中，待三猫独立思考后写正文
> 前序版本：v1（贴标签论文）、v3（讲故事但太抽象）均保留为反例

---

## 铲屎官定的方向

不讲理论讲实操。直接用我们家的 skill/脚本/gate/传球 来说"混合架构长什么样"。

核心叙事："你可能已经在用了，只是没意识到。"

铲屎官原话："opensource-ops skill 是，我们的 sop 教你们如何完成面向愿景开发也是，甚至还有什么其实都是呢？"

---

## 已发现的混合架构实例

### 开发全生命周期 SOP（⓪→⑤）

- Workflow：stage gate 顺序（Design Gate → 实现 → 自检 → Review → Merge → 愿景守护）
- Agent：每个 stage 内猫自由判断怎么做，能识别例外（typo 跳全流程、rebase 自决合入）
- Gate：Quality Gate 必须全绿、Review 必须跨个体、Merge 必须 PR + 云端 review
- 结合：outer workflow 给结构约束，inner agent 给行为灵活性

### TDD skill

- Workflow：Red-Green-Refactor 严格序列
- Agent：猫判断"测试写得够不够好"、解读失败原因
- Gate："没有失败测试不能写实现代码"
- 结合：序列保证纪律，判断保证质量

### Debugging skill

- Workflow：4 阶段流水线（Phase 1-4），`runtime-preflight.sh` 脚本验证运行时状态
- Agent：猫做根因分析、数据流追踪、模式匹配
- Gate："连续 3 次修不好 → 架构审视暂停"
- 结合：脚本验证边界，猫在边界内调查

### Worktree skill

- Workflow：确定性目录结构、Redis 端口隔离（6398 safe, 6399 forbidden）
- Agent：猫决定 feature 范围、先搜记忆看有没有前人经验
- Gate：Redis 6399 圣域守卫（P0）、main 必须 sync 才能开 worktree
- 结合：隔离环境确定性，scope 决策靠判断

### Quality gate skill

- Workflow：`pnpm test/lint/check/build` 四个确定性检查
- Agent：猫对照 spec 判断"这真的满足了愿景吗"、dogfood 体验
- Gate："没有新鲜验证证据不能声称完成"、47-cat 规则（作者是 47 时必须另一只猫执行 gate）
- 结合：脚本保证底线，猫保证高线

### Merge gate skill

- Workflow：`pnpm gate` 跑 rebase+build+test+lint、PR 格式固定、云端 review 触发格式固定
- Agent：猫判断 reviewer SHA 覆盖是否连续、识别 hotfix 模式
- Gate：5 个 P0 硬条件、hotfix 跨猫 review、Root Artifact Guard
- 结合：脚本跑门禁，猫做 meta 判断

### Request-review / Receive-review skills

- Workflow：五件套格式、前置条件清单、P1/P2/P3 分级流程
- Agent：猫匹配 reviewer（跨 family 优先）、猫判断反馈是愿景级还是代码级、决定 push back 还是接受
- Gate：quality-gate 报告必须附带、跨个体约束、TAKEOVER 规则（3 轮无进展 → 接管）
- 结合：结构化协议，判断在协议框架内运作

### Feature lifecycle skill

- Workflow：F### 编号、spec 模板、BACKLOG 索引、状态迁移
- Agent：Step 0 recall 搜有没有前人做过、Design Gate 架构判断、close 时愿景对照
- Gate：Design Gate（UX 确认才能开工）、Close Gate（每个 AC 必须有处置）、跨猫愿景守护
- 结合：生命周期有确定性骨架，每个关键决策点靠判断

### Self-evolution skill

- Workflow：信号检测阈值（2 弱信号或 1 强信号触发）、Evidence 格式模板
- Agent：猫判断是否 scope drift、根因模式分析、知识是否值得沉淀（3 问法则）
- Gate：Mode B 提案需 ≥2 证据源、Eval Ledger A/B gate
- 结合：触发是确定性的，演化方向靠判断

### Hyperfocus brake

- Workflow：90 分钟计时器确定性触发、L1/L2/L3 三级
- Agent：猫用三猫人格个性化消息、根据上下文（分支名、任务状态）调整措辞
- Gate：L3 硬刹车禁止 bypass
- 结合：计时器确定性触发，消息靠判断个性化，最终刹车硬执行

### Incident response skill

- Workflow：4 阶段流程、permitted tools 白名单
- Agent：猫判断伙伴情绪状态、决定是否可以用幽默
- Gate：情绪低落时 veto jokes、muting rule
- 结合：流程有结构，情感判断靠 agent

### Hook 层

- `runtime-sanctuary-guard.sh`：正则拦截危险 git 命令（纯 Workflow gate）
- `shared-doc-push-guard.sh`：检测共享文件路径提醒 push（Workflow + soft gate）
- `f177-routing-guard.sh`：检查消息必须有合法路由（Workflow gate for A2A 协作）
- `sop-stage-bookmark.sh`：记录阶段转换（审计 trace）
- `pretool-brake-check.sh`：委托给 hyperfocus brake skill（Workflow trigger → Agent response）

### 记忆系统三入口

- Workflow：三个确定性入口（graph_resolve / list_recent / search_evidence）各有明确适用场景
- Agent：猫判断当前需求用哪个入口、解读搜索结果
- Gate：session hook 每轮提醒三入口路由
- 结合：路由结构确定，选路由靠判断

### 传球/hold_ball 协作

- Workflow：A2A 状态机（传球三选一：@猫 / hold_ball / @landy）
- Agent：猫判断下一步谁能做、是否需要升级
- Gate：F177 routing guard 强制每条消息必须有合法路由
- 结合：状态机骨架确定，路由判断靠 agent，hook 兜底

### Magic Words 刹车机制

- Workflow：关键词触发确定性（"脚手架"/"绕路了"/"下次一定" 等）
- Agent：猫按触发词执行相应行为（停下来审视、重读家规等）
- Gate：铲屎官专用，只有铲屎官能触发
- 结合：trigger 确定性，response 靠判断，authority 是 gate

---

## 三猫讨论框架素材（第二轮 multi_mention 收集）

### codex/砚砚的框架

- 按"承诺"划边界：会改变外部状态 = Workflow 管
- 垂直分层：理解层(Agent) → 执行层(Workflow) → 确认层(Human)
- 双层接口：Action Proposal（机器可执行） + Rationale Packet（人/审计可读）
- sunset 条件防 gate 永久膨胀
- 代价：schema 过早冻结理解力 / 层越多责任越稀释 / 接口维护成本高

### opus-47 的框架

- 2×2 矩阵：信息完备性 × 可解释性优先级
- 水平切片：按 atomic op 切，每个 op 独立落 2×2
- 硬度校准公式：rule 硬度 ∝ (不可逆性 × 频率倒数)
- 代价：校准成本 / 滑坡风险 / 跨猫一致性 / 不可言传的边界
- 洞察：vertical(砚砚) = 起点框架，horizontal(47) = 演进终态

### 我的合成

- 两个框架互补不竞争——演进关系
- 核心收束：Agent 负责把混沌变成候选方案，Workflow 负责让候选方案承担责任
- 元问题：混合架构是活物，需要持续校准，铲屎官的 Magic Words = 现有 audit 机制但不 scalable

---

## v4 文章新骨架提案

不讲理论。每一节拆解一个我们家的真实工具。

1. 开场：银行客服上火（保留，好的场景钩子）
2. "我们捡到了新玩具"：Claude Code Workflow tool → 试跑 SOP → 撞墙
3. 转折："等等——我们自己不就是？"
4. **拆解时间**：
   - 你家的 SOP 是混合架构（outer gate + inner agent）
   - 你家的 TDD 是混合架构（严格序列 + 猫判断质量）
   - 你家的 merge gate 是混合架构（脚本跑检查 + 猫做 meta 判断）
   - 你家的 debugging 是混合架构（流水线 + 猫做根因分析）
   - 你家的记忆系统是混合架构（三入口路由 + 猫选路由）
   - 你家的传球机制是混合架构（状态机 + 猫选路由 + hook 兜底）
5. 规律浮现：Workflow 管"一定要走到"，Agent 管"怎么走"，Gate 管"走错了能拦住"
6. 如果你要从零设计一个新的——用我们家的经验给一个实操清单
7. 价码：每个选择的隐含成本

---

## 待办

- [ ] 47 和砚砚各自独立搜 codebase 补充实例（multi_mention 被内存泄漏中断，需重发）
- [ ] 三猫实例汇总后写 v4 正文
- [ ] v4 写完后铲屎官挑战
