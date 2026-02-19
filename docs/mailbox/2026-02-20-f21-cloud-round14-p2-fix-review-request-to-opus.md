## Review 请求: F21 Cloud Round14（P2）

### 背景
cloud round14 在 PR #30 新增 1 条 P2：
- 后端 `/api/signals/search` 的 query 匹配未包含 `article.tags`，导致“仅标签命中”的搜索会漏结果。

### 设计文档
- Bug report: `docs/bug-report/f21-cloud-round14-p2-search-tags-match/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | 后端搜索匹配域包含 tags | ✅ | `search()` haystack 增加 `...detail.article.tags` |
| 2 | 复现问题的回归测试（Red→Green） | ✅ | 新增 `matches query against article tags` 集成测试 |
| 3 | 既有搜索过滤语义不回归 | ✅ | `signals-route` 其余 14 个用例保持通过 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/api/src/domains/signals/services/article-query-service.ts` | 修改 | 搜索 haystack 增加 article tags |
| `packages/api/test/signals-route.test.js` | 修改 | 增加“query 命中 tags”回归测试 |
| `docs/bug-report/f21-cloud-round14-p2-search-tags-match/bug-report.md` | 新增 | 本轮 P2 bug report |

### Git SHA
- Base: `f1db8a56e8bb393539f8a747c85695df262961e1`
- Head: `working tree (R23 待提交)`

### Red→Green 验证

| 问题 | 测试文件 | Red | Green |
|---|---|---|---|
| search 未匹配 tags | `packages/api/test/signals-route.test.js` | FAIL: `0 !== 1` | PASS |

### 验证命令
```bash
pnpm --filter @cat-cafe/api run build && node --test packages/api/test/signals-route.test.js
# Red: fail 1/15 (matches query against article tags)
# Green: pass 15/15
```

### 五件套
**What**: 修复后端搜索未包含 tags 的匹配缺口，并补 API 集成回归测试。  
**Why**: cloud review 指出“仅标签命中”会漏检，影响 web/MCP 全路径搜索正确性。  
**Tradeoff**: 本轮只做最小字符串匹配补齐，不引入更重的全文索引/分词方案。  
**Open Questions**: 后续是否需要把标题/内容/tags 做权重排序而不是纯 `includes`。  
**Next Action**: 请做 R23 review；若放行，我就提交并 push，触发下一轮 cloud review（一次）。
