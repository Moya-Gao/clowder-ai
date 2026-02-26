---
feature_ids: [F021]
topics: [cloud, round4, fix]
doc_kind: mailbox
created: 2026-02-19
---

## R13: Cloud Round4 两个 P1 修复确认

**Reviewer**: 布偶猫 (Opus)
**Commit**: `a1bc7c8` (feat/f21-signal-hunter)
**对照基准**: Cloud review round4 的 2 个 P1

---

### P1-A: 自动调度尊重 schedule.frequency — PASS

**修复逻辑** (`source-processor.ts` L23-30):

```typescript
function isSourceScheduledForAutomaticRun(source, now): boolean {
  if (!source.enabled) return false;
  if (frequency === 'manual') return false;
  if (frequency === 'weekly') return now.getUTCDay() === 1; // UTC Monday
  return true; // daily, hourly
}
```

Review 要点：
- `selectSources()` (L90-104) 接受 `now` 参数（默认 `new Date()`），手动指定 `sourceId` 时跳过频率检查，正确保留了 override 语义
- `fetch-scheduler.ts` (L140-141, L150) 单次 `now()` 调用保证一轮运行内判定一致
- `weekly` 用 UTC 周一是合理的确定性默认，bug report 已标注后续可扩展 `weeklyOn` / `timezone`

**测试覆盖** (`signal-fetch-scheduler.test.js` L314-354):
- 4 个 source（daily/hourly/weekly/manual），`now` = 2026-02-17（UTC Tuesday）
- 断言 fetchCalls = `['daily-source', 'hourly-source']`，weekly 和 manual 被排除
- 断言 `processedSources=2, skippedSources=2`

---

### P1-B: 多 feed alias 不再被最后 feed 覆盖 — PASS

**修复逻辑** (`source-migration.ts` L114-148):

```
单 feed → aliasToId.set(legacySourceId, sourceId) + set(baseName, sourceId)  ✅ 无歧义
多 feed → 只 set(legacySourceId-feedName, sourceId) + set(baseName-feedName, sourceId)  ✅ 不绑通用 alias
```

Review 要点：
- L120: `hasSingleFeed = feeds.length === 1` 正确区分单/多 feed
- L140-143: 单 feed 时设通用 alias + `return` 早退出
- L146-147: 多 feed 时只设 feed 级别 alias，通用 alias 不写入
- 注意 L138 `aliasToId.set(slugify(sourceId), sourceId)` 在两个分支下与 L141 或 L146 有重叠（slugify 幂等时），无害但冗余，P3 级别不 blocking

**测试覆盖** (`signal-source-migration.test.js` L48-80):
- 构造含 2 个 feed 的 legacy source "ai-news"
- 断言 `aliasToId.has('ai-news')` = false（通用 alias 未设）
- 断言 feed 级 alias 存在

---

### Rebase 冲突解决 — PASS

- 唯一冲突点：`packages/shared/src/types/index.ts`
- F21 的 `signals.js` 导出 vs main 的 `rich.js` 导出 → 并集保留，alphabetical 排序
- 所有原有导出无丢失

---

### 测试结果

```
# P1 修复目标测试
signal-fetch-scheduler + signal-source-migration: 8/8 pass

# Signal 全量回归
signal-*.test.js: 50/50 pass

# Web 全量
63 test files, 407 tests, 0 fail

# Build
shared build ✅  |  api build ✅  |  web build ✅
```

---

### 总结

**R13: 2/2 P1 全部修复，放行。**

频率门控逻辑清晰（manual 排除 + weekly UTC 周一 + daily/hourly 放行），migration alias 修复策略正确（单 feed 绑通用 alias，多 feed 只绑 feed 级 alias），rebase 冲突解决无遗漏。

F21 可以进入下一轮云端 review 或 Step 6 合入（取决于铲屎官指示）。
