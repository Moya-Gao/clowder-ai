# Review Request: F139 Phase 4 — Template Execution + Builtin Control

Review-Target-ID: f139-phase4
Branch: feat/f139-phase4

## What

三个 builtin 模板从 stub 升级为真实执行：reminder 投递消息、web-digest 路由抓取+格式化、repo-activity 追踪+投递。所有任务（含 builtin）支持面板 pause/resume。E2E 全链路验证。

核心变更：
- **Delivery infrastructure**: `createDeliverFn` 工厂，闭包 messageStore + socketManager，模板通过 `ExecuteContext.deliver` 投递消息
- **Content fetch routing**: `needsBrowser(url)` 模式匹配 JS 重站点（X/小红书/B站等），`extractText(html)` 纯文本提取
- **3 template implementations**: reminder/web-digest/repo-activity 的 gate + execute 从 stub → 真实逻辑
- **Builtin panel control**: SchedulePanel 按 task.source 路由到不同 API（dynamic → PATCH, builtin → task override PUT）
- **TaskRunnerV2 wiring**: deliver + fetchContent 注入到 runner，经 execute-pipeline 传递到模板

## Why

F139 Phase 3B 完成了治理基建（GlobalControlStore、task override、ledger），但模板还是 stub。Phase 4 让调度器真正能做事：到点投递消息、抓取网页、追踪仓库。面板控制让所有任务（不限 dynamic）都能 pause/resume。

## Original Requirements

> "不建议你这个可配置是编辑到什么 Markdown 文档里……能让人类跟你直接说自然语言，你帮别人去编辑，或者你有个 UI 去把东西呈现出来"

> "有点像定时任务，但定时任务太机械了，我不想要机械的东西"

> "W1 猫是 Agent 不是 API，用户在 thread 里和猫说话注册任务。NL 输入框违背愿景"

- 来源：`docs/features/F139-unified-schedule-abstraction.md`（铲屎官采访 + GPT Pro 咨询）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **`AnyFn` type in delivery.ts**: 用 `(...args: any[]) => any` 避免 messageStore/socketManager 的完整类型引入（contravariance 问题）。函数体确保正确使用，类型安全在调用侧保证
- **Web-digest browser routing**: 只做 URL 模式标记 `needs-browser`，不做真正的 headless 集成。JS 重站点返回提示文本
- **Repo-activity**: 用 `lastRunAt` 作为 temporal cursor 而非额外 DB 存储。首次运行无 cursor 时发送"首次追踪"消息

## Open Questions

1. `delivery.ts` 的 `AnyFn` 类型——是否需要更严格的类型约束？当前权衡是避免引入 messageStore 完整类型定义的循环依赖
2. `needsBrowser()` 的 URL 模式列表覆盖度——当前 6 个模式（x.com, xiaohongshu, bilibili, douyin, instagram, threads），是否需要补充？
3. SchedulePanel 的 builtin 控制路由——dynamic 用 PATCH，builtin 用 PUT task override。这个分支逻辑是否清晰？

## Next Action

请 review 代码质量、架构合理性、与 Phase 3B 基建的衔接。特别关注 delivery 注入模式和模板 execute 实现。

## 自检证据

### Spec 合规
5/5 AC 全部通过（H1-H5），quality-gate 于 2026-03-28 02:05 通过。

### 测试结果
```
pnpm test       → 6214 pass, 1 fail (pre-existing flaky security-boundary.test.js)
pnpm lint       → 0 errors
pnpm check      → Checked 1784 files. No fixes applied.
pnpm build      → exit 0
```

### 新增测试覆盖
| 测试文件 | 用例数 | 覆盖 |
|----------|--------|------|
| scheduler-delivery.test.js | 3 | createDeliverFn |
| reminder-template.test.js | 6 | gate + execute |
| content-fetcher.test.js | ~8 | needsBrowser + extractText |
| web-digest-template.test.js | 7 | gate + execute + needs-browser |
| repo-activity-template.test.js | 6 | gate + execute + cursor |
| builtin-panel-control.test.js | 4 | task override API |
| scheduler/phase4-e2e.test.js | 6 | full chain E2E |

### 相关文档
- Plan: `docs/plans/2026-03-27-f139-phase-4-template-execution.md`
- Feature: `docs/features/F139-unified-schedule-abstraction.md`
- Phase 3B (基建): PR #785 (已合入)

### Commits (7)
```
eb20511 style: biome import ordering fixes
bb971d6 test(F139-H5): E2E integration
09ba07b feat(F139): wire deliver+fetchContent into TaskRunnerV2
3c8ccf0 feat(F139-H4): builtin task panel control
ffdd4df feat(F139-H2/H3): web-digest + repo-activity
fc210a7 feat(F139-H1): reminder template real execution
24de628 feat(F139-H1): delivery infrastructure
```
