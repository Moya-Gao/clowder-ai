---
feature_ids: [F021]
topics: [cloud, round15, fix]
doc_kind: mailbox
created: 2026-02-20
---

## Review 请求: F21 Cloud Round15（P2）

### 背景
cloud round15 在 PR #30 新增 1 条 P2：
- Inbox 页面在拿到服务端搜索结果后仍做本地二次过滤，导致后端命中的结果被前端再次过滤丢失。

### 设计文档
- Bug report: `docs/bug-report/f21-cloud-round15-p2-stop-refilter-server-search/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | 搜索结果以服务端返回为准，不再本地 query 二次过滤 | ✅ | `showServerSearchResults=true` 时直接展示 `items` |
| 2 | Inbox 刷新仍保留本地过滤能力 | ✅ | `refreshInbox()` 后切回 `showServerSearchResults=false` |
| 3 | Red→Green 回归覆盖 | ✅ | 新增 `does not re-filter server search results on inbox page` |

### 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/web/src/components/signals/SignalInboxView.tsx` | 修改 | 增加服务端搜索结果模式，避免重复过滤 |
| `packages/web/src/components/__tests__/signal-inbox-view.test.ts` | 修改 | 增加“服务端命中但本地 haystack 不命中”回归测试 |
| `docs/bug-report/f21-cloud-round15-p2-stop-refilter-server-search/bug-report.md` | 新增 | 本轮 P2 bug report |

### Git SHA
- Base: `a0d694761519ccd84f12aaaedba0a77d948e7899`
- Head: `working tree (R24 待提交)`

### Red→Green 验证

| 问题 | 测试文件 | Red | Green |
|---|---|---|---|
| server search 结果被前端二次过滤 | `signal-inbox-view.test.ts` | FAIL: 页面显示 `共 0 篇` | PASS: 页面显示 `共 1 篇` |

### 验证命令
```bash
pnpm --filter @cat-cafe/web test -- src/components/__tests__/signal-inbox-view.test.ts
# Red: 1 failed, 1 passed
# Green: 2 passed

pnpm --filter @cat-cafe/web run build
# build success
```

### 五件套
**What**: 修复 Inbox 页面对服务端搜索结果的重复过滤，并补组件回归测试。  
**Why**: 过滤口径不一致（服务端含 content，本地不含）会漏掉真实命中结果。  
**Tradeoff**: 搜索结果模式下筛选器变更需重新提交搜索，不再即时本地筛。  
**Open Questions**: 是否要在 UI 上显式提示“当前为服务端搜索结果（需点击搜索刷新条件）”。  
**Next Action**: 请做 R24 review；若放行，我就提交并 push，触发下一轮 cloud review（一次）。
