# Review Request: F152 Phase B — Expedition Bootstrap Orchestrator

Review-Target-ID: f152-phase-b
Branch: feat/f152-phase-b

## What

完整的 Expedition Bootstrap 编排器：当猫进入外部项目时自动冷启动记忆索引。包括：

- **后端**：index_state 五态状态机（schema V11）、ExpeditionBootstrapService（结构化摘要 + 安全护栏）、3 个 API 端点 + WebSocket 进度推送、F070 治理链路挂载
- **前端**：5 个 React 组件（BootstrapPromptCard / ProgressPill / SummaryCard / Orchestrator）+ useIndexState hook + ChatContainer 集成
- **测试**：47 后端测试（状态机 19 + 服务 17 + 路由 7 + E2E 4）+ 27 前端测试

## Why

F152 核心目标：让猫猫能作为 FDE 进入任意已有项目并快速理解上下文。Phase B 是用户可见的编排层——从"进入项目"到"记忆就绪"的完整路径。

## Original Requirements（必填）

> "社区小伙伴使用你们，大概率不是开发你们，而是用你们开发其他项目。别人是让你们去做他们自己的项目，甚至别人的项目未必从零开始。这才是他们的痛点。"
> — 铲屎官 2026-04-08

- 来源：`docs/discussions/2026-04-08-f152-design-gate/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 颜色系统从设计稿的紫色 (#7C3AED) 改为珊瑚色 (cocreator-primary #e29578)——铲屎官 Design Gate 明确要求（KD-16）
- 摘要卡保留绿色成功主题（与 ProjectSetupCard done 状态一致）
- SummaryCard 的 CTA 按钮只保留 dismiss，搜索/MemoryHub 按钮留到 Phase C 集成

## Open Questions

1. **KD-17 前端验证**：铲屎官要求 reviewer 必须 launch dev 并截图验证前端。请在 review 沙盒中启动开发服务器实际查看三个 UX 场景
2. **场景 A 自动衔接**：`BootstrapOrchestrator` 的 `useEffect` auto-start 逻辑——是否需要额外的 debounce/guard？
3. **安全护栏覆盖度**：symlink escape + secrets exclusion + binary skip + depth/budget limits，是否有遗漏的攻击面？

## Next Action

请 review 代码质量 + AC 覆盖 + 安全护栏。涉及前端组件，请务必启动开发服务器截图验证。

## 自检证据

### Spec 合规

| # | AC | 状态 | 代码位置 | 测试覆盖 |
|---|-----|------|----------|----------|
| B1 | 无 evidence.sqlite 时自动触发 | ✅ | IndexStateManager.shouldBootstrap | index-state-manager.test.js |
| B2 | 产出项目概况摘要 | ✅ | buildStructuralSummary() | expedition-bootstrap-service.test.js |
| B3 | 幂等性 | ✅ | fingerprint check in bootstrap() | expedition-bootstrap.test.js E2E |
| B4 | 挂载 F070 治理链路 | ✅ | projects-setup.ts fire-and-forget | projects-bootstrap-route.test.js |
| B5 | fingerprint 基于 HEAD+scanTime | ✅ | getFingerprint dep injection | index-state-manager.test.js |
| B6 | 结构化提取不强依赖 LLM | ✅ | buildStructuralSummary 纯 fs | expedition-bootstrap-service.test.js |
| B7 | index_state 五态状态机 | ✅ | schema V11 + IndexStateManager | index-state-manager.test.js 19 tests |
| B8 | 老用户提示确认卡 | ✅ | BootstrapPromptCard | bootstrap-components.test.tsx |
| B9 | 新项目自动串联 | ✅ | BootstrapOrchestrator useEffect | bootstrap-orchestrator.test.tsx |
| B10 | 非阻塞扫描+进度 | ✅ | WebSocket + BootstrapProgressPill | bootstrap-components.test.tsx |
| B11 | 摘要卡交互 | ✅ | BootstrapSummaryCard | bootstrap-components.test.tsx |
| B12 | 安全护栏 | ✅ | isInsideProject/isSecretFile/budget | expedition-bootstrap-service.test.js |

### 设计稿对照

glob `designs/**/*.pen` 匹配：`F152-expedition-bootstrap.pen`
对照状态：✅ 已对照。布局/结构/内容/状态流程匹配。唯一偏差：紫→珊瑚色（铲屎官 KD-16 明确要求）。

### Artifact Hygiene

仓库根目录媒体/设计工件（工作树 + 已提交差异）: 无 ✅

### 测试结果

```
REDIS_URL= pnpm --filter @cat-cafe/api test  → 7382 passed, 0 failed ✅
pnpm --filter @cat-cafe/web test              → all passed ✅
pnpm lint                                     → 0 errors ✅ (warnings are pre-existing hardcoded colors)
pnpm check                                    → 0 errors ✅
pnpm -r --if-present run build                → exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F152-expedition-memory.md`
- Plan: `docs/plans/2026-04-10-f152-phase-b.md`
- Design Gate: `docs/discussions/2026-04-08-f152-design-gate/README.md`
- Design: `designs/F152-expedition-bootstrap.pen`
