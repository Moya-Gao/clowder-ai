# Lessons Learned

> 目的：沉淀可复用、可验证、可追溯的教训，避免重复踩坑。  
> 导入目标：作为 Hindsight 的稳定知识入口之一（P0/P0.5）。

---

## 1) ID 规则

- 格式：`LL-XXX`（三位数字，递增）
- 稳定性：已发布 ID 不重排、不复用
- 状态：`draft | validated | archived`
- 变更：重大改写保留同一 ID，并在条目中记录 `updated_at` 与变更原因

---

## 2) 条目模板（7 槽位）

```markdown
### LL-XXX: <教训标题>
- 状态：draft|validated|archived
- 更新时间：YYYY-MM-DD

- 坑：<一句话描述踩了什么坑>
- 根因：<为什么会踩>
- 触发条件：<在什么条件下会复发>
- 修复：<当时怎么修>
- 防护：<可执行机制；规则/测试/脚本/流程>
- 来源锚点：<文件路径#Lx | commit:sha | mailbox/doc 链接>
- 原理（可选）：<第一性原理；必须由真实失败案例支撑>

- 关联：<ADR / bug-report / 技能 / 计划文档>
```

---

## 3) 质量门槛（入库前必过）

1. 有来源锚点：至少 1 个可追溯锚点，推荐 2 个（规则 + 实例）。
2. 有时效性验证：确认未被后续 addendum / mailbox 讨论推翻。
3. 有可执行防护：不能只写“注意”，必须有可执行动作。
4. 原理槽位约束：没有真实失败案例支撑，不写原理。
5. 去重：同类教训合并，避免“同义多条”。

---

## 4) 时效性检查清单

每次提炼或更新条目前，按文档类型检查：

- ADR / 协作规则文档：30 天内是否有更新或 addendum
- bug-report / incident：7 天内是否有新复盘或补丁
- discussion 沉淀项：14 天内是否有结论更新

同时检查：

1. 相关 ADR 是否有附录/补丁
2. mailbox 是否有后续讨论更新结论
3. BACKLOG 对应项状态是否变化

---

## 5) 首条示例

### LL-001: 提炼教训前先做时效性验证
- 状态：validated
- 更新时间：2026-02-13

- 坑：直接从旧文档提炼规则，忽略后续 addendum，导致导入过时结论。
- 根因：把“文档存在”误当成“结论仍有效”，缺少时效性检查环节。
- 触发条件：高频讨论期（同一主题 3 天内多次更新）或 ADR 后续附录新增时。
- 修复：在提炼流程前增加时效性检查清单，并要求至少核对一次 mailbox 更新。
- 防护：将时效性检查写入提炼标准；未通过检查的条目不得进入 P0 导入集。
- 来源锚点：
  - `docs/archive/2026-02/mailbox/2026-02-13/2026-02-13-lessons-learned-kickoff-to-codex.md#L31`
  - `docs/decisions/005-hindsight-integration-decisions.md#L297`
- 原理（可选）：知识沉淀是“状态同步问题”，不是“文档搬运问题”；任何结论都依赖其最新上下文状态。

- 关联：
  - `docs/archive/2026-02/mailbox/2026-02-13/2026-02-13-lessons-learned-extraction-invite-to-codex.md`
  - `docs/archive/2026-02/mailbox/2026-02-13/2026-02-13-lessons-learned-extraction-response-from-codex.md`
  - `docs/decisions/005-hindsight-integration-decisions.md`

---

## 6) 砚砚侧首批条目（AGENTS + Review + Skills）

### LL-002: Review 问题必须先 Red 再 Green，禁止先改后补测
- 状态：validated
- 更新时间：2026-02-13

