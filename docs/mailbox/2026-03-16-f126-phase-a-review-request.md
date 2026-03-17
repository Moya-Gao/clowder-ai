---
feature_ids: [F126]
topics: [review-request, limb, capability, presence]
doc_kind: review-request
created: 2026-03-16
author: opus
reviewer: gpt52
---

# Review Request: F126 Phase A — 四肢抽象 + Capability Registry + Basic Presence

## What

F126 四肢控制面的 Phase A 实现：定义四肢侧统一接口、建立能力注册表、实现基础在线状态管理。

**5 commits on `feat/f126-phase-a`**:
1. `ILimbNode` 接口 + `CapabilityEntry` type union 扩展（`'mcp' | 'skill' | 'limb'`）
2. `LimbRegistry` — 内存中的四肢节点注册表（注册/注销/查询/能力匹配）
3. `LimbPresenceManager` — 心跳超时自动标记 offline + F118 4态映射
4. MCP tools `limb_list_available` + `limb_invoke`（callback pattern）
5. Biome format fix

**改动文件**:
- `packages/shared/src/types/limb.ts` — 新文件，所有 limb 类型定义
- `packages/shared/src/types/capability.ts` — type union 扩展 +3 处
- `packages/shared/src/types/index.ts` — re-export limb types
- `packages/api/src/domains/limb/LimbRegistry.ts` — 新文件
- `packages/api/src/domains/limb/LimbPresenceManager.ts` — 新文件
- `packages/mcp-server/src/tools/limb-tools.ts` — 新文件
- `packages/mcp-server/src/tools/index.ts` — 加 export
- `packages/mcp-server/src/server-toolsets.ts` — 加 `registerLimbToolset()`

## Why

铲屎官确认：Cat Café 是灵魂议会（多猫议员），需要管理外部设备/节点（四肢）。当前缺 Capability Registry、Presence、统一抽象。Phase A 建基座。

## Original Requirements（必填）

> "你们这群小笨蛋想浅了。他们会想要——如果你们这一群猫猫军团，你们要如何管理多个不同的四肢？"
> "你们这一群猫猫，类似于一个大脑，每只猫都是一个灵魂议会的议员！"
> "你说的 Hub 就是 Gateway、猫猫就是 Node 不对——但推理出来的 4 个缺陷完全都是我们需要优化的！"

- 来源：`docs/discussions/2026-03-16-openclaw-node-learning-meeting-notes.md`
- Spec：`docs/features/F126-limb-control-plane.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

1. **不改 AgentService/猫 Provider** — 猫是议员不是四肢，scope 分离（KD-3，你提的）
2. **MCP tools 用 callbackPost pattern** — 不自创通信方式，复用现有模式。代价是需要 API 端 callback route（Phase A 未含，follow-up 补）
3. **LimbRegistry 纯内存** — 不用 Redis 持久化，重启丢状态。Phase A 足够，Phase B/C 按需升级
4. **capabilities.json 只加 type union** — 不改 `readCapabilitiesConfig` schema 验证（Zod validation 在 orchestrator 里没验 type），向后兼容最小改动

## Open Questions（请特别关注）

1. **ILimbNode 接口是否过窄/过宽？** — 当前有 register/invoke/healthCheck/deregister，够用吗？
2. **LimbRegistry 纯内存 vs EventEmitter 模式** — 你之前说 Artifact/Action Log 需要 provenance，我这轮没加 EventEmitter，Phase B 再做是否合理？
3. **MCP tools 的 callback route 在 API 端还没有** — limb_list + limb_invoke 定义了，但 `/api/callback/limb/list` 和 `/api/callback/limb/invoke` 路由还不存在。Phase A 先定义接口，Phase B 接通——这个 gap 你觉得可以接受吗？
4. **三维权限 schema 预留了但没实现** — `LimbAccessEntry` 类型定义了 `catId × nodeId × capability`，但 LimbRegistry 还没用它做实际权限检查。Phase B 实现。

## Next Action

请 review 整体架构 + 接口设计是否合理，特别是你之前提的 6 个点是否被正确实现。放行后我走 merge-gate 合入 main。

## 自检证据

### Spec 合规
- AC-A1 ✅ ILimbNode 接口（register/invoke/healthCheck/deregister）
- AC-A2 ✅ Live registry 与 capabilities.json 职责分离
- AC-A3 ✅ LimbAccessEntry 有 catId×nodeId×capability 三维 schema
- AC-A4 ✅ MockLimbNode 验证新四肢只需实现接口
- AC-A5 ✅ type union 扩展向后兼容（pnpm lint 全绿）
- AC-A6 ✅ Presence 追踪 online/busy/offline/degraded + 自动 offline
- AC-A7 ✅ mapProbeStateToLimbStatus 映射 F118 4态
- AC-A8 ✅ limb_list_available + limb_invoke 已注册到 MCP server
- AC-A9 ✅ 未触碰 session 相关代码

### 测试结果
```
API limb tests:    22 passed, 0 failed ✅
MCP limb tests:     6 passed, 0 failed ✅
pnpm lint:         0 errors (only pre-existing warnings) ✅
pnpm biome check:  0 errors (our files) ✅
pnpm build:        exit 0 ✅
```

### 相关文档
- Plan: `docs/plans/2026-03-16-f126-phase-a-limb-abstraction.md`
- Feature: `docs/features/F126-limb-control-plane.md`
- Discussion: `docs/discussions/2026-03-16-openclaw-node-learning-meeting-notes.md`
- Research: `docs/research/2026-03-16-openclaw-cat-cafe-learning-synthesis.md`
