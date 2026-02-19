## Review 请求: F21 Cloud Round11 (P2)

### 背景
cloud round11 在 PR #30（head `aad55b4`）新增 1 条 P2：
- `scripts/signal-fetcher-launchd.sh` 未完整解析 `daily_digest` 的 YAML 合法标量（单引号/行内注释），导致计划时间可能误回退默认 `08:00`。

### 设计文档
- Bug report: `docs/bug-report/f21-cloud-round11-p2-launchd-daily-digest-scalar/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | `daily_digest` 支持单引号标量 | ✅ | sed 增加单引号规则 |
| 2 | `daily_digest` 支持行内注释 | ✅ | 三条规则统一支持 `(#.*)?` |
| 3 | 回归测试 Red→Green | ✅ | 新增测试先红后绿 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `scripts/signal-fetcher-launchd.sh` | 修改 | `read_schedule_from_notifications` 支持单双引号/无引号 + 行内注释 |
| `packages/api/test/signal-fetcher-launchd-script.test.js` | 新增用例 | 覆盖 `'09:45' # comment` 解析 |
| `docs/bug-report/f21-cloud-round11-p2-launchd-daily-digest-scalar/bug-report.md` | 新增文档 | round11 P2 bug report 五件套 |

### Git SHA
- Base: `aad55b404cf186252d3d1f278fcb2e1ebb2941af`
- Head: `working tree (R20 待提交)`

### Red→Green 验证

| 问题 | 测试文件 | Red | Green |
|---|---|---|---|
| single-quoted + inline comment 未解析 | `packages/api/test/signal-fetcher-launchd-script.test.js` | FAIL: 输出仍为 `08:00` | PASS |

### 验证命令
```bash
pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/signal-fetcher-launchd-script.test.js
# => 3/3 pass

pnpm --filter @cat-cafe/api run build && cd packages/api && node --test test/signal-fetch-scheduler.test.js test/signal-fetch-script.test.js test/signal-fetcher-launchd-script.test.js
# => 17/17 pass

pnpm -r --if-present run build
# => pass（web 仅既有 lint warning）
```

### 五件套
**What**: 修复 launchd schedule 提取逻辑，支持 `daily_digest` 的单引号与行内注释写法，并补回归测试。  
**Why**: 防止合法 YAML 写法被漏解析导致任务时间错误回退默认值。  
**Tradeoff**: 保持 sed 方案（轻量）而非引入 YAML parser，优先最小改动完成当前 P2 闭环。  
**Open Questions**: 后续是否统一由 API 配置加载器输出标准 schedule，脚本只消费标准化结果。  
**Next Action**: 请做 R20 review；若放行，我就 push 并触发下一轮云端 review（一次）。