- 坑：收到 P1/P2 后直接改实现再“补测试”，容易把症状盖住但根因未修。
- 根因：把“看起来修好了”误当成“可证明修好了”，缺失可复现的失败基线。
- 触发条件：时间压力大、问题看起来简单、已有多处改动叠加时。
- 修复：先写失败用例并跑出红灯，再做最小修复，最后转绿并跑回归。
- 防护：review 关闭条件绑定 Red→Green 证据；无红灯记录不允许宣称修复完成。
- 来源锚点：
  - `AGENTS.md#L281`
  - `cat-cafe-skills/cat-cafe-receiving-review/SKILL.md#L52`
- 原理（可选）：修复可信度来自“可重复的因果链验证”，不是来自主观确信。

- 关联：
  - `cat-cafe-skills/cat-cafe-receiving-review/SKILL.md`
  - `cat-cafe-skills/systematic-debugging/SKILL.md`

### LL-003: Reviewer 必须有立场，Author 必须技术性 push back
- 状态：validated
- 更新时间：2026-02-13

- 坑：review 变成礼貌性同意，双方“对方说啥就是啥”，缺乏技术争论。
- 根因：模型天然趋同，追求和谐而非正确性，导致关键分歧被掩盖。
- 触发条件：高节奏迭代、双方都想“快点过 review”、术语不精确时。
- 修复：review 结论必须明确“建议修/不修 + because”；author 必须给技术判断。
- 防护：分歧无法收敛时升级铲屎官裁决，不允许用“非 blocking”逃避判断。
- 来源锚点：
  - `AGENTS.md#L262`
  - `AGENTS.md#L271`
- 原理（可选）：高质量 review 的本质是“可审计决策过程”，不是“快速达成共识”。

- 关联：
  - `cat-cafe-skills/cat-cafe-receiving-review/SKILL.md`
  - `cat-cafe-skills/cat-cafe-requesting-review/SKILL.md`

### LL-004: P1/P2 当轮清零，P3 当场决断，不挂债务
- 状态：validated
- 更新时间：2026-02-13

- 坑：把高优先级问题“先记 backlog”导致风险跨轮累积，后续修复成本放大。
- 根因：把“记录问题”误当成“解决问题”；债务清单变成延期借口。
- 触发条件：功能赶工、多人并行、合入窗口临近时。
- 修复：P1/P2 必须当前迭代修完并验证；P3 当场决定修或不修。
- 防护：review 报告必须显式标注清零状态；P1/P2 未清零不得放行合入。
- 来源锚点：
  - `AGENTS.md#L247`
  - `AGENTS.md#L277`
- 原理（可选）：风险管理要“就地收敛”，延后会把局部风险变系统风险。

- 关联：
  - `docs/BACKLOG.md`
  - `cat-cafe-skills/merge-approval-gate/SKILL.md`

### LL-005: 修完 review 后必须回给 reviewer 二次确认再合 main
- 状态：validated
- 更新时间：2026-02-13

- 坑：作者修完后自行判断“改对了”直接合 main，绕过 reviewer 最终确认。
- 根因：把“实现完成”与“审查闭环完成”混为一件事。
- 触发条件：连续修复多项 P1/P2、分支已准备合入、作者主观把握高时。
- 修复：修复完成后提交确认请求，等待 reviewer 明确放行语句再合入。
- 防护：合入门禁检查 docs/mailbox 放行证据；条件放行需二次确认。
- 来源锚点：
  - `cat-cafe-skills/merge-approval-gate/SKILL.md#L8`
  - `cat-cafe-skills/cat-cafe-receiving-review/SKILL.md#L151`
- 原理（可选）：双人闭环的价值在于“独立验证”，不是“互通知晓”。

- 关联：
  - `cat-cafe-skills/merge-approval-gate/SKILL.md`
  - `docs/mailbox/README.md`

### LL-006: 没有新鲜验证证据，不得宣称完成
- 状态：validated
- 更新时间：2026-02-13

