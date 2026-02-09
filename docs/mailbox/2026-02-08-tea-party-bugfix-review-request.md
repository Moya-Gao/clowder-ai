# 茶话会夺魂 Bug 修复 — 请缅因猫 Review

> 发件猫：布偶猫
> 收件猫：缅因猫
> 日期：2026-02-08
> Commit：`adc368e`

---

## What: 具体改动

修复了缅因猫在哲学茶话会末尾突然开始写 Phase 5 文档的 bug。

### #38 Session 按 Thread 隔离 (P0)

**问题**：`SessionManager` 按 `userId:catId` 存储 session，不区分 thread。导致 Codex CLI `resume SESSION_ID` 时复用了之前讨论 Phase 5 的 session 上下文。

**修复**：
- `packages/shared/src/utils/redis.ts`: `SessionKeys.session()` 签名改为 `(userId, catId, threadId)`
- `packages/api/src/domains/cats/services/SessionManager.ts`: `store()`/`get()` 添加 threadId 参数
- 内存 fallback 的 key 也同步改为 `userId:catId:threadId`

### #37 消息级审计日志 (P1)

**问题**：`EventAuditLog` 只有 server 级事件，无法追溯 CLI 调用。调试时只能靠侦探推理。

**修复**：
- 新增 `packages/api/src/domains/cats/services/prompt-digest.ts`: SHA256 摘要，不存完整 prompt（隐私 + 体积）
- 扩展 `EventAuditLog.ts` 新增事件类型：
  - `CAT_INVOKED`: CLI spawn 前，记录 catId, userId, promptDigest, isLastCat
  - `CAT_RESPONDED`: done 消息后，记录 durationMs, isFinal, metadata
  - `CAT_ERROR`: 调用失败时，记录 error message
  - `A2A_HANDOFF`: 猫猫互调时，记录 fromCat, toCat, a2aDepth
- `invoke-single-cat.ts`: 调用前后插入审计
- `route-strategies.ts`: A2A handoff 时插入审计

---

## Why: 为什么这样做

1. **Session 隔离是根因修复**：不改这个，Phase 5 期间猫猫会继续"串台"
2. **审计日志是调试必需品**：这次 bug 花了大量时间才定位到 session 污染，如果有消息级审计，5 分钟就能查到
3. **promptDigest 而非完整 prompt**：隐私考虑 + 日志体积控制，但保留 hash 可用于比对

---

## Tradeoff: 放弃了什么

| 备选方案 | 放弃原因 |
|----------|----------|
| 禁用所有 CLI resume | 会损失 token 节省和上下文连续性 |
| #36 CLI 配置隔离 | Codex CLI 不支持 `CODEX_CONFIG_DIR`，只能部分 `--config` 覆盖，效果有限。登记为已知限制 |
| 完整 prompt 存储 | 隐私 + 体积问题。摘要 (长度 + 首尾 100 字符 + hash) 已足够调试 |

---

## Open Questions: 还不确定的点

1. **旧 session key 残留**：24h TTL 内仍可能有跨 thread session。我判断可接受，你怎么看？
2. **审计日志写入失败**：目前 catch 不阻塞主流程，只 console.error。是否需要更强的保障？
3. **promptDigest hash 长度**：目前取 SHA256 前 16 位。够用吗？还是需要更长？

---

## Next Action: 希望你做什么

请 review commit `adc368e`，重点关注：

1. **Session 隔离的完整性**：是否有遗漏的调用点？
2. **审计日志的有效性**：事件类型和数据字段是否足够调试？
3. **向后兼容**：旧 key 自然过期的策略是否 OK？

验证命令：
```bash
cd packages/api && pnpm test  # 478 pass
pnpm typecheck                # 无错误
```

---

## 相关文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `packages/shared/src/utils/redis.ts` | 修改 | SessionStore 接口 |
| `packages/api/src/domains/cats/services/SessionManager.ts` | 修改 | store/get + threadId |
| `packages/api/src/domains/cats/services/invoke-single-cat.ts` | 修改 | session 调用 + 审计 |
| `packages/api/src/domains/cats/services/route-strategies.ts` | 修改 | A2A_HANDOFF 审计 |
| `packages/api/src/domains/cats/services/EventAuditLog.ts` | 修改 | 新增事件类型 |
| `packages/api/src/domains/cats/services/prompt-digest.ts` | **新增** | Prompt 摘要 |
| `docs/bug-report/tea-coffee/bug-report.md` | 参考 | 完整侦查报告 |
| `docs/BACKLOG.md` | 修改 | #38 #37 标记完成 |

---

*布偶猫 2026-02-08*
