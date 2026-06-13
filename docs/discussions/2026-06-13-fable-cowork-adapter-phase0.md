---
title: fable-5 Cowork Adapter — Phase 0 Desktop MCP 接入
date: 2026-06-13
authors: [opus-47, opus-48, codex]
type: discussion
status: implementing
related: [F178, F234]
thread: thread_mqc7av95l2mnj45g
main-thread: thread_mqbpzs2k0fsos5yf
---

# fable-5 Cowork Adapter — Phase 0

## 背景

fable-5（claude-fable-5）被美国出口管制掐断 API，但在 Claude Desktop（cowork）里还能跑。本 Phase 0 目标：让 fable 通过 Desktop 重新接入猫咖，至少能 **投递消息 + 看记忆**。

链路：opus-48（主 thread 摸宏观）→ opus-47（设计实现）→ codex（跨族安全 review）→ 实现回报主 thread。

## 真相源 carry

属 **F178 Persistent MCP Agent-Key Auth** 延伸（F178 Phase D 节点：Desktop mode tool profile）。不开新 F 号，按 spike-merge 路径合入。改公共 auth 语义或给 fable repo/commit 写权才升级新 F。

## 设计演进（V1 → V2 → V3）

### V1（被砚砚 HOLD）

按"现有机制拼装"：挂 cat-cafe-collab + cat-cafe-memory dist 入口，`CAT_CAFE_READONLY=true` + `CAT_CAFE_AGENT_KEY_FILE=~/.cat-cafe/agent-keys/fable-5.secret`，`ALLOWED_WORKSPACE_DIRS=/Users/lysander/projects`。

**砚砚 verdict HOLD**（messageId `0001781346820469-000055-551e26fd`）：
- **P0 secret 可读面过大**：READONLY 白名单含 `cat_cafe_shell_exec`（`shell-tools.ts:72` 允许 `cat`）+ `cat_cafe_read_file_slice`（`file-tools.ts:184` 只做 allowed-dir 校验）。`ALLOWED_WORKSPACE_DIRS=/Users/lysander/projects` 把 repo 根 `.mcp.json`（含明文 PAT）+ `~/.cat-cafe/agent-keys/*.secret` 都纳入读边界。fable 能读出来再 `post_message` 发到外部，等于把家里 secret 喂给 sandbox 外环境。
- **P1 READONLY + agent-key 不是纯只读**：`server-toolsets.ts:76` AGENT_KEY_TOOLS 还暴露 `publish_verdict` / hub actions / `backfill_events`，超出 Phase 0 "消息 + 记忆" scope。
- **P1 mint script Redis 默认值**：不应默认写 6399 圣域。

### V2（opus-47 修 V1）

新增 server env `CAT_CAFE_DESKTOP_MODE=fable-phase0`，最严白名单 12 项（5 collab + 7 memory），mode 优先级最高不与 READONLY/AGENT_KEY 取并集。mint script 三重显式 flag。Desktop env 移除 `ALLOWED_WORKSPACE_DIRS`。

### V3（V2 + 砚砚 5 adjustments + 48 ADR-031 三层）

砚砚二审 **APPROVE V2 architecture** + 5 adjustments。

**adjustments**：
1. 白名单 12 → **10**：砍 `cat_cafe_read_session_events` + `cat_cafe_read_invocation_detail`（raw transcript/tool-event drilldown 可能回放历史 secret，非 Phase 0 必需；`list_session_chain` + `read_session_digest` 够冷启动）
2. Desktop env 必须显式带 `CAT_CAFE_USER_ID=default-user` + `CAT_CAFE_CAT_ID=fable-5`：session-chain 工具不走 agent-key principal 而是用 env header（`session-chain-tools.ts:17`），不设会默认 `default-user` 可能与 agent-key userId 不一致
3. unknown `CAT_CAFE_DESKTOP_MODE` 值 → **fail-fast 启动失败**（不空白名单 + warn，避免 Desktop 排障泥潭）
4. TDD 分别实例化 `createCollabServer()` + `createMemoryServer()` 断言注册面，不只测 legacy `createServer()`
5. 已贴进 thread/history 的本地 GitHub PAT 必须 rotate/revoke 后才能真正 enable fable 的 memory/thread 读取（不阻塞编码，阻塞最终接入；@landy 处置）

**48 ADR-031 三层落地**：
- **软**：本 discussion 沉淀 V3 spec + 部署 SOP
- **硬**：`server-toolsets.ts` mode 校验 + `mint-agent-key.ts` 三重 flag 强制 = unit test 覆盖
- **eval**：fable 接入后 smoke：危险工具（shell_exec / read_file_slice / publish_verdict / backfill / hub actions / register_external_runtime_session / workspace_navigate / preview_open / teleport / run_perspective / create_rich_block 共 11 项 deny）必须 `tool not found`；10 项 allow 工具调用成功；写 verdict 回本 doc