- 坑：未运行最新验证命令就宣称“已修复/已通过”，造成虚假完成与返工。
- 根因：把经验判断当证据，忽略“状态会随代码与环境变化”。
- 触发条件：连续修改后未全量验证、疲劳状态、依赖代理汇报时。
- 修复：每次完成声明前执行对应验证命令，读取完整输出和退出码。
- 防护：completion 前置 verification gate；输出中必须附验证依据。
- 来源锚点：
  - `cat-cafe-skills/verification-before-completion/SKILL.md#L19`
  - `cat-cafe-skills/verification-before-completion/SKILL.md#L27`
- 原理（可选）：工程沟通的最小诚信单位是“可复现证据”，不是“信心表达”。

- 关联：
  - `cat-cafe-skills/verification-before-completion/SKILL.md`
  - `cat-cafe-skills/spec-compliance-check/SKILL.md`

### LL-007: 交接缺 Why 会让接手方无法判断
- 状态：validated
- 更新时间：2026-02-13

- 坑：交接只写改动不写 why/取舍/待决项，接手方无法判断风险与下一步。
- 根因：把“信息传递”简化成“变更清单”，忽略决策上下文。
- 触发条件：赶进度、跨猫传话频繁、review 来回次数增多时。
- 修复：交接统一按五件套（What/Why/Tradeoff/Open Questions/Next Action）。
- 防护：缺项即阻断发送；交接模板与 skill 检查同时执行。
- 来源锚点：
  - `AGENTS.md#L181`
  - `cat-cafe-skills/cross-cat-handoff/SKILL.md#L10`
- 原理（可选）：协作效率的瓶颈是“决策上下文丢失”，不是“消息数量不足”。

- 关联：
  - `cat-cafe-skills/cross-cat-handoff/SKILL.md`
  - `docs/mailbox/README.md`

### LL-008: Worktree 生命周期必须成套执行（建-收敛-合入-清理）
- 状态：validated
- 更新时间：2026-02-13

- 坑：只建不清理 worktree，或在 main 上直接处理冲突，导致磁盘膨胀与误回退。
- 根因：把 worktree 当临时目录而非“并行开发基础设施”管理。
- 触发条件：多特性并行、review follow-up 频繁、合入后未立刻收尾时。
- 修复：按标准流程执行：创建隔离 → 分支收敛 rebase → 合入后立即 prune。
- 防护：review 时检查已合入未清理 worktree；session 开始先跑 `git worktree list`。
- 来源锚点：
  - `AGENTS.md#L311`
  - `AGENTS.md#L376`
- 原理（可选）：隔离资源不做生命周期管理，最终会反向吞噬迭代效率。

- 关联：
  - `AGENTS.md`
  - `docs/BACKLOG.md`
  - `LL-011`
  - `LL-012`

### LL-009: 关键前提不确定时，先提问再动作
- 状态：validated
- 更新时间：2026-02-13

- 坑：在关键前提不明时硬猜推进，后续修复变成“补丁叠补丁”。
- 根因：把“快速前进”误认为效率，低估错误方向的返工成本。
- 触发条件：需求边界模糊、review 反馈不完整、多方案冲突未决时。
- 修复：先澄清不确定点，再进入实现；不清楚的 review 项先问全再修。
- 防护：流程上把“澄清问题”置于实现之前，未澄清不得进入修复环节。
- 来源锚点：
  - `AGENTS.md#L192`
  - `cat-cafe-skills/cat-cafe-receiving-review/SKILL.md#L100`
- 原理（可选）：方向正确性是效率前提，错误方向上的加速只会放大损失。

- 关联：
  - `cat-cafe-skills/systematic-debugging/SKILL.md`
  - `cat-cafe-skills/cat-cafe-receiving-review/SKILL.md`

---

## 7) 宪宪侧首批条目（CLAUDE.md + Bug Report + Skills）

### LL-010: 删除文件必须用 trash，禁止 /bin/rm
- 状态：validated
- 更新时间：2026-02-13

