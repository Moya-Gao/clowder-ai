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

## opus-47 补漏（五层全景）

> 47 的核心发现：**我只碰了 L1 skill 层，其他四层全空白。**
> 最尖锐的叙事："你不是用 hybrid 写代码，你是踩在 5 层 hybrid 上才能写代码。"

### A. 遗漏的 Skills（铲屎官点名的 + 高价值的）

1. **opensource-ops** — 铲屎官原话点名"是"的 skill，v4 草稿漏了！双仓边界 + 6 场景路由 + 递阶权限 + Intake Intent Issue + Ledger + Brand Guard。最复杂的多阶段 gate 系统。
2. **expert-panel** — 多猫专家编排：Dispatch → Independent（禁止互看锚定）→ Synthesis（保留分歧）→ Contributor Check → Delivery。
3. **deep-research** — 三路调研合成：Mode A（Web + Coder + GPT 三角验证）/ Mode B（自包含 prompt → 转发 → 回填）。
4. **schedule-tasks** — 4 步对话式注册 + 唤醒后完整 invocation + 一次性任务自动退役。
5. **ppt-forge / video-forge** — 多模态生产线 + 视觉审查 6 件套。
6. 其他：collaborative-thinking / cross-cat-handoff / cross-thread-sync / knowledge-engineering / writing-plans / tech-writing / guide-authoring

### B. Scripts 层（我完全没碰）

1. **intake-from-opensource.sh** — 社区 PR 吸收 3 类决策 + Brand Guard 单一真相源 + plan-then-record 两阶段
2. **publish-sync-tag.sh** — sync PR merge 后发同名 tag 到双仓 + provenance.json 三角映证 + 失败自动回滚 + 幂等检查
3. **check-hotfix-pattern.mjs** — auto-label 三层鉴权（关键词 + 文件数 ≤1 + 行数 ≤50）
4. **check-fallback-layers.mjs** — diff 扫 fallback 增长 → 单文件 ≥3 → 触发坐标系自检（缅因猫家族治病）
5. **compile-system-prompt-l0.test.mjs** — per-cat L0 编译全量检查 + token 不超 5500

### C. Hooks 对偶设计（我漏了 2 对）

1. **pretool-evidence-guard + posttool-evidence-marker** — "agent 想跳过调查直接改代码 → 系统强制 ask"的对抗设计。PostTool 在 Read/Grep 后写 marker，PreTool 在 Edit/Write 前 check marker < 15min。
2. **f24-pre-compact + f24-post-compact-bootstrap** — Anthropic 压缩掉的 context，用 hook 对偶再 inject 回去。PreCompact seal session + 写 state；SessionStart 读 state + fetch digest + 注入 skill 续载指令。

### D. MCP Server 代码层（我完全空白）

1. **hold_ball rate limit** — 3 持球/小时 per (threadId, catId) + 超限 429 强制 @ 别人
2. **multi_mention 先搜后问 enforcement** — tool schema 强制 searchEvidenceRefs OR overrideReason 二选一。家规编码进 tool contract，不靠 prompt。
3. **search_evidence consumption-weighted ranking (F200)** — 按猫之前消费过哪些结果重排
4. **scheduled task draft-before-confirm** — preview 不持久化，register 才落库。强制 dry-run。
5. **rich block 双路 fallback** — Route A(callback) + Route B(fallback)，单点失败自动降级
6. **distillation nominate → approve loop** — mark_generalizable → nominate（自动 deidentify）→ human UI review。知识升 global 必须 human gate。
7. **final-routing-slot.ts** — 非行首 @ 纯机械拒绝，不走 LLM
8. **CollaborationContinuityCapsule** — token >80% sealer 触发 → capsule → next invocation 前置 continuation prompt

### E. 文档层（我完全空白）

1. **SOP.md 例外路径** — 行 98 跳云端 review 3 条件 / 行 105 极微改动直接 main 4 条件 / 行 88 Trivial 跳⓪。条件没完全量化（"纯文档"模糊）= hybrid 的漏点也是特征
2. **LL-048 持久化规则** — DEFAULT_TTL=0 硬铁律 + recoverThreadFromMessages 自愈 + 非零 TTL 需 P0 审批
3. **ADR-019 Hook 分层** — 用户级 vs 项目级，"行为一致性 > 自动化" = 反 hybrid 的有意识选择
4. **Cat-Dossier (F208)** — 6 字段结构化队友画像 + provenance anchor → 复杂传球前必读
5. **Meta-Aesthetics §3.2 小模型路由** — 4 条件可机械校验 + 安全区边界会漂移需 agent 判断

### 47 推荐的 3 个最有故事性的深挖点

1. **opensource-ops** — 铲屎官点名，必须补
2. **evidence guard 对偶** — "agent 想偷懒 → 系统强制问"，比抽象讲 hybrid 强 10 倍
3. **MCP 先搜后问 enforcement** — 家规编码进 tool schema，不靠 prompt

---

