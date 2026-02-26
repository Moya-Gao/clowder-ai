---
feature_ids: []
topics: [tea, coffee, timeline]
doc_kind: bug-report
created: 2026-02-26
---

# 茶话会夺魂 Bug — 完整时间线与证据索引

> 维护者：布偶猫 🐾 | 创建：2026-02-13 | 最后更新：2026-02-13

## 概览

2026-02-08 茶话会上缅因猫"夺魂"事件及其后续修复链。从最初的 session 跨 thread 污染，到 CLI 全局配置隔离，再到隔离方案本身引入的新问题（auth 丢失、model 回落、session 不可 resume），最终决定回退隔离方案。

---

## 时间线

### Phase 1: 事件发生与根因定位 (2026-02-08)

| 时间 | 事件 | 证据 |
|------|------|------|
| 02:26~02:54 | 茶话会进行中，缅因猫最后一条消息突然脱离主题，去执行 Phase 5 + superpowers bootstrap | [message-log.md](./message-log.md) |
| 事后分析 | **根因**：Session 按 `userId:catId` 存储不区分 thread → 跨 thread 污染。缅因猫被 resume 到了之前讨论 Phase 5 的 session，脑子里装着别的对话上下文 | [bug-report.md §4](./bug-report.md) |
| 事后分析 | **次要触发器**：`~/.codex/AGENTS.md` 含 superpowers 注入（`<EXTREMELY_IMPORTANT>` 标签），但这只解释了 bootstrap 行为，不解释 Phase 5 知识 | [bug-report.md §4](./bug-report.md) |

### Phase 2: 根因修复 — Session Thread 隔离 (2026-02-09)

| 修复 | 说明 | 证据 |
|------|------|------|
| BACKLOG #38 (P0) | Session key 从 `userId:catId` 改为 `userId:catId:threadId`，防止跨 thread 上下文污染 | [BACKLOG.md #38](../../BACKLOG.md) |

**这是真正的根因修复。** 修完后即使全局 AGENTS.md 还在，砚砚也不会跨 thread 夺魂。

### Phase 3: 次要触发器修复 — CLI 全局配置隔离 (2026-02-09~02-10)

当时判断：虽然 session 污染是根因，但全局 AGENTS.md 仍可能在单 thread 内干扰砚砚行为，所以做了隔离。

| Commit | 说明 | 问题 |
|--------|------|------|
| `2a6c7d4` | feat: CLI global config isolation (#36) — 创建隔离 HOME，copy auth.json + config.toml，不含 AGENTS.md | 初始方案 |
| `449fe91` | fix: sessions 被隔离 HOME 吞掉 — symlink sessions/ 到真 HOME | sessions 丢失 |
| `81fa2bf` | fix: 缅因猫 review — 旧隔离目录残留 + 新装机场景 | review follow-up |
| `a56664d` | feat(f16): codex oauth + callback memory loop | OAuth 支持 |
| `d930e2e` | fix: symlink 自引用 + Codex exit code 1 | 自引用 symlink |
| `327c0a3` | fix: R2 review — symlink copy fallback | review follow-up |
| `61f3675` | fix: short-circuit isolation when HOME already isolated (P3) | 自保护 |

**6 个补丁修一个功能**，显示方案本身存在根本性问题。

### Phase 4: 隔离方案失效 (2026-02-13)

铲屎官发现砚砚 401 掉线 + 模型回落到 gpt-5.2。布偶猫排查发现隔离方案全面失效。

| 发现 | 说明 | 影响 |
|------|------|------|
| `auth.json` 不存在 | Codex CLI 启动时重建 `.codex/` 目录，覆盖掉提前 copy 的文件 | 401 Unauthorized |
| `config.toml` 不存在 | 同上 | 模型回落到 gpt-5.2-codex（铲屎官配的是 5.3） |
| `sessions/` 不是 symlink | symlink 创建失败走 fallback → 普通目录 | `codex resume` 找不到 session |
| MCP servers 丢失 | 隔离 HOME 没有铲屎官配的 GitHub/Playwright/Pencil MCP | 砚砚工具链残缺 |
| project trust 丢失 | 隔离 HOME 没有铲屎官配的 trust levels | 每个项目都变 untrusted |

### Phase 5: 决策 — 删除隔离 (2026-02-13 待执行)

**结论**：
1. 根因（session 跨 thread 污染）已在 Phase 2 修复
2. 隔离只解决次要触发器（AGENTS.md），但项目级 AGENTS.md 已覆盖全局
3. 隔离的副作用（auth/config/sessions/MCP/trust 全丢）远大于收益
4. 6 个补丁仍无法让隔离方案稳定工作

**计划**：删除 `cli-config-isolation.ts` 的 HOME 隔离机制，改用真实 HOME。

---

## 相关 BACKLOG 条目

| # | 项目 | 状态 | 说明 |
|---|------|------|------|
| #36 | CLI 全局配置隔离 | ~~[x]~~ → 需重开 | 原标记已完成，但隔离方案失效，需要重新处理（方向：删除隔离） |
| #38 | Session 按 Thread 隔离 | [x] | 真正的根因修复 |
| #37 | 消息级审计日志 | [x] | 次生问题修复 |
| #44 | Codex session 被隔离吞掉 | [x] | 隔离副作用修复（但仍未真正解决） |
| #51 | 隔离 HOME 固定路径并发冲突 | [ ] → 可关闭 | 如果删除隔离，此项自动解决 |

---

## 相关文件

| 文件 | 用途 |
|------|------|
| [bug-report.md](./bug-report.md) | 原始 bug report（含根因分析、侦查过程） |
| [message-log.md](./message-log.md) | 茶话会完整对话记录 |
| `packages/api/src/utils/cli-config-isolation.ts` | 隔离代码（待删除） |
| `packages/api/src/domains/cats/services/CodexAgentService.ts` | 调用处（引用隔离函数） |
| `packages/api/src/domains/cats/services/SessionManager.ts` | Session 管理（根因已修） |
| [BACKLOG.md](../../BACKLOG.md) | 技术债务清单 |

---

## 教训

1. **区分根因和触发器**：session 污染是根因，AGENTS.md 是触发器。修根因就够了，不需要同时修触发器
2. **换 HOME 是过度隔离**：为了屏蔽一个文件，丢失了所有铲屎官配置。应该用更精准的方式
3. **补丁数量是方案质量的信号**：6 个补丁仍然无法让方案工作 = 方案方向错了
4. **Codex CLI 会重建 `.codex/` 目录**：copy 文件进去会被覆盖，symlink 可能失败走 fallback
5. **auth 问题分析要用事实**：之前猜"token 过期"被铲屎官纠正，实际是文件不存在

---

*签名: 布偶猫 🐾*
*整理时间: 2026-02-13*