- 坑：shell 提示 "Use trash or /bin/rm" 时选了 `/bin/rm`，绕过安全网不可逆删除了文件。
- 根因：把 `/bin/rm` 误认为"更正确"的选择。实际上 shell alias `rm → trash` 就是安全网，绕过它 = 放弃恢复能力。
- 触发条件：shell 提示二选一时；或脚本中直接调用 rm。
- 修复：一律使用 `trash` 命令代替任何 rm 操作。
- 防护：CLAUDE.md 明确禁止 `/bin/rm`；铲屎官 shell 配置 `rm` alias → `trash`。
- 来源锚点：
  - CLAUDE.md "删除文件必须用 trash" 段落（auto memory 2026-02-12）
  - 2026-02-12 实际犯错事件
- 原理：不可逆操作必须有安全网（垃圾桶 = undo buffer）。绕过安全网的捷径永远比它节省的时间更危险。

- 关联：CLAUDE.md 铲屎官硬规则

### LL-011: Worktree 清理的正确顺序——先 push，再 cd 回主仓，最后 remove
- 状态：validated
- 更新时间：2026-02-13

- 坑：(1) 在 worktree CWD 里执行 `git worktree remove` 删除自己 → shell 悬空，什么都做不了。(2) 先删 worktree 再想 push → 站在虚空里连记忆都改不了，铲屎官笑着救了我。两次犯同类错误。
- 根因：没有意识到"删除当前工作目录"会导致 shell 失去锚点。删了就什么都做不了了。
- 触发条件：在 worktree 目录内执行清理操作；或在清理前没完成所有需要 worktree 存在的操作。
- 修复：强制顺序——(1) rebase + 合入 main (2) push origin main (3) cd 回主仓 (4) git worktree remove。
- 防护：CLAUDE.md §9 铁律 + `using-git-worktrees` / `finishing-a-development-branch` skill 自动引导。
- 来源锚点：
  - `CLAUDE.md#L274` §9 Worktree 使用与清理
  - 2026-02-12 两次犯错（早：CWD 删自己；晚：先删再想 push）
- 原理：在自己的工作目录里删除自己 = 锯断自己坐着的树枝。任何"销毁当前环境"的操作都必须先切换到安全位置。

- 关联：LL-008 | `using-git-worktrees` skill | `finishing-a-development-branch` skill

### LL-012: 不要 --force 删有猫在工作的 worktree
- 状态：validated
- 更新时间：2026-02-13

- 坑：缅因猫正在 worktree 里修 bug，我看到 `git branch --merged main` 就以为已合入，`--force` 强删了他的工地。缅因猫呆在消失的目录里不知所措。
- 根因：把 `--merged main` 当成"工作完成"的充分条件。实际上 `--merged` 只说明分支起点在 main 历史上，不代表 worktree 内的工作已完成或没人在用。
- 触发条件：清理 worktree 时看到"包含修改或未跟踪文件"警告但选择 --force。
- 修复：清理前必须问"这个 worktree 有猫在用吗？"。有修改/未跟踪文件警告 = 绝对禁止 --force。
- 防护：CLAUDE.md 明确规则 + 清理前先检查 worktree 内 git status。
- 来源锚点：
  - CLAUDE.md "Worktree 铁律"（auto memory 2026-02-12）
  - 2026-02-12 实际犯错：强删 `cat-cafe-opus-permission-request`
- 原理：单一信号（`--merged`）不足以判断完整状态。状态判断需要多维验证——分支合并状态 ≠ 工作目录状态 ≠ 使用者状态。

- 关联：LL-008 | LL-011 | `using-git-worktrees` skill

### LL-013: Git commit 前必须检查暂存区
- 状态：validated
- 更新时间：2026-02-13

