## R15: Cloud Round6 两个 P1 修复确认

**Reviewer**: 布偶猫 (Opus)
**Commit**: `bbd6a57` (feat/f21-signal-hunter)
**对照基准**: Cloud review round6 的 2 个 P1

---

### P1-A: weekly 调度改用本地周几语义 — PASS

**修复** (`source-processor.ts` L28):
```
- if (frequency === 'weekly') return now.getUTCDay() === 1;
+ if (frequency === 'weekly') return now.getDay() === 1;
```

Review 要点：
- `getDay()` 返回本地时区的星期几，与 launchd 调度语义一致（launchd 用本地时间触发）
- `selectSources()` 的 `now` 参数从 `fetch-scheduler` 单次传入，一轮内判定一致
- 改动是 1 行，最小侵入

**测试覆盖** (`signal-source-processor.test.js` L183-204):
- 构造 `localMondayUtcSunday` Date 对象，override `getDay()=1` + `getUTCDay()=0`
- 断言 weekly-source 被选中（`['daily-source', 'weekly-source']`）
- 如果代码仍用 `getUTCDay()`，weekly 不会被选中 → 测试会 fail
- 这个 stub 方式不依赖测试机时区，测试稳定

**R13 兼容性验证**：R13 的 scheduler 频率测试（`2026-02-17T08:00:00.000Z`，UTC Tuesday / 本地 Tuesday）不受影响，因为 `getDay()` 和 `getUTCDay()` 在该时间点结果相同。18/18 回归全绿确认。

---

### P1-B: legacy 文件名日期提取 — PASS

**修复** (`legacy-article-parser.ts` L44-53):

新增 `extractDatePrefixFromFilename()`:
1. 正则 `^(\d{4}-\d{2}-\d{2})(?:$|[-_])` 匹配 `YYYY-MM-DD` 前缀
2. 正则 `^(\d{8})(?:$|[-_])` 匹配 `YYYYMMDD` 前缀
3. 都不匹配 → return `undefined`

使用处 (L93-96): `normalizeDate(frontmatter fields, normalizeDate(extractDatePrefixFromFilename(filePath), fallbackNow))`
- 优先级：frontmatter date > filename prefix > fallbackNow

Review 要点：
- 旧代码 `basename(...).slice(0, 8)` 对 `YYYY-MM-DD-*` 截取 8 字符得到 `2026-01-` — 错误
- 新正则分两步匹配，hyphenated 优先（更精确），compact 兜底
- `(?:$|[-_])` 确保不会误匹配非日期前缀（如 `12345678-random.md` 长数字）——等等，`12345678` 如果 8 位数字后跟 `-`，compact 正则会匹配。但这本身就是 `YYYYMMDD` 格式的合理匹配。可接受。
- `basename(filePath, '.md')` 先去扩展名，避免 `.md` 干扰

**测试覆盖** (`legacy-article-parser.test.js` L1-36):
- 创建 `2026-01-23-agent-update.md`，frontmatter 只有 title+url（无 date）
- 断言 `publishedAt === '2026-01-23'`，`fetchedAt === '2026-01-23'`
- 直接复现了 cloud review 的失败场景

---

### 测试结果

```
# P1 目标测试
signal-source-processor + legacy-article-parser: 4/4 pass

# 扩展回归（scheduler + migrate + migration + processor + parser）
18/18 pass

# Build
shared ✅  |  api ✅
```

---

### 总结

**R15: 2/2 P1 全部修复，放行。**

weekly 调度从 UTC 改为本地语义（1 行改动，与 launchd 一致），legacy 文件名日期用正则替代固定 slice（支持 YYYY-MM-DD + YYYYMMDD 两种命名）。测试设计精准，覆盖了云端 review 指出的具体失败场景。
