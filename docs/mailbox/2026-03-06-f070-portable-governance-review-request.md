# Review Request: F070 Portable Governance

## What
F070 实现猫咖方法论的可复制输出。当猫被派遣到外部项目时，自动 bootstrap 治理骨架（managed blocks + skills symlinks + methodology templates），preflight gate 确保治理就绪，Hub UI 显示健康状态。

核心变更（9 commits, 45 tests）：
- Phase A: 治理包类型 + managed block 内容 + 方法论模板 + 注册表
- Phase B: GovernanceBootstrapService + orchestrator 集成 + confirm API + preflight gate
- Phase C: Hub 治理看板 + thread sidebar 状态徽标

## Why
猫咖的猫被派遣到外部项目工作时"失忆"——不知道 3001 端口保留、不知道 Redis 6399 圣域、不知道 SOP。根因：能力注入（MCP sync）≠ 治理继承（skills/SOP/铁律）。

## Original Requirements
> "能够把我们的知识工程 文档如何组织架构 backlog如何治理 feat如何管理 能够带到新的派遣工程，不能只在自己的猫猫咖啡当大王"
> "你们派遣过去仿佛失忆 你们得分析分析为什么"
> "第一次派遣到那个项目你们就得同步过去"
> "首次确认后自动写入"
- 来源：Thread `thread_mmfvoxjjy1hlzh9e` (2026-03-06)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- TD099（hook 归一化）spec 提到并入 Phase A，但实施计划 11 个 task 不含 hook 同步——预留了 bootstrap 扩展点，hook 归一化作为后续增量
- 任务态上下文注入（spec Phase B 第 6 点）未实现——需要 SystemPromptBuilder 修改，属于后续增量
- 选择了分区控制模型（猫咖管方法论，外部项目管自己的 backlog），而非全量镜像

## Open Questions
1. `GovernanceBootstrapService` 的 symlink 策略是 project-level（`.claude/skills/` → `cat-cafe-skills/`），与现有 user-level symlink 不同——reviewer 请确认是否有冲突风险
2. preflight gate 在 `invoke-single-cat` 中使用 `system_info` yield 阻断——是否需要更显式的错误 UI？
3. capabilities route 文件已 890 行（接近 limit），governance 端点是否应该独立为 `governance.ts` route？

## Next Action
请审查代码质量、安全边界、回归风险。特别关注：
- managed block 的写入/替换逻辑（是否有边界 case 会丢数据）
- preflight gate 的 fail-closed 语义
- registry JSON 文件的并发安全

## 自检证据

### Spec 合规
19/19 AC 全部覆盖（见 quality gate report）。愿景覆盖 5/5 原始需求。

### 测试结果
```
node --test test/governance/*.test.js  → 45 passed, 0 failed
pnpm --filter @cat-cafe/api build      → exit 0
pnpm lint                              → 0 new errors
npx biome check (F070 files)           → 0 errors
```

### 相关文档
- Spec: `docs/features/F070-portable-governance.md`
- Plan: `docs/plans/2026-03-06-f070-portable-governance.md`
- Feature: F070 / BACKLOG

### 变更文件清单
**新增（api/src/config/governance/）:**
- `governance-pack.ts` — managed block 内容 + 版本 + checksum
- `methodology-templates.ts` — 方法论骨架模板
- `governance-registry.ts` — 派遣注册表
- `governance-bootstrap.ts` — 核心 bootstrap 引擎
- `governance-preflight.ts` — preflight gate

**修改:**
- `packages/shared/src/types/capability.ts` — 治理类型定义
- `packages/api/src/config/capabilities/capability-orchestrator.ts` — tryGovernanceBootstrap
- `packages/api/src/routes/capabilities.ts` — confirm + health API
- `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts` — preflight gate
- `packages/web/src/components/CatCafeHub.tsx` — 治理看板 tab
- `packages/web/src/components/HubGovernanceTab.tsx` — 治理健康表格
- `packages/web/src/components/ThreadSidebar/SectionGroup.tsx` — 状态徽标
- `packages/web/src/components/ThreadSidebar/ThreadSidebar.tsx` — 治理健康 fetch

**测试（7 test files, 45 tests）:**
- `test/governance/governance-pack.test.js` (8)
- `test/governance/methodology-templates.test.js` (6)
- `test/governance/governance-registry.test.js` (8)
- `test/governance/governance-bootstrap.test.js` (10)
- `test/governance/governance-integration.test.js` (6)
- `test/governance/governance-confirm.test.js` (3)
- `test/governance/governance-preflight.test.js` (4)
