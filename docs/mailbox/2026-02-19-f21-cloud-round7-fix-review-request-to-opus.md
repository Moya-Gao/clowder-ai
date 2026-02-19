## Review 请求: F21 Cloud Round7（1xP1 + 2xP2）修复

### 背景
云端 Codex 在 PR #30（review `3824243379`, commit `636a023`）给出 3 条新问题：
1. P1：detail/by-url/update 在 article 文件损坏/缺失时返回 500。
2. P2：migrate CLI 默认 legacy path 机器绑定（`/Users/lysander/...`）。
3. P2：SignalArticleList 存在 button 嵌套 button 的无效语义。

### 设计文档
- Bug report: `docs/bug-report/f21-cloud-round7-p1p2-article-cli-ui/bug-report.md`
- 云端评论：
  - `discussion_r2826392685` (P1)
  - `discussion_r2826392690` (P2)
  - `discussion_r2826392694` (P2)

### Spec Compliance 自检

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | 缺失/损坏文件不应导致 detail/by-url/update 500 | ✅ | `packages/api/src/domains/signals/services/article-query-service.ts` | `packages/api/test/signals-route.test.js` |
| 2 | migrate CLI 不得依赖机器私有默认路径 | ✅ | `packages/api/src/scripts/migrate-signals/cli.ts` | `packages/api/test/signal-migrate-script.test.js` |
| 3 | SignalArticleList 消除交互元素嵌套 | ✅ | `packages/web/src/components/signals/SignalArticleList.tsx` | `packages/web/src/components/__tests__/signal-article-list.test.ts` |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/signals/services/article-query-service.ts` | 修改 | 新增读取失败降级 helper，detail/by-url/update 统一返回 null（路由映射 404） |
| `packages/api/src/scripts/migrate-signals/cli.ts` | 修改 | 移除机器绑定默认路径，`--from` 改为必填，缺失 fast-fail |
| `packages/api/test/signals-route.test.js` | 修改 | 新增缺失文件下 detail/by-url/update 404 回归 |
| `packages/api/test/signal-migrate-script.test.js` | 修改 | 新增缺 `--from` 失败用例 |
| `packages/web/src/components/signals/SignalArticleList.tsx` | 修改 | 外层行容器改 `div[role=button]` + 键盘可访问 |
| `packages/web/src/components/__tests__/signal-article-list.test.ts` | 新增 | 新增无嵌套/点击隔离测试 |
| `docs/bug-report/f21-cloud-round7-p1p2-article-cli-ui/bug-report.md` | 新增 | bug report 五件套 |

### Git SHA
- Base: `636a023`
- Head: `b0b11a5`

### 测试状态

```bash
# Red（修复前）
node --test test/signals-route.test.js test/signal-migrate-script.test.js
# => 2 fail（500 vs 404、missing --from 未失败）

pnpm test -- src/components/__tests__/signal-article-list.test.ts
# => 1 fail（button 嵌套，且出现 validateDOMNesting warning）

# Green（修复后）
node --test test/signals-route.test.js test/signal-migrate-script.test.js
# => 18/18 pass

pnpm test -- src/components/__tests__/signal-article-list.test.ts
# => 1/1 pass

# 关联回归
node --test test/signal-fetch-scheduler.test.js test/signal-migrate-script.test.js test/signal-source-migration.test.js test/signal-source-processor.test.js test/legacy-article-parser.test.js test/signals-route.test.js
# => 30/30 pass

pnpm test -- src/components/__tests__/signal-article-list.test.ts src/components/__tests__/signal-article-detail.test.ts src/components/__tests__/signal-sources-view.test.ts
# => 3/3 pass

pnpm -r --if-present run build
# => build 通过（web 仅既有 lint warnings，无新增）
```

### Review 重点
1. P1 语义：detail/by-url/update 读取失败统一降级 404，是否符合咱们 API 一致性。
2. CLI 变更：`--from` 必填是否满足迁移操作预期（避免 silent no-op）。
3. UI 语义：row 容器改为 `role=button` 后，键盘与 action 按钮交互是否合理。

### 五件套
- **What**: 修复 cloud round7 的 1 个 P1 + 2 个 P2，并补齐对应回归测试。
- **Why**: 防止坏文件触发 API 500、防止迁移命令跨机静默空跑、修复前端无效交互语义。
- **Tradeoff**: P1 读取失败统一按“未找到”返回 404（不细分 IO/解析错误），用更小改动保证线上稳定。
- **Open Questions**: 是否后续需要把“文件损坏”与“确实不存在”在 API 层做可观测区分（如日志标签/诊断端点）。
- **Next Action**: 请做 R16 review；若放行，我再 push 并触发下一轮云端 review（单次）。
