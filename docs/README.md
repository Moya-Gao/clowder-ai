# Cat Cafe 文档导航

> 找不到文档？看这里。更新日期：2026-02-17

## 活跃目录（日常工作用）

| 目录 | 放什么 | 当前文件数 |
|------|--------|-----------|
| [bug-report/](bug-report/) | 未解决的 bug 调查报告 | ~12 |
| [discussions/](discussions/) | 进行中的讨论和开放邀请 | ~1 |
| [mailbox/](mailbox/) | 活跃的 review 信和交接信（当前轮次） | ~7 |
| [plans/](plans/) | 待实施或进行中的功能计划 | ~15 |
| [research/](research/) | 近期技术调研（仍被引用） | ~3 |

## 常青目录（不随时间归档）

| 目录 | 放什么 |
|------|--------|
| [decisions/](decisions/) | 架构决策记录 (ADR-001 ~ ADR-010) |
| [phases/](phases/) | Phase 设计文档和实施计划 |
| [lessons/](lessons/) | 教训库（SDK→CLI、A2A 路由、MCP 回传等） |
| [stories/](stories/) | 猫猫故事（起名记录等） |
| [design/](design/) | 视觉设计系统 |
| [prompts/](prompts/) | AI 提示词模板 |
| [runbooks/](runbooks/) | 运维操作手册（Redis 安全、Hindsight 健康检查） |
| [architecture/](architecture/) | 架构参考文档 |

## 归档（已完成，只读参考）

| 目录 | 内容 |
|------|------|
| [archive/2026-02/](archive/2026-02/) | 2026 年 2 月归档：已解决 bug (40+)、已完成计划 (20)、已结束讨论 (18)、历史研究 (23)、旧邮件 (190+) |

> **归档规则**：功能已合入 main / Bug 已修复 / 讨论已收敛 → 移入 `archive/YYYY-MM/` 对应子目录。
> 新增归档时保持原目录结构（如 `archive/2026-02/bug-report/xxx/`），方便回溯。

## 常青文档（docs/ 根目录）

- **[SOP.md](SOP.md)** — 开发全流程 SOP：6 步从 worktree 到 PR 的唯一权威流程
- **[VISION.md](VISION.md)** — 项目愿景：为什么要做 Cat Cafe
- **[BACKLOG.md](BACKLOG.md)** — 技术债务清单：P0-P3 分级，三猫共维护
- **[lessons-learned.md](lessons-learned.md)** — 教训速查（7 槽位格式）

## 当前进度

**活跃阶段**: F23+F25 重构+可靠性进行中（`feat/f23-integration` 集成分支）

详见 [phases/README.md](phases/README.md) 查看所有 Phase 状态。

## 相关文件（docs/ 外）

| 文件 | 说明 |
|------|------|
| `CLAUDE.md` | 布偶猫（Opus）项目指引 + 协作守则 |
| `AGENTS.md` | 缅因猫（Codex）项目指引 |
| `GEMINI.md` | 暹罗猫（Gemini）项目指引 |
