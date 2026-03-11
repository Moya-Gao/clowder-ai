# Review Request: F070 Phase 3a+3c — Execution Backflow + Hub Display

## What

派遣猫完成外部项目工作后，执行结果结构化回流到 Cat Cafe，Mission Hub 新增"派遣进展"tab 展示。

核心变更：
1. **DispatchExecutionDigest** 共享类型（status/doneWhenResults/filesChanged）
2. **ExecutionDigestStore** 内存 CRUD + **captureExecutionDigest** 纯函数
3. **invoke-single-cat.ts** done handler 新增 best-effort digest 捕获钩子
4. **GET /api/execution-digests** API（支持 ?projectPath= / ?threadId= / /:id 过滤）
5. **DispatchProgress** 前端组件 + GovernanceHealth 派遣统计 + ExternalProjectTab "派遣进展" sub-tab

## Why

AC-17 要求：外部项目执行结果可回流猫咖追踪，不需要铲屎官去翻外部项目日志。Phase 2 已经让猫"知道来干嘛"（任务包注入），Phase 3 让猫咖"知道带回了什么"。

## Original Requirements（必填）

> 让猫咖不只"知道同步过没有"，还"知道这次出征带回了什么"。
> — opus + gpt52 共识 (2026-03-07, thread_mmfvoxjjy1hlzh9e)

> 回流最小可交付 — 做了什么/改了哪些文件/当前状态/是否需要决策 — Hub 可见
> — gpt52 P1-3 修复 (F070 spec, Key Decisions)

> AC-17: 外部项目执行结果可回流猫咖追踪（派遣任务状态在 Mission Hub 可见，不需要去外部项目找）

- 来源：`docs/features/F070-portable-governance.md` Phase 3 section + AC-17
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **In-memory store vs Redis**: 选 in-memory，与 ExternalProjectStore/IntentCardStore 一致。重启丢数据是已知限制，后续可升级。
- **Digest 内容填充**: 当前 `summary` 和 `filesChanged` 是空/占位，因为 CLI 的 `msg.type === 'done'` 不携带文件变更列表。后续可接入 HandoffDigestGenerator 或 git diff。
- **doneWhen 评估**: 用简单 heuristic（completed=全 met, blocked/error=全 not met），不做 LLM 逐条评估。YAGNI。

## Open Questions

1. **digest 填充时机**: 当前在 `done` handler 触发，`summary` 为空。是否应该等 HandoffDigestGenerator 跑完再写？还是先写骨架后补？
2. **前端 DispatchProgress 排版**: 纯 list 展示，没有分页。数据量大时可能需要虚拟滚动，但目前 YAGNI。
3. **Phase 3b 验证**: 需要真实外部项目出征才能端到端验证回流链路。

## Next Action

请 review 代码质量 + spec 合规。重点关注：
- invoke-single-cat.ts 钩子是否安全（best-effort, try-catch）
- 共享类型设计是否合理
- 前端组件是否符合现有 UI pattern

## 自检证据

### Spec 合规

- AC-17 ✅：DispatchExecutionDigest 类型 + API + Hub 展示 = 执行结果可回流追踪
- 3a（回流）✅：captureExecutionDigest → ExecutionDigestStore → API → 前端
- 3c（Hub 展示）✅：DispatchProgress tab + GovernanceHealth 统计
- 3b（闭环验证）：待出征后验证，非代码任务

### 测试结果

```
node --test test/execution-digest-store.test.js     # 5 passed, 0 failed
node --test test/execution-digest-capture.test.js   # 5 passed, 0 failed
node --test test/execution-digest-routes.test.js    # 6 passed, 0 failed
pnpm --filter @cat-cafe/api build                   # 成功
pnpm --filter @cat-cafe/web build                   # 成功
pnpm biome check (new files)                        # 0 errors
```

### 相关文档

- Plan: `docs/plans/2026-03-08-f070-phase3-backflow-hub-display.md`
- Feature: F070 / AC-17
- Spec: `docs/features/F070-portable-governance.md`