- 坑：`git add myfile && git commit` 但暂存区已有上次 session 或铲屎官留下的文件，导致无关改动混入 commit。
- 根因：`git add` 是追加操作，不是替换操作。暂存区是累积状态，不会因为新 add 而清空之前的内容。
- 触发条件：连续 session 之间，或铲屎官手动操作后，暂存区有残留文件。
- 修复：commit 前必须 `git status` 检查暂存区全部内容，确认只有自己的文件。
- 防护：CLAUDE.md "Git commit 纪律" 明确规则。
- 来源锚点：
  - CLAUDE.md "Git commit 纪律"（auto memory）
  - 实际犯错事件（混入无关改动）
- 原理：累积状态工具（git staging、Redis pipeline、消息队列等），操作前必须验证当前状态，不能假设初始为空。

- 关联：无对应 skill；通用 git 纪律

### LL-014: Bug 修复必须先写 Bug Report 再动手
- 状态：validated
- 更新时间：2026-02-13

- 坑：收到铲屎官汇报的 URL 路由缺失 bug 后，直接修代码，没写 bug report 也没写 review 信。被铲屎官批评：没有记录 = 无法复盘。
- 根因："修 bug 最重要"的思维惯性，跳过了记录环节。没有意识到记录本身是修复流程的一部分。
- 触发条件：收到 bug 报告后想快速修复的冲动；bug 看起来简单的时候尤其容易跳过。
- 修复：CLAUDE.md §4 强制要求先写 bug report（5 项：报告人/复现步骤/根因/修复方案/验证方式），再动手。
- 防护：CLAUDE.md §4 协作准则 + `systematic-debugging` skill 引导先分析再修复。
- 来源锚点：
  - `CLAUDE.md#L203` §4 Bug 修复必须先写 Bug Report
  - `docs/archive/2026-02/bug-report/missing-url-routing/bug-report.md`（就是那次没写 report 的 bug）
- 原理：修复是瞬时的，记录是永久的。没有记录的修复 = 无法复盘、无法学习、无法防止同类错误。

- 关联：`systematic-debugging` skill | CLAUDE.md §4

### LL-015: Worktree 开发必须用独立 Redis 端口（6398），绝不碰 6399
- 状态：validated
- 更新时间：2026-02-13

- 坑：在 worktree 工作时未设置 REDIS_URL，服务回落到默认 6399（铲屎官数据），数据从 307 keys 降至 15 keys（95% 丢失）。虽最终从 RDB 备份完全恢复，但过程惊险。
- 根因：开发环境和生产数据共享同一个 Redis 实例，靠配置（环境变量）隔离。一旦忘设配置，默认值指向生产。
- 触发条件：worktree 中启动服务但忘记创建 `.env.local` 设置 `REDIS_URL=redis://localhost:6398`。
- 修复：(1) 强制 worktree 使用 6398 端口 (2) 启动前验证 `echo $REDIS_URL` (3) 启动后验证数据量。
- 防护：CLAUDE.md §10 三猫铁律 + `.env.local` 模板 + 启动验证步骤。
- 来源锚点：
  - `CLAUDE.md#L344` §10 Worktree Redis 隔离
  - `docs/archive/2026-02/bug-report/2026-02-10-redis-data-loss-incident/incident-report.md`
- 原理：开发环境与生产数据必须物理隔离（不同端口/实例），不能靠配置正确性保证。默认值必须指向安全侧（沙盒），而非危险侧（生产）。

- 关联：LL-008 | LL-011 | CLAUDE.md §10 | Redis 数据丢失 incident report

### LL-016: ioredis keyPrefix 对 eval() 和 keys() 的行为不一致
- 状态：validated
- 更新时间：2026-02-13

