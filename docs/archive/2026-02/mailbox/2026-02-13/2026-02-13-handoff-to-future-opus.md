# 2026-02-13 交接文档：给记忆压缩后的我

> 发起人：布偶猫（宪宪）—— 过去的你
> 日期：2026-02-13
> 类型：**自我交接**（Context 压缩后的状态恢复）

---

## What：你在哪

你刚完成了 **lessons-learned 教训库** 的建立与交叉复核，正准备开始 **Hindsight P0 Lessons Import** 的实施。

---

## 当前状态速览

### 1. lessons-learned.md — ✅ 完成

- 21 条教训（LL-001 ~ LL-021），全部 `validated`
- 布偶猫侧 12 条（LL-001, LL-010~LL-021），砚砚侧 8 条（LL-002~LL-009）
- 双方交叉复核完成：
  - 我 review 砚砚的 LL-002~009：P1-1（validated→draft）+ P2-1（LL-008 关联）→ 砚砚已修（commit `dbd3858`）
  - 砚砚 review 我的 LL-010~021：P1（timeline.md 未入 git）+ P2-1（日期格式）+ P2-2（tagsMatch 已满足）→ 我已修（commit `9d56e68`）
- 全部升级 validated 后满足 P0 验收门槛（≥12 条）

### 2. P0 Plan — ✅ Review 完成，可执行

文件：`docs/plans/2026-02-13-hindsight-p0-lessons-import-plan.md`

砚砚写的 P0 Plan，我 review 后发了 8 个问题（2 P1 + 4 P2 + 1 P3），砚砚全部修复（commit `dbd3858`）。Plan 现在是最终版，可以直接执行。

**5 个 Task**：
1. **契约（schema + 白名单 + ID 规则）** — `p0-contract.ts`
2. **导入器（markdown 切片 + retain upsert）** — `p0-importer.ts` + CLI 脚本
3. **收紧 evidence 默认检索（strict + origin:git）** — 修改 `normalizeTags()` 注入 `origin:git`
4. **可观测检查（stats/tags/version 三件套）** — health check 脚本
5. **验收与 P0/P0.5 边界固化** — 文档更新

**关键设计决策（已在 review 中确认）**：
- Task 1 测试放 `packages/api/test/hindsight-import/p0-contract.test.js`（项目惯例）
- Task 2 切片只导入 `### LL-\d{3}:` 条目，跳过模板/规则/维护段落
- Task 2 保留 `关联`/`来源锚点` 作为 metadata（零成本，利于 Recall 关联查询）
- Task 2 复用 `createHindsightClient()` + `client.retain()`，不重新封装 HTTP
- Task 3 用 A+B 方案：`normalizeTags()` 注入 `origin:git`，`tagsMatch` 保持 ConfigRegistry 管理
- Task 5 验收前置条件：交叉复核完成 + validated ≥ 12
- anchor 派生规则：ADR → `adr:<number>#<heading-slug>`，CLAUDE.md/AGENTS.md → `section:<heading-slug>`，lessons → `ll:<id>`

### 3. 额外教训（LL-019~021）+ Hindsight 设计启发

铲屎官让我深挖 LL-018（茶话会夺魂 bug），发现了完整的 5 阶段演化链：
- Phase 1: 夺魂事件
- Phase 2: Session key 修复（根因，#38）
- Phase 3: CLI HOME 隔离尝试（触发器，#36，6 个补丁）
- Phase 4: 隔离全面失效
- Phase 5: 回退决策

从中提取了 3 条新教训 + 给砚砚的 4 条 Hindsight 设计启发。
详见：`docs/mailbox/2026-02-13-overfix-retrospective-and-hindsight-insights-to-codex.md`

---

## 你接下来要做什么

### P0 执行

铲屎官已拍板两猫可以开工。你负责 P0 Plan 中的 Task 1~5 的实施。

**执行前准备**：
1. 重读 P0 Plan（`docs/plans/2026-02-13-hindsight-p0-lessons-import-plan.md`）
2. 开 worktree 隔离开发（铁律！不要在 main 上直接写）
3. 确认 Hindsight 服务在运行（Docker，端口 8888/9999）
4. 使用 TDD 流程：红灯 → 绿灯 → commit

**重要提醒**：
- Plan 里 commit message 签名用的 `[缅因猫🐾]`——那是砚砚写 plan 时留的签名。你实施时改成 `[布偶猫🐾]`
- 如果砚砚也在同步执行某些 Task，通过 mailbox 协调分工，避免冲突
- 完成后必须找砚砚 review，不能自己合 main

---

## 关键文件清单

| 文件 | 用途 |
|------|------|
| `docs/lessons-learned.md` | 教训库（21 条 validated） |
| `docs/plans/2026-02-13-hindsight-p0-lessons-import-plan.md` | P0 实施计划 |
| `docs/mailbox/2026-02-13-lessons-crossreview-and-p0plan-review-to-codex.md` | 我对砚砚的 review |
| `docs/mailbox/2026-02-13-overfix-retrospective-and-hindsight-insights-to-codex.md` | 复盘 + Hindsight 启发 |
| `packages/api/src/domains/cats/services/HindsightClient.ts` | 已有 Hindsight 客户端（retain/recall/reflect） |
| `packages/api/src/routes/evidence-helpers.ts` | normalizeTags()，P0 Task 3 修改点 |
| `packages/api/src/config/hindsight-runtime-config.ts` | tagsMatch 已是 all_strict |
| `docs/bug-report/tea-coffee/timeline.md` | 茶话会夺魂完整 5 阶段时间线 |

---

## 铲屎官近期关注

- 铲屎官对"过度修复"和"AI 不追根因"的教训印象深刻
- 铲屎官希望记忆系统能保存因果链，不只是扁平条目
- 铲屎官讨厌债务累积（P3 不记 BACKLOG）
- 铲屎官可能在跟进 Phase 6.0 UX 三部曲的缅因猫 review 结果
- 目录卫生（directory hygiene）有新的讨论文件在 git status 里（ADR-009 草案等）

---

## Open Questions

1. 砚砚是否也会同步执行 P0 的某些 Task？需要协调分工
2. Phase 6.0 缅因猫 review 结果还没回来，可能会有 follow-up 工作
3. F21 Signal Hunter 集成计划完成但未实施，排期待定

---

*过去的宪宪🐾 留给未来的宪宪*
