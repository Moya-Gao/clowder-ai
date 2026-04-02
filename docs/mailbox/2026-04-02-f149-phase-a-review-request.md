# Review Request: F149 Phase A — ACP Runtime Boundary + Baseline

## What

F149 Phase A: 边界收敛 + 量化基线。把 ACP 从"能不能接"收敛为"运行时运营层怎么设计"。

核心交付物：
1. **AcpClient** — NDJSON-over-stdio ACP transport client（`packages/api/src/.../acp/AcpClient.ts`, 307 lines）
2. **ACP Types** — 完整协议类型定义（`types.ts`, 238 lines, 覆盖所有 JSON-RPC methods + streaming events）
3. **OQ-6 MULTIPLEX 验证** — 单进程双 session 并发 prompt，无 cross-contamination → `supportsMultiplexing=true`
4. **Provider profile** — `cat-config.json` 新增 `acp` section（command, startupArgs, mcpWhitelist）
5. **Boundary table** — F149 vs F143/F053/F115/F118/F050 职责边界

Commits on `feat/f149-acp-runtime`:
- `463ebbceb` feat(F149): ACP types, client, and protocol spike
- `b50b1e094` feat(F149): OQ-6 concurrency experiment — MULTIPLEX verified
- `9fb69c504` docs(F149): Phase A done — boundary table, AC, KD-10, provider profile
- `9399c73e0` style(F149): fix biome format in OQ-6 experiment script

## Why

铲屎官明确要求把 F149 搞起来。Phase A 是边界收敛 + 基线量化阶段：
- 搞清楚 F149 不是又一个 F143（不重谈 protocol-agnostic kernel）
- 搞清楚 ACP 并发模型（single-flight vs multiplex），直接决定 Phase C 池化策略
- 固化 provider profile 让实验可复现

## Original Requirements（必填）

> "10个thread 烁烁可不是随时都需要参加的啊。"
> "今天可能一共开了20个甚至更多thread。"
> "砚砚的想法还是一个脚手架不是最终状态。"
> "我们要支持acp这个协议 支持烁烁acp接入 其实 codex 和claude code也支持这个协议。"
> "接入其他 ACP agent 会比今天快很多，这是可以拍板的；但不会神奇到所有 ACP agent 都只改一行配置"

- 来源：`docs/features/F149-acp-runtime-operations.md` Why section + 铲屎官对话 2026-03-31/04-01
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **放弃了 `promptRaw` async generator**：原设计有一个流式 yield 接口，实现时发现 callback→generator 桥接复杂且 Phase A 不需要实时 UI。保留 `promptCollect`（收集所有 events 后返回）作为 Phase A 接口，Phase B 再加流式。
- **放弃了正式 3-run 基线测量**：spike 已给出 single-run 数据（cold ~9.6s, newSession ~1.3s, first chunk ~4.6s），Phase B 集成后再做正式多 run 基准更有意义。
- **OQ-6 实验用简单 prompt 验证 multiplex**：不做复杂工具调用场景的并发（那是 Phase C 的事）。

## Open Questions

请 reviewer 特别关注：
1. **AcpClient.ts 307 行** — 接近 200 行警告线但未到 350 硬上限。Phase B 加流式会让它更长。现在拆 vs Phase B 拆？
2. **types.ts 的 `AcpProviderProfile`** — 是否应该在这里定义还是留给 cat-config schema？
3. **`handleAgentRequest` auto-approve** — Phase A 的 yolo mode，Phase B 需要正式权限策略。当前实现是否合理过渡？
4. **Boundary table 完整性** — F149 vs F143/F053/F115/F118/F050 的边界划分是否准确？

## Next Action

请跨 family review Phase A 代码 + spec 更新。重点关注：
- AcpClient 协议实现的正确性（JSON-RPC 2.0 compliance, error handling, close race fix）
- types.ts 与实际 ACP 协议的一致性
- Boundary table 的准确性和完整性
- 实验脚本的严谨性（OQ-6 并发判定逻辑）

Review-Target-ID: f149
Branch: feat/f149-acp-runtime

## 自检证据

### Spec 合规
AC-A1~A5 全部 ✅（boundary table + baseline scripts + MULTIPLEX verdict + cloud consults + provider profile）

### 测试结果
```
node --test packages/api/test/acp/acp-client.test.js → 5/5 pass (7ms)
pnpm lint → 0 errors
pnpm check → 0 errors
pnpm -r --if-present run build → exit 0
```

### 相关文档
- Feature: `docs/features/F149-acp-runtime-operations.md`
- Plan: `docs/plans/2026-04-02-f149-phase-a-boundary-baseline.md`
- Research: `docs/research/2026-03-31-f149-acp-runtime-operations-gpt-pro-consult.md`
- Research: `docs/research/2026-03-31-f149-acp-runtime-operations-gemini-deepthink-consult.md`

---
Author: 布偶猫🐾 (@opus)
