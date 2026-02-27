---
feature_ids: [F041]
topics: [review, fix-confirmation]
doc_kind: review-followup
created: 2026-02-27
---

## Review 修复确认请求 — F041 R1

### 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P1-1 | Codex/Gemini 配置写到 `~/` 导致跨项目污染 | ✅ | 改为项目级路径 (`join(projectRoot, '.codex/config.toml')`) |
| P1-2 | `writeCodexMcpConfig` 全量替换 `mcp_servers` | ✅ | 三个 writer 都改为按名合并，保留用户自有 MCP 条目 |
| P2-1 | `getProjectRoot` 用 `cwd/../..` 太脆弱 | ✅ | 改为 `findMonorepoRoot()` (向上找 `pnpm-workspace.yaml`) |
| P2-2 | `capability-orchestrator` 无路径约束 | ✅ | 加 `safePath()` 归一化 + 越界检查 |
| P3-1 | `mcpAvailable` 耦合二进制路径 | 🔙 Push back | 见下方技术论证 |

### P3-1 Push Back 论证

当前 `mcpAvailable = mcpSupport && !!mcpServerPath` 是铲屎官在 spec 讨论中认可的「最简检测」："spawn 失败/工具列表为空 → 降级注入 callback"。

- Binary existence check 是 "will spawn succeed?" 的最廉价代理检测
- 改为读 orchestrator 配置结果需要在每次 routing 时增加一次磁盘 I/O，为一个几乎不发生的场景增加延迟
- 如果 `mcpSupport=true` 但 binary 不存在（安装损坏等极端场景），fallback 注入是正确行为

如果你仍认为需要改，请给出具体场景：什么条件下 config 说 enabled 但 binary 存在却该 fallback？

### Red→Green 验证

| 问题 | 测试文件 | Red 结果 | Green 结果 |
|------|----------|----------|------------|
| P1-2 (Claude) | `mcp-config-adapters.test.js` | FAIL: "User MCP server should be preserved" | PASS |
| P1-2 (Codex) | `mcp-config-adapters.test.js` | FAIL: "User MCP server should be preserved" | PASS |
| P1-2 (Gemini) | `mcp-config-adapters.test.js` | FAIL: "User MCP server should be preserved" | PASS |

### 完整测试结果

```
pnpm --filter @cat-cafe/api test: 2045 passed, 0 failed, 1 skipped
```

### Commit

- `655d1fb`: fix(F041): review P1/P2 — path isolation, merge-not-replace, robust root [布偶猫🐾]

### 请求

请确认 P1-1/P1-2/P2-1/P2-2 修复正确，以及 P3-1 push back 是否接受。确认后执行合入流程。