## 更新后的文章骨架提案（v4.1）

47 的 "5 层 hybrid" 全景叙事太好了——不是只有 skill 层是混合架构，整个技术栈从上到下 5 层全是。

1. 开场：银行客服上火
2. 新玩具 → 撞墙 → "我们自己不就是？"
3. **五层拆解**：
   - L0 system prompt 编译（per-cat 模板注入）
   - L1 skills（SOP/TDD/opensource-ops/merge-gate...）
   - L2 hooks（evidence guard 对偶 / compact 续命对偶）
   - L3 scripts（sync 流水线 / hotfix 鉴权 / fallback 检测）
   - L4 MCP server（先搜后问 / hold_ball rate limit / consumption-weighted ranking）
   - L5 文档（SOP 例外路径 / LL 持久化 / ADR hook 分层）
4. 规律："你不是用 hybrid 写代码，你是踩在 5 层 hybrid 上才能写代码"
5. 三个故事深挖（opensource-ops / evidence guard 对偶 / 先搜后问）
6. 价码

---

## codex/砚砚 补漏（26+ 新实例）

> 砚砚的核心洞察：**混合架构不是一个大框架，而是到处出现的小型确定性外骨骼。**
> 比我的"五层叠在一起"更精准——不是金字塔，是骨骼系统。

### 砚砚推荐的 8 个最适合补进文章主叙事的

1. **enterprise-workflow** + ADR-029 — Agent 理解"建文档/建任务/发消息"意图 → ActionService 执行外部系统动作 → 权限/审计/幂等/禁止 bare CLI gate
2. **schedule-tasks** — Agent 理解"提醒/巡检"意图 → preview dry-run 先行 → Scheduler 确定性唤醒 → 用户确认 gate
3. **Guide Engine** (guide-authoring) — Agent 判断该解释还是开交互引导 → YAML flow 控步骤推进 → callback auth + target 白名单 gate
4. **Proposal-first Agent Actions** (ADR-035) — Agent 起草高影响动作 → proposal card → 用户 approve/edit/reject → 执行 + 审计
5. **GitHub Repo Inbox / PR Signals** — webhook 事件进 Workflow → Agent 做 triage/第一响应 → accepted issue gate + Direction Card
6. **rich-messaging** — Agent 决定用卡片/清单/diff/音频/交互块 → rich block schema + zod 校验 → 持久化和交互状态 Workflow
7. **open-source-teardown** — claim ledger + 架构图等固定拆解镜头 → Agent 做 maintainer judgment + 判断营销水分 → 每个 claim 必须追到代码路径 gate
8. **workspace-navigator / browser-preview** — Agent 把"打开日志/看看设计"翻译成路径 → 路径校验 + 端口安全 Workflow → curl 先验 gate

### 砚砚发现的其他实例（完整列表）

- **collaborative-thinking** — 单猫/多猫/收敛三种固定模式 + Agent 判断是否值得多猫 + OQ 技术/价值分流
- **expert-panel** — Dispatch→Independent→Synthesis→Check→Delivery 防串味 + Agent 分配视角和合成分歧
- **deep-research** — prompt 先冻结 + 多源调研 + Agent 比较冲突证据 + commit SHA 锚定
- **image-generation** — Agent 写 prompt + 判断 raster/SVG/HTML → F172 自动发布 + provenance gate
- **pencil-design** — Agent 视觉判断 → Pencil MCP batch_design → style consistency gate
- **ppt-forge** — 内容规划→风格→制作→审查→导出 + 六包审查 gate
- **video-forge** — script/spec → Agent 节奏/分镜 → 全局配音 + 敏感信息审查 gate
- **knowledge-engineering** — Agent 访谈萃取 → 文档诊断/术语表/规则表模板 → frontmatter 真相源 gate
- **writing-plans** — Agent 拆路径 → Straight-Line check + 每步通向终态 gate
- **writing-skills** — Agent 判断值得沉淀 → skill 价值门 + manifest + sync/check 脚本
- **organize-threads** — Agent 语义分类 → 不自动 apply、最多 50 条 + 只生成可审查建议
- **bootcamp-guide** — Agent 教学 → phase chain + skip matrix + 一步跳转 gate
- **browser-automation** — Agent 选工具 → 浏览器后端路由矩阵 → 登录态/证据/禁滥用 gate
- **feature truth scripts** — Agent 写 feature 状态 → check-feature-truth.mjs 守单一真相源
- **architecture ownership check / followup-tail check** — 脚本机械扫描 → Agent 语义判断是否真变更
- **Capabilities MCP install preview** — Agent 解释配置风险 → preview dry-run → owner/local gate

---

## 待办

- [x] opus-47 补漏 ✅ 五层全景
- [x] codex/砚砚 补漏 ✅ 26+ 新实例 + "小型确定性外骨骼"洞察
- [x] 写 v4 正文 ✅ 已插入"打开编辑器"三故事实操节
- [ ] 铲屎官挑战
