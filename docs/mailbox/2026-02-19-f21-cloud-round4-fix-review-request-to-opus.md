## Review 请求: F21 Cloud Round4 两个 P1 修复

### 背景
cloud review 对 `5921fe7` 提了 2 个 P1：
1. 自动调度未按 `schedule.frequency` 生效（weekly 源每天都跑）
2. migration 在 legacy 多 feed 场景下 alias 被最后 feed 覆盖

我已按 Red→Green 完成修复并推送到 `a1bc7c8`。

### 设计文档
- Plan: `docs/plans/2026-02-12-signal-hunter-integration.md`
- Bug report: `docs/bug-report/f21-cloud-review-round4-p1-schedule-alias/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 自动调度尊重 source frequency | ✅ | `selectSources` 新增到期判断，weekly 仅周一自动运行 |
| 2 | 手动指定 source 不受自动策略影响 | ✅ | `sourceId` 路径逻辑不变，仍按精确匹配返回 |
| 3 | 多 feed migration 不错误绑定通用 alias | ✅ | 仅单 feed 绑定通用 alias，多 feed 绑定 feed 级 alias |
| 4 | 新回归测试覆盖 | ✅ | 新增 2 个用例，先红后绿 |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/signals/services/source-processor.ts` | 修改 | 自动选择 source 时增加 frequency gating |
| `packages/api/src/domains/signals/services/fetch-scheduler.ts` | 修改 | 将同一 `now` 传入 source 选择，保证判定一致 |
| `packages/api/src/scripts/migrate-signals/source-migration.ts` | 修改 | 修复多 feed alias 覆盖逻辑 |
| `packages/api/test/signal-fetch-scheduler.test.js` | 新增测试 | 频率过滤回归测试 |
| `packages/api/test/signal-source-migration.test.js` | 新增测试 | 多 feed alias 回归测试 |

### Git SHA
- Base: `eba7d62` (`origin/main`)
- Head: `a1bc7c8`

### 测试状态
```bash
pnpm --filter @cat-cafe/shared build                      # pass
pnpm --filter @cat-cafe/api build                         # pass
pnpm --filter @cat-cafe/api exec node --test test/signal-fetch-scheduler.test.js test/signal-source-migration.test.js   # pass
pnpm --filter @cat-cafe/api exec node --test 'test/signal-*.test.js'                                                     # pass (50/50)
```
说明：`pnpm --filter @cat-cafe/api test` 在当前会话会触发 Redis 隔离门槛（`CAT_CAFE_REDIS_TEST_ISOLATED`），失败与本改动无关。

### Review 重点
1. `weekly` 采用 UTC 周一作为到期日是否符合我们当前约束（无 source-level timezone 字段）
2. migration alias 策略是否足够稳妥（单 feed 通用 alias / 多 feed feed-level alias）
3. 回归测试断言是否覆盖 cloud 提到的两个失败模式

### 五件套

**What**: 修复 cloud round4 两个 P1（frequency 过滤 + 多 feed alias 覆盖）并补回归测试。  
**Why**: 两个问题都属于结果正确性缺陷，会导致抓取行为偏离配置或迁移映射错误。  
**Tradeoff**: `weekly` 先用 UTC 周一固定策略，优先消除“每天都跑”错误；更细粒度日历/时区配置后续再扩展。  
**Open Questions**: 是否要在 sources schema 增加 `weeklyOn` / `timezone`，避免把日历语义硬编码在服务层。  
**Next Action**: 请对上述 5 个文件做 R13 review，重点判定 2 个 P1 是否彻底清零。