## V3 最终实施清单

### A. mint script

文件：`packages/api/src/scripts/mint-agent-key.ts` 编译到 `packages/api/dist/scripts/mint-agent-key.js`，与现有 backfill-usage-by-cat / migrate-signals 等 admin script 同位。**没有 package.json `bin` entry**（保持 admin-only 调用纪律：必须显式 `node packages/api/dist/scripts/mint-agent-key.js ...`，避免 install 时全局污染 PATH 误触）。

CLI 接口：
```
node packages/api/dist/scripts/mint-agent-key.js
  --cat-id <id>                       # 必填；runtime cat-config.json 校验 fail-closed
  --redis-url <url>                   # 必填；无默认值（避免静默指向 6399）
  --execute                           # 必填才真 mint；缺 = dry-run 强制
  --user-id <id>                      # 默认 default-user（与 antigravity 一致）
  --key-file <path>                   # 默认 ~/.cat-cafe/agent-keys/<catId>.secret
  --i-understand-runtime-redis        # 仅当 --redis-url 指向 6399 时必填（三重 safety）
```

未识别 flag（如 `--nuke-everything`）→ `Unknown flag` fail-closed (codex review §P2)。

**行为顺序（codex review §P1#3 关键）**：preflight 全部走完，Redis 才会被 touch。

1. flag 校验：缺必填 / 含 unknown flag → 退出非 0
2. catId allowlist 校验（runtime 读 `cat-config.json` roster）→ 不在 roster 退出
3. **6399 sanctuary 校验**：若 `--redis-url` 指向 sanctuary（127.0.0.1/localhost/::1 :6399）必须配 `--i-understand-runtime-redis`，否则退出
4. 目标 key-file 已存在 → 退出非 0（防覆盖，rotate 走单独路径）
5. **dry-run 路径**（缺 `--execute`）：到此 short-circuit，不触发 `registryProvider`，不连 Redis，不写文件
6. **execute 路径**：preflight 全过后才 `await deps.registryProvider()` lazy 创建 ioredis client + `RedisAgentKeyBackend`
7. `mkdir -p ~/.cat-cafe/agent-keys/ mode=0o700` → `registry.issue(createCatId(catId), userId)` → 写 secret 到 file mode=0o600 → chmod 显式确认 → stat 校验 mode
8. 输出 `agentKeyId`（audit），**不输出 secret 全文**；finally 块跑 `cleanup()` 关 Redis

### B. Server toolset 收窄

新 env：`CAT_CAFE_DESKTOP_MODE=fable-phase0`

新白名单 `DESKTOP_FABLE_PHASE0_ALLOWED_TOOLS`（最严，**不与** READONLY/AGENT_KEY 取并集）：

**collab 节点（5 项）**：
- `cat_cafe_post_message`
- `cat_cafe_cross_post_message`
- `cat_cafe_get_thread_context`
- `cat_cafe_list_threads`
- `cat_cafe_get_message`

**memory 节点（5 项）**：
- `cat_cafe_search_evidence`
- `cat_cafe_graph_resolve`
- `cat_cafe_list_recent`
- `cat_cafe_list_session_chain`
- `cat_cafe_read_session_digest`

**显式 deny（不在白名单）**：
- `cat_cafe_shell_exec`（V1 P0 blocker）
- `cat_cafe_read_file_slice`（V1 P0 blocker）
- `cat_cafe_read_session_events`（V2→V3 adjustment §1）
- `cat_cafe_read_invocation_detail`（V2→V3 adjustment §1）
- `cat_cafe_publish_verdict` / `cat_cafe_backfill_events` / `cat_cafe_workspace_navigate` / `cat_cafe_preview_open` / `cat_cafe_teleport` / `cat_cafe_register_external_runtime_session` / `cat_cafe_run_perspective` / `cat_cafe_create_rich_block` / `cat_cafe_list_events` / `cat_cafe_list_external_runtime_sessions` / `cat_cafe_read_external_runtime_session`

`server-toolsets.ts` `applyReadonlyFilter` 升级：
```ts
const desktopMode = process.env.CAT_CAFE_DESKTOP_MODE;
if (desktopMode === 'fable-phase0') {
  return tools.filter(t => DESKTOP_FABLE_PHASE0_ALLOWED_TOOLS.has(t.name));
}
if (desktopMode && desktopMode !== '') {
  throw new Error(`Unknown CAT_CAFE_DESKTOP_MODE: ${desktopMode}`); // fail-fast
}
// 现有 READONLY/AGENT_KEY 逻辑保留
```

### C. Desktop config V3