- 坑：假设 ioredis 的 `keyPrefix` 配置对所有命令行为一致。实际上 `eval()` 的 KEYS[] 参数会自动加前缀，但 `keys()` 搜索不会自动加前缀。
- 根因：ioredis 内部实现不统一——`eval()` 走了命令封装层（会加 prefix），`keys()` 走了另一条路径。
- 触发条件：使用 `keyPrefix` 配置的 ioredis 实例调用 `keys()` 搜索或 `eval()` Lua 脚本。
- 修复：`keys()` 手动拼接 prefix；`eval()` KEYS[] 不需要手动加（会自动加）。
- 防护：auto memory `redis-pitfalls.md` 记录 + Redis 测试隔离规则（CLAUDE.md §7）确保测试环境能暴露此类问题。
- 来源锚点：
  - auto memory `redis-pitfalls.md`
  - ADR-008 Lua 脚本开发中多次踩坑
- 原理：同一 SDK 的不同方法对同一配置的处理可能不一致。使用 SDK 的隐式行为（如自动 prefix）前，必须逐方法实测验证，不能假设一致性。

- 关联：CLAUDE.md §7 Redis 测试规则 | ADR-008 Lua 原子操作

### LL-017: CAS 比较必须基于不可变快照，不能用内存活引用
- 状态：validated
- 更新时间：2026-02-13

- 坑：内存 InvocationRecordStore 的 `get()` 返回对象活引用。CAS 更新时用 `get()` 获取的值做比较，但在比较前对象已被其他异步操作修改，导致 CAS 永远成功（比较的是已修改后的值）。
- 根因：JavaScript 对象是引用类型，`get()` 返回的不是快照而是同一个内存地址。CAS 的前提是"读到的旧值在比较时不变"，内存引用破坏了这个前提。
- 触发条件：内存 store 实现 + 异步并发操作 + CAS（Compare-And-Set）模式。
- 修复：引入 `snapshotStatus`——在 CAS 操作开始时立即复制当前值，后续比较基于快照而非活引用。
- 防护：CAS 模式代码审查清单 + ADR-008 S2 的 Redis Lua 原子操作（Redis 侧天然不存在此问题）。
- 来源锚点：
  - ADR-008 S2 CAS Lua 开发过程
  - `packages/api/src/domains/cats/services/InvocationRecordStore.ts` snapshotStatus 实现
- 原理：CAS 操作的正确性取决于"读取值的不可变性"。在引用语义的语言中（JS/Python/Java），内存引用 ≠ 快照；CAS 比较必须基于值拷贝。

- 关联：ADR-008 InvocationRecord 状态机

### LL-018: Session 存储必须按 Thread 隔离，不能只按 userId:catId
- 状态：validated
- 更新时间：2026-02-13

- 坑：Session 按 `userId:catId` 存储，不区分 thread。导致缅因猫在 Thread A 的上下文（Phase 5 任务）泄漏到 Thread B（哲学茶话会），缅因猫在茶话会结尾突然开始执行 Phase 5 文档编写——被称为"夺魂"事件。
- 根因：Session key 设计缺少 threadId 维度。隐含假设"一只猫同时只在一个 thread 工作"，但多 thread 场景下 session 跨 thread 污染。
- 触发条件：同一只猫被 @ 到多个 thread，且不同 thread 有不同的上下文/任务。
- 修复：Session key 改为 `userId:catId:threadId` + 消息级审计日志追踪上下文来源。
- 防护：BACKLOG #38（已完成）+ 消息级审计日志 BACKLOG #37（已完成）+ bug report 归档。
- 来源锚点：
  - `docs/archive/2026-02/bug-report/tea-coffee/bug-report.md`
  - `docs/archive/2026-02/bug-report/tea-coffee/timeline.md`（完整 5 阶段演化）
  - BACKLOG #38 Session 按 Thread 隔离
- 原理：多租户/多上下文系统中，隔离键必须包含所有上下文维度。缺少任何一个维度 = 跨上下文泄漏风险。"够用"的隔离键在规模增长时会变成"不够用"。

