## Review 请求: F21 Cloud Round17（P1）

### 背景
cloud round17 在 PR #30 新增 1 条 P1：
- 未闭合 frontmatter (`---` 起始无闭合) 没有被标记为 malformed input，导致 skip 统计缺失。

### 设计文档
- Bug report: `docs/bug-report/f21-cloud-round17-p1-unterminated-frontmatter/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | 未闭合 frontmatter 必须判定为 malformed | ✅ | `splitFrontmatter` 在 opener 存在但无闭合时抛出 `unterminated frontmatter` |
| 2 | 迁移流程不中断 | ✅ | per-file try/catch 继续迁移其他合法文件 |
| 3 | `skippedArticles` 统计覆盖该场景 | ✅ | CLI 回归用例断言 `skippedArticles=1` |
| 4 | Red→Green 证据完整 | ✅ | 两个新增用例先红后绿 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/api/src/scripts/migrate-signals/legacy-article-parser.ts` | 修改 | frontmatter opener 存在但闭合缺失时抛错 |
| `packages/api/test/legacy-article-parser.test.js` | 修改 | 新增 parser 级未闭合 frontmatter 回归 |
| `packages/api/test/signal-migrate-script.test.js` | 修改 | 新增 CLI 级未闭合 frontmatter 回归 |
| `docs/bug-report/f21-cloud-round17-p1-unterminated-frontmatter/bug-report.md` | 新增 | 本轮 P1 bug report |

### Git SHA
- Base: `78dae5511514035f212f4429dee91b8e467a1423`
- Head: `working tree (R26 待提交)`

### Red→Green 验证

| 问题 | 测试文件 | Red | Green |
|---|---|---|---|
| parser 未将未闭合 frontmatter 记为 malformed | `legacy-article-parser.test.js` | FAIL: `skipped.length` 为 `0` | PASS |
| CLI 未统计该 malformed skip | `signal-migrate-script.test.js` | FAIL: summary `skippedArticles=0` | PASS |

### 验证命令
```bash
pnpm --filter @cat-cafe/api run build && node --test \
  packages/api/test/legacy-article-parser.test.js \
  packages/api/test/signal-migrate-script.test.js
# Green: tests 13, pass 13, fail 0
```

### 五件套
**What**: 将“frontmatter 起始存在但无闭合”显式判定为 malformed，并补 parser/CLI 双层回归测试。  
**Why**: 该场景是 cloud round17 的 P1，必须避免静默吞错并进入可见的 skip 统计。  
**Tradeoff**: 顶部以 `---` 开始的文本会被严格解释为 frontmatter；对迁移输入而言这是更安全的策略。  
**Open Questions**: 是否需要为 `unterminated frontmatter` 单独计数（而非统一 `skippedArticles`）。  
**Next Action**: 请做 R26 review；若放行，我提交并 push，触发下一轮 cloud review（一次）。