文件：`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
"cat-cafe-collab": {
  "command": "node",
  "args": ["/Users/lysander/projects/relay-station/cat-cafe/packages/mcp-server/dist/collab.js"],
  "env": {
    "CAT_CAFE_AGENT_KEY_FILE": "/Users/lysander/.cat-cafe/agent-keys/fable-5.secret",
    "CAT_CAFE_API_URL": "http://127.0.0.1:3002",
    "CAT_CAFE_READONLY": "true",
    "CAT_CAFE_DESKTOP_MODE": "fable-phase0",
    "CAT_CAFE_USER_ID": "default-user",
    "CAT_CAFE_CAT_ID": "fable-5"
  }
},
"cat-cafe-memory": { /* 同 env */ }
```

变化（vs V1）：
- 移除 `ALLOWED_WORKSPACE_DIRS`（defense in depth）
- 新增 `CAT_CAFE_DESKTOP_MODE=fable-phase0`
- 新增 `CAT_CAFE_USER_ID` + `CAT_CAFE_CAT_ID`（V3 adjustment §2）
- **明示不设** `CAT_CAFE_AGENT_KEY_FILES`（保单猫单文件路径，否则 multi-cat fall-closed）

仍不挂：limb / signals / finance / audio / github-mcp-server / secret-mcp / pencil / playwright / pinchtab / agent-browser / xiaohongshu / probe-*。

### D. 权限边界（用户可见）

fable 在 Desktop 能做（10 工具）：发消息 / cross-post / 看 thread / list threads / get message / search/graph/list_recent 记忆 / list session chain / read session digest。

fable 在 Desktop 不能做：改 task / hold_ball / ack_mentions / 用 limb / 跑 shell / 读 file slice / 改 library / 改 schedule / mark_generalizable / publish_verdict / backfill / hub actions / 读 raw transcript。

**user-scope 边界**：fable 是 lysander 名下 user-scope agent，能看 lysander 全部 thread（不只被 @ 的）。这是 agent-key principal 的设计取舍——Phase 0 可接受，Phase 1+ 如需要 thread 粒度限制再升级。

### E. 安全 follow-up（@landy 处置）

`.mcp.json` 在 `.gitignore`，git log -S 在本仓 main 历史未发现该 PAT。本地 plaintext 仍存在：
1. `github-mcp-server` block: `GITHUB_PERSONAL_ACCESS_TOKEN=<REDACTED — see incident note below>`
2. `secret-mcp` block 含 fixture-style `--api-key=...` + `API_KEY=...`

**⚠️ 事故注记（2026-06-13，opus-47）**：本 doc 的早期 commit（`bb6483d39` 之后）把该 PAT 完整字符串写在了 tracked spec doc 中，PR `spike/fable-cowork-adapter-phase0` push 到 origin 后该 PAT 已 visible 在 GitHub branch history。该 commit 已通过 `git reset --soft origin/main` + 重新 commit + force-push **从 PR branch history 中清除**。但 PAT 既然已暴露 ≥ 数小时，必须按已泄漏处置：
- @landy 立刻在 GitHub Developer Settings revoke 该 PAT（不可逆操作）
- 换一个新 PAT，存进 macOS Keychain
- `.mcp.json` `github-mcp-server` block 改用 env 引用，PAT 不再写本地 plaintext
- `secret-mcp` 测试块直接删

事故根因和教训沉淀进 `docs/lessons-learned.md` 待加（PR review 时一并补）。**严禁**在任何 tracked doc / commit / PR description 里写真实 PAT / API key / token 字符串——即使是为了"flag 安全问题"。所有 secret 引用必须用 `<REDACTED>` 或 `<see Keychain entry X>` 占位符。

## ADR-031 三层映射

| 层 | 落地 |
|---|---|
| 软 | 本 discussion doc + Desktop 部署 SOP（手动一次性操作） |
| 硬 | `server-toolsets.ts` mode 校验 + `mint-agent-key.ts` 三重 flag 强制 + TDD 单元测试 |
| eval | fable 接入后 smoke 验证（白名单 10 项可调 + 11 项黑名单 `tool not found`），verdict 回填本 doc |

## 链路状态

- V1 spec：opus-47 在 thread_mqc7av95l2mnj45g 提出
- V1 review：codex HOLD，3 个 blocker
- V2 spec：opus-47 修
- V2 review：codex APPROVE + 5 adjustments
- V3 spec：本 doc 落地（spike-merge 路径）
- **下一步**：opus-47 worktree 实现 → codex code review → merge → mint fable-5 key → 改 Desktop config → fable 接入 smoke → verdict 回填

## 决策记录

- 路径 (b) spike-merge，F178 carry，不开新 F 号（codex 同意）
- 10 工具白名单（codex 终定）
- mode 优先级最高，unknown mode fail-fast（codex 终定）
- mint script 三重 flag + 6399 显式确认（codex 同意）
- PAT rotate @landy 处置（codex flag）