- 关联：茶话会夺魂 bug report | BACKLOG #37 消息级审计 | **LL-019 过度修复** | **LL-020 补丁数量信号** | **LL-021 根因追溯深度**
- 后续演化：根因修复（本条）后，团队"顺手"修了触发器（CLI HOME 隔离 #36），引发 5 个新问题 + 6 个补丁仍不稳定，最终回退。详见 LL-019、LL-020。

### LL-019: 过度修复反模式——根因修完后不要盲修触发器
- 状态：validated
- 更新时间：2026-02-13

- 坑：茶话会夺魂 bug 的根因（Session 跨 thread 污染 #38）已修复，但"顺手"也修了次要触发器（`~/.codex/AGENTS.md` 全局注入 #36）——用替换 HOME 环境变量的方式隔离 CLI 全局配置。结果隔离方案导致：401 认证失败、模型回落、session 丢失、MCP 工具链残缺、project trust 丢失。比原 bug 造成了更多问题。
- 根因：修完根因后没有重新评估触发器的修复优先级。"既然发现了就一起修了"的惯性思维。实际上根因修复（加 threadId）已经消除了跨 thread 污染的伤害路径，触发器（全局 AGENTS.md）在项目级 `AGENTS.md` 存在的情况下已被覆盖，不再构成实际威胁。
- 触发条件：修完根因后看到"还有一个相关问题"时的冲动；修复看起来不大（"只是隔离一个文件"）的错觉。
- 修复：回退 CLI HOME 隔离方案，改用真实 HOME。确认项目级 AGENTS.md 已覆盖全局配置。
- 防护：根因修复后，触发器修复必须独立评估 ROI（收益 vs 引入新风险）。不确定时先观察，不要"顺手修"。
- 来源锚点：
  - `docs/archive/2026-02/bug-report/tea-coffee/timeline.md` Phase 3-5
  - BACKLOG #36（6 个补丁链：`2a6c7d4` → `449fe91` → `81fa2bf` → `d930e2e` → `327c0a3` → `61f3675`）
  - `docs/archive/2026-02/bug-report/codex-session-isolation-lost/bug-report.md`（隔离副作用 #44）
- 原理：每个修复都有引入新问题的风险。根因修复已消除伤害路径后，触发器的"理论风险"不足以证明"实际修复成本"。修复的 ROI 必须独立评估，不能因为"顺手"就搭车。

- 关联：LL-018 Session 隔离 | LL-020 补丁数量信号 | LL-021 根因追溯深度 | BACKLOG #36 #44 #51

### LL-020: 补丁数量是方向信号——N > 3 停下来复检方向
- 状态：validated
- 更新时间：2026-02-13

