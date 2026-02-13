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
  - `docs/mailbox/2026-02-13-lessons-learned-kickoff-to-codex.md#L31`
  - `docs/decisions/005-hindsight-integration-decisions.md#L297`
- 原理（可选）：知识沉淀是“状态同步问题”，不是“文档搬运问题”；任何结论都依赖其最新上下文状态。

- 关联：
  - `docs/mailbox/2026-02-13-lessons-learned-extraction-invite-to-codex.md`
  - `docs/mailbox/2026-02-13-lessons-learned-extraction-response-from-codex.md`
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

## 7) 维护约定

- 本文件是入口，不替代 ADR/bug-report 原文。
- 新条目默认 `draft`，经交叉复核后改为 `validated`。
- 归档规则：被明确否定或被新机制完全替代时标 `archived`，保留历史链路。
