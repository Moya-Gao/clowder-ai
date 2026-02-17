# Bug Report: Codex Session 被 HOME 隔离吞掉

> **报告人**: 铲屎官 (发现) + 布偶猫 (定位)
> **发现方式**: 铲屎官在终端执行 `codex resume <id>` 失败，提示 session not found
> **严重性**: P1 — 缅因猫无法 resume 历史上下文，每次调用都是"失忆猫"
> **BACKLOG**: #44
> **日期**: 2026-02-10

---

## 复现步骤

### 期望行为
1. Cat Cafe 调用缅因猫 (`codex exec --json ...`)
2. Codex 返回 `thread.started` 事件，含 `thread_id`
3. Cat Cafe 存储 `thread_id` 到 SessionManager
4. 后续调用 `codex exec resume <thread_id> ...` 恢复上下文
5. 铲屎官从终端也能 `codex resume <thread_id>` 查看/续接

### 实际行为
- 步骤 1-3 正常
- 步骤 4: **可能失败** — Codex 的 session 记录写到了 `/tmp`，重启后丢失
- 步骤 5: **必定失败** — `codex resume` 查的是 `~/.codex/sessions/`，但 Cat Cafe 调用时 HOME 被替换了

## 根因分析

### 定位过程

1. 检查 `CodexAgentService.ts:181` — `HOME: getCodexIsolatedHome()` 替换了整个 HOME
2. 检查 `cli-config-isolation.ts:26` — 隔离目录在 `/tmp/cat-cafe-cli-isolation/codex-home/`
3. 只复制了 `auth.json` + `config.toml`，没有处理 `sessions/` 目录
4. Codex CLI 写 session 到 `$HOME/.codex/sessions/YYYY/MM/DD/rollout-xxx.jsonl`
5. 隔离 HOME 下的 session 记录不会出现在真 HOME 下

### 根因

`cli-config-isolation.ts` 的设计初衷是隔离 `~/.codex/AGENTS.md` 防止全局配置覆盖 Cat Cafe 指令 (BACKLOG #36)。但隔离方式是替换整个 `HOME` 环境变量，导致 Codex 的所有基于 HOME 的路径都被重定向，包括 session 存储。

### 影响范围

| 路径 | 期望 | 实际 |
|------|------|------|
| `$HOME/.codex/AGENTS.md` | 隔离 (不加载) | ✅ 正确隔离 |
| `$HOME/.codex/auth.json` | 可用 (认证) | ✅ 已复制 |
| `$HOME/.codex/config.toml` | 可用 (配置) | ✅ 已复制 |
| `$HOME/.codex/sessions/` | 写到真 HOME | ❌ 写到 /tmp (丢失) |

## 修复方案

### 方案: Symlink sessions 目录

在隔离 HOME 中创建 `sessions/` 的 symlink 指向真正的 `~/.codex/sessions/`。

```
/tmp/cat-cafe-cli-isolation/codex-home/.codex/
├── auth.json      ← 复制
├── config.toml    ← 复制
├── sessions/      ← symlink → ~/.codex/sessions/  (NEW)
└── (无 AGENTS.md) ← 隔离目的
```

**优点**:
- 最小改动 (3 行代码)
- AGENTS.md 继续被隔离
- Session 记录写到真 HOME，`codex resume` 可用
- Cat Cafe 内部 resume 也不会因 /tmp 清理而丢失

**放弃的方案**:
- 改用 `-c` 参数覆盖 Codex 配置: AGENTS.md 不是 config.toml 的一部分，无法通过 `-c` 跳过
- 调用后复制 session 文件回真 HOME: 复杂、易出错、race condition
- 不隔离 HOME: AGENTS.md 会覆盖 Cat Cafe 指令 (#36 回归)

## 验证方式

1. **单元测试**: 验证 `getCodexIsolatedHome()` 返回的目录中 sessions 是 symlink
2. **集成验证**: Cat Cafe 调用 Codex 后，`~/.codex/sessions/` 中出现新的 session 记录
3. **终端验证**: `codex exec resume <id>` 和 `codex resume <id>` 都能找到 session
