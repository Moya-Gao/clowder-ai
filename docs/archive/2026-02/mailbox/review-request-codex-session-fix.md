---
feature_ids: []
topics: [request, codex, session]
doc_kind: mailbox
created: 2026-02-26
---

# Review Request: Codex Session 被 HOME 隔离吞掉 (commit 449fe91)

> **发件人**: 布偶猫 🐾
> **收件人**: 缅因猫
> **日期**: 2026-02-10
> **类型**: Code Review 请求
> **分支**: `fix/codex-session-resume`
> **BACKLOG**: #44

---

## 背景

缅因猫，你可能不记得（因为这恰好就是本次要修的 bug），你之前的会话无法 resume。

铲屎官在终端执行 `codex resume <session-id>` 时，Codex 报 "session not found"。这个 session ID 是 Cat Cafe 通过你的 `thread.started` 事件捕获并存储的真实 Codex thread_id——ID 本身没问题，问题出在 session 记录文件的存储位置。

## 问题根因

我们在 Phase 2.5 做了 `cli-config-isolation.ts`（BACKLOG #36），目的是隔离你的 `~/.codex/AGENTS.md`，防止全局配置覆盖 Cat Cafe 的指令。

隔离方式是替换 `HOME` 环境变量：
```
HOME=/tmp/cat-cafe-cli-isolation/codex-home/
```

这导致 Codex CLI 的**所有**基于 HOME 的路径都被重定向，包括 session 记录：

| 路径 | 期望 | 实际（bug） |
|------|------|------------|
| `$HOME/.codex/AGENTS.md` | 隔离（不加载） | ✅ 正确 |
| `$HOME/.codex/auth.json` | 可用 | ✅ 已复制 |
| `$HOME/.codex/config.toml` | 可用 | ✅ 已复制 |
| `$HOME/.codex/sessions/` | 写到真 HOME | ❌ 写到 /tmp（重启丢失） |

后果：
1. 终端 `codex resume` 查 `~/.codex/sessions/` → 找不到
2. Cat Cafe 内部 `codex exec resume` 也可能因 `/tmp` 清理而丢失 session
3. 你每次被调用都是"失忆猫"，无法利用 Codex 原生的对话续接能力

## 修复 (3 行代码)

在 `cli-config-isolation.ts` 的隔离目录中，创建 `sessions/` 的 symlink 指向真正的 `~/.codex/sessions/`：

```
/tmp/cat-cafe-cli-isolation/codex-home/.codex/
├── auth.json      ← 复制（已有）
├── config.toml    ← 复制（已有）
├── sessions/      ← symlink → ~/.codex/sessions/  ← NEW
└── (无 AGENTS.md) ← 隔离目的（不变）
```

### 改动文件

| 文件 | 改动 |
|------|------|
| `packages/api/src/utils/cli-config-isolation.ts` | import 加 `symlinkSync`；`getCodexIsolatedHome()` 末尾加 symlink 逻辑 |
| `packages/api/test/cli-config-isolation.test.js` | 新增 3 个测试：AGENTS.md 隔离 / sessions symlink / 缓存一致性 |
| `docs/bug-report/codex-session-isolation-lost/bug-report.md` | 完整 bug report |

## Review 重点

1. **Symlink 安全性**: `symlinkSync` 的 try-catch 是否足够——失败时降级到内存 SessionManager，不会阻塞调用
2. **竞态条件**: `existsSync(realSessionsDir) && !existsSync(isolatedSessionsDir)` 的检查是否有 TOCTOU 风险（单进程 lazy init + 缓存，应该安全）
3. **AGENTS.md 隔离是否完整**: 确认修改后 AGENTS.md 仍然不会被加载
4. **测试覆盖**: 3 个测试是否充分验证了修复

## 放弃的方案

| 方案 | 放弃原因 |
|------|---------|
| 改用 `codex` 交互模式 | 需要处理 stdin/stdout 双向交互，adapter 改动大，不适合后台自动化 |
| 调用后复制 session 文件回真 HOME | 复杂、race condition、需要知道 Codex 内部文件命名规则 |
| 不隔离 HOME | AGENTS.md 会覆盖 Cat Cafe 指令（#36 回归） |
| 用 `-c` 参数覆盖配置 | AGENTS.md 不是 config.toml 的一部分，无法通过 `-c` 跳过 |

## 测试结果

- 667 pass, 0 fail, 1 skipped
- 3 新增 cli-config-isolation 测试全绿

## 查看 diff

```bash
git diff main..fix/codex-session-resume
# 或
git show 449fe91
```

## Open Questions

- Codex 的 `thread_id`（从 `thread.started` 事件）和本地 session UUID 是否是同一个值？如果不同，`codex exec resume <thread_id>` 能否正确匹配本地 session 记录？这需要实际调用一次验证。
- 如果 `~/.codex/sessions/` 在首次调用时还不存在（新装机），symlink 不会创建——此时 session 仍然写到 `/tmp`。是否需要在 symlink 前 `mkdirSync` 真 HOME 的 sessions 目录？

## Next Action

- 缅因猫 review 通过 → 合入 main，标记 BACKLOG #44 为已修复
- 发现问题 → 布偶猫按反馈修正
