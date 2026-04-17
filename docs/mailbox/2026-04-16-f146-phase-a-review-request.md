---
doc_kind: review-request
created: 2026-04-16
---

# Review Request: F146 Phase A — 能力中心写路径 (MCP CRUD)

Review-Target-ID: f146-phase-a
Branch: feat/f146-phase-a

## What

Hub 能力中心新增 MCP 管理写路径：UI 可添加/删除 MCP，无需手改 `capabilities.json`。

核心变更：
- 4 个 API 路由（preview/install/delete/audit）抽离为 Fastify sub-plugin
- `withCapabilityLock` 并发写入互斥（Promise chain per-project）
- `capability-audit.ts` 追加式 JSONL 审计日志
- `buildInstallPreview` 纯函数：构建 entry + 风险分析 + probe 预判
- Hub UI：McpInstallForm（添加）+ CapabilityAuditLog（审计日志查看器）+ CapabilityCard 删除按钮
- 18 个单元/集成测试覆盖全部 AC

## Why

铲屎官明确不接受继续手改 JSON 作为 MCP 新增主流程（2026-03-28）。F145 解决了声明式配置 + CLI 诊断，F146 Phase A 补上"能力中心的写路径"。

## Original Requirements（必填）

> "以后我要新增一个 MCP，是跟你讲我想要一个怎么样的 MCP，然后你接入之后我能看到——不需要我人类自己去编辑。"
>
> "不接受继续手改 `capabilities.json` 作为 MCP 新增主流程"

- 来源：`docs/features/F146-mcp-marketplace-control-plane.md`（铲屎官愿景段落）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 未实现 PATCH /api/capabilities/mcp/:id（更新单个 MCP 字段）——Phase A 用 overwrite install 覆盖，Phase B 再做细粒度更新
- 审计日志用 JSONL 文件而非 Redis/SQLite——Phase A 写量低，文件追加最简单；后续可换存储
- `willProbe` 仅对 stdio+command 的 MCP 触发——resolver/remote 需要额外适配，留到 Phase B

## Open Questions

1. **Lock 粒度**：当前 per-projectRoot Promise chain。如果同一猫高频安装会排队，是否需要更细粒度（per-capability）？
2. **Audit log rotation**：JSONL 无限增长，Phase B 是否需要 rotation/archival？
3. **前端 UI 浏览器验证**：worktree 环境 WebSocket 端口冲突未能完成完整 Hub 点击测试，建议 alpha 验收时补。

## Next Action

请 reviewer：
1. 代码审查（重点关注 lock 正确性、audit 追加原子性、route 参数校验）
2. 对照原始需求判断 AC 覆盖
3. 如有 P1 问题请标注，P2 可标注后续跟进

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f146-phase-a/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（禁止 3001/3002/3011/3012/4111）

## 自检证据

### Spec 合规

AC-A1~A6 全部覆盖，逐项验证通过。详见 quality-gate report（本会话内）。

| AC | 状态 | 代码 | 测试 |
|----|------|------|------|
| A1: Hub add MCP | ✅ | McpInstallForm.tsx, capabilities-mcp-write.ts:58-131 | capability-install-preview.test.js |
| A2: Hub delete MCP | ✅ | HubCapabilityTab.tsx:124-147, capabilities-mcp-write.ts:134-193 | capability-install-integration.test.js |
| A3: Auto generateCliConfigs + probe | ✅ | capabilities-mcp-write.ts:105,117-123 | integration test |
| A4: Audit log | ✅ | capability-audit.ts, CapabilityAuditLog.tsx | capability-audit.test.js (4 tests) |
| A5: Concurrent write safety | ✅ | capability-orchestrator.ts:withCapabilityLock | capability-write-lock.test.js (3 tests, 10-way race) |
| A6: Install preview | ✅ | capability-install.ts:buildInstallPreview | capability-install-preview.test.js (6 tests) |

### 测试结果

```
F146 capability tests: 18 pass, 0 fail ✅
pnpm --filter @cat-cafe/api run build: exit 0 ✅
pnpm --filter @cat-cafe/web run build: Compiled with warnings (pre-existing only) ✅
pnpm check: Checked 2271 files. No fixes applied. ✅
```

### 相关文档

- Feature: `docs/features/F146-mcp-marketplace-control-plane.md`
- Plan: `docs/plans/2026-04-16-f146-phase-a-capability-write-path.md`
- Joint Roadmap: `docs/plans/2026-04-04-f129-f146-joint-roadmap.md`
