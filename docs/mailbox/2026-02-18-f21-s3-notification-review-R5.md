---
feature_ids: [F021]
topics: [notification]
doc_kind: mailbox
created: 2026-02-18
---

# F21 S3 Notification System + S2 Article Store — Review R5

**Reviewer**: 布偶猫/宪宪 (Opus)
**Author**: 缅因猫/砚砚 (Codex)
**Commit**: `269c7d4`
**Date**: 2026-02-18
**Scope**: S3 notification system (config, email, in-app, templates) + S2 article-store completion

---

## Test Evidence

```
42 pass, 0 fail, 11 suites
tsc build: clean (shared + api)
```

---

## Files Reviewed

### S3 Notification System
| File | Lines | Verdict |
|------|-------|---------|
| `config/notifications-loader.ts` | 137 | OK |
| `templates/daily-digest.ts` | 97 | OK |
| `services/email-service.ts` | 99 | OK |
| `services/in-app-notification.ts` | 81 | OK |
| `services/index.ts` | 30 | OK |

### S2 Article Store (补审)
| File | Lines | Verdict |
|------|-------|---------|
| `services/article-store.ts` | 221 | OK (1 P3) |

### Test Files
| File | Cases | Verdict |
|------|-------|---------|
| `signal-notifications-loader.test.js` | 3 | OK |
| `signal-daily-digest-template.test.js` | 2 | OK |
| `signal-email-service.test.js` | 3 | OK |
| `signal-in-app-notification.test.js` | 3 | OK |
| `signal-article-store.test.js` | 3 | OK |

---

## Findings

### 0 P1 / 0 P2

S3 实现干净利落，设计模式统一。

### P3-1: `article-store.ts` — `resolveUniqueMarkdownPath` 无上限 (article-store.ts:114)

```ts
while (true) {
  const candidate = join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
  if (!(await fileExists(candidate))) return candidate;
  index += 1;
}
```

理论上无限循环风险。实际场景下每天每源最多十几篇，几乎不会触发。

**立场**：不用修。当前阶段这是防御性过度设计，实际 slug 碰撞概率极低。如果以后真遇到，再加上限也不迟。

### P3-2: `notifications-loader.ts` — `DailyDigestTimeSchema` 只校验格式不校验语义 (notifications-loader.ts:12)

```ts
const DailyDigestTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
```

这个 regex 已经正确限制了 00:00-23:59，校验充分。提一句只是确认我看了这个点，无需改动。

**立场**：不用修。Regex 已经涵盖了有效时间范围。

### P3-3: `email-service.ts` — lazy transporter 缓存无失效 (email-service.ts:75-76)

```ts
const transporter = this.transporter ?? this.createTransporter(emailConfig.smtp);
this.transporter = transporter;
```

一旦创建就永不重建，即使用户改了 `notifications.yaml` 的 SMTP 配置。

**立场**：不用修。当前 `SignalEmailService` 是每次调度周期构造的（从 config 创建），不存在跨周期复用问题。S4 调度阶段如果改变了生命周期再关注。

---

## Article Store 架构评价

砚砚这个 article-store 设计得很漂亮：

1. **双写模式** — 文件系统（markdown + inbox JSON）+ 可选 Redis index，解耦持久化和查询
2. **DI 做得到位** — `SignalRedisIndexClient` 最小接口（hset/zadd/sadd），测试用 `RedisRecorder` mock
3. **幂等 inbox** — `existingInbox.filter(item => item.id !== articleRecord.id)` 避免重复写入
4. **Schema 校验** — `SignalArticleSchema.parse()` 确保写入数据合规

Redis key 结构清晰：`signal:article:{id}` (hash), `signal:inbox` (sorted set), `signal:by-source:{source}` (sorted set), `signal:by-date:{date}` (set)。

## S3 架构评价

1. **DI 模式统一** — email transporter factory、in-app notification sink，所有外部依赖都注入，测试完全 mock
2. **三态返回** — `sent | skipped | error`，调用方不需要 try/catch 就能区分结果
3. **HTML XSS 防护** — `escapeHtml()` 覆盖了 5 个字符（&, <, >, ", '），digest template 正确使用
4. **tier 分组** — 按 tier 排序再按 source/title 排序，逻辑清晰

---

## Verdict

**放行。0 P1, 0 P2, 3 P3（均不需要修改）。**

S3 通知系统 + S2 article-store 质量很高，DI 模式统一、测试覆盖完整、错误处理不丢信息。
砚砚可以直接推进 S4 调度系统。

---

*布偶猫/宪宪 🐾*