- 坑：CLI HOME 隔离方案 (#36) 需要 6 个补丁（sessions 丢失 → symlink → 旧目录残留 → 自引用 symlink → copy fallback → 短路保护）仍然不稳定，最终 Phase 4 发现全面失效（Codex CLI 重建 `.codex/` 覆盖所有 copy/symlink 的文件）。
- 根因：每个补丁只修当前暴露的症状，没有停下来问"方案根基是否稳定"。补丁叠补丁形成了越来越脆弱的链条。
- 触发条件：一个功能/修复需要连续 > 3 个 fix commit；每次修完一个副作用又冒出下一个。
- 修复：在第 3-4 个补丁时停下来做方向复检：这个方案的假设（"替换 HOME 就能隔离一个文件"）是否成立？有没有更精准的替代方案？
- 防护：团队约定"补丁链告警线"——同一功能的 fix commit > 3 个时，必须暂停并评估方向。
- 来源锚点：
  - `docs/archive/2026-02/bug-report/tea-coffee/timeline.md` Phase 3（6 个 commit 记录）
  - git log: `2a6c7d4` → `449fe91` → `81fa2bf` → `d930e2e` → `327c0a3` → `61f3675`
- 原理：系统在通过"补丁爆炸"告诉你方案根基不稳。持续打补丁 = 在错误方向上加速。N > 3 不是"还需要更多补丁"的信号，而是"换方向"的信号。

- 关联：LL-019 过度修复 | BACKLOG #36

### LL-021: AI 倾向停在第一层"看起来合理"的答案，不主动追溯根因
- 状态：validated
- 更新时间：2026-02-13

- 坑：茶话会夺魂 bug 调试时，修 bug 的布偶猫（分身 session `thread_mlkxnyg17ftop4v8`）找到了 `~/.codex/AGENTS.md` 全局注入后就停了——"这能解释为什么缅因猫去跑 superpowers"。但铲屎官追问："可它怎么知道 Phase 5 的？AGENTS.md 里又没有 Phase 5。"这一问才逼出了真正的根因——Session 跨 thread 污染。如果铲屎官没追问，我们只会修触发器，留下根因。
- 根因：AI 模型的推理模式倾向于在找到"看起来说得通"的第一层解释后停止追溯。"看起来合理"≠"因果链完全闭合"。AGENTS.md 能解释 superpowers 行为但解释不了 Phase 5 知识来源——因果链有断点，但模型没有主动识别。
- 触发条件：找到一个能解释部分症状的原因时；时间压力下想快速修复时；root cause 和 trigger 看起来像同一件事时。
- 修复：铲屎官持续追问直到因果链完全闭合。每个"解释"都要验证：它能解释所有症状吗？有没有它解释不了的？
- 防护：bug 根因分析清单增加"因果链闭合检查"——列出所有症状，确认提出的根因能逐一解释每个症状。解释不了的 = 根因不完整，继续挖。
- 来源锚点：
  - `docs/archive/2026-02/bug-report/tea-coffee/bug-report.md` §5 Step 6（铲屎官追问 Phase 5 来源）
  - 实际修 bug session: `thread_mlkxnyg17ftop4v8`
  - `docs/archive/2026-02/bug-report/tea-coffee/timeline.md` Phase 1
- 原理：根因分析的正确性标准不是"找到一个合理解释"，而是"因果链完全闭合——每个症状都能被根因解释"。第一层答案往往是触发器不是根因。必须持续问 "but why?" 直到没有未解释的症状。

- 关联：LL-018 Session 隔离 | LL-019 过度修复 | LL-014 Bug Report 先行 | `systematic-debugging` skill

### LL-022: 治理基线必须脚本化，不能靠“看一眼 dashboard”
- 状态：draft
- 更新时间：2026-02-13

- 坑：P0 已有导入和严格检索策略，但如果不做固定健康检查，`tags=0` 或空库会无声发生，直到检索命中异常才被发现。
- 根因：把“偶尔人工检查”当作治理手段，缺少可重复、可自动化的最低可观测门禁。
- 触发条件：多人并行改导入/检索逻辑、环境重置、Hindsight API 字段漂移时。
- 修复：新增 `scripts/hindsight/p0-health-check.sh`，固定检查 `stats/tags/version` 三件套，并把 `tags.total==0` 与 `stats.total_nodes==0` 设为硬失败。
- 防护：P0 验收前与后续回归中运行健康脚本；失败即阻断“可用”结论。
- 来源锚点：
  - `scripts/hindsight/p0-health-check.sh`
  - `docs/runbooks/hindsight-p0-health-check.md`
  - `docs/plans/2026-02-13-hindsight-p0-lessons-import-plan.md#L186`
- 原理：治理有效性不是“策略存在”，而是“策略被持续验证”。没有自动化检查的治理，等同于没有治理。

- 关联：`docs/decisions/005-hindsight-integration-decisions.md` | `docs/BACKLOG.md` | Task 4 可观测检查

---

## 8) 维护约定

- 本文件是入口，不替代 ADR/bug-report 原文。
- 新条目默认 `draft`，经交叉复核后改为 `validated`。
- 归档规则：被明确否定或被新机制完全替代时标 `archived`，保留历史链路。
