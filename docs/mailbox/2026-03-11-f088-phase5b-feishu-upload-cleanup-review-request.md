---
feature_ids: [F088]
doc_kind: review-request
created: 2026-03-11
---

# Review Request: F088 Phase 5b — Feishu 原生媒体上传 + 媒体文件清理

## What

6 commits on `feat/f088-phase5b`，两个独立功能：

1. **Feishu 原生媒体上传**：FeishuTokenManager（tenant_access_token 获取+缓存）+ FeishuAdapter.sendMedia 升级（absPath → upload /im/v1/images 或 /im/v1/files → 原生消息），替代文本链接 fallback
2. **MediaCleanupJob**：基于文件 mtime 的定时清理（24h TTL, 1h sweep），防磁盘泄漏

核心文件：
- `FeishuTokenManager.ts` — 新文件，token 获取+缓存（5min 提前刷新）
- `FeishuAdapter.ts` — sendMedia 三路优先：platform key > upload+native > text link fallback
- `MediaCleanupJob.ts` — 新文件，readdir+stat+unlink sweep
- `connector-gateway-bootstrap.ts` — 接线 TokenManager + CleanupJob

## Why

Phase 5+6 (PR #362) 完成了媒体管道，但 Feishu 出站媒体用的是文本链接 fallback（因为原生上传需要 tenant_access_token + multipart）。本 Phase 补齐原生上传路径。同时，ConnectorMediaService 下载的文件没有清理策略，会导致磁盘泄漏。

## Original Requirements

> 铲屎官原话 (2026-03-11 03:16):
> "走起！Follow-up（已记录在 feature doc）：Feishu 原生图片上传（需 tenant_access_token + /im/v1/images）、ConnectorMediaService 文件清理策略"

- 来源：thread 消息 + `docs/features/F088-multi-platform-chat-gateway.md` AC-21/23 的 ⚠️ 标记
- **请对照：Feishu 出站是否真的走原生 API 而不是文本链接？清理是否只删超龄文件？**

## Tradeoff

- token 缓存用内存（单进程），不用 Redis — 单实例足够，多实例场景再升级
- 清理用 setInterval 而非 cron — 进程内 job，简单可靠，无外部依赖
- 上传用 fetch + FormData 而非 lark SDK — lark SDK 的上传 API 封装不完整

## Open Questions

1. `uploadToFeishu` 内 `createReadStream` → `streamToBuffer` → `Blob` 的路径，是否有更直接的方式？（Node.js fetch FormData 对 stream 支持有限）
2. CleanupJob 的 24h TTL 是否合理？还是应该更短（如 6h）？

## Next Action

请 review 代码质量、架构合理性，特别关注：
- FeishuTokenManager 的 token 缓存逻辑（过期、刷新）
- sendMedia 三路优先级链是否正确
- MediaCleanupJob 的文件遍历是否有竞态风险

## 自检证据

### Spec 合规

| # | AC | 状态 |
|---|-----|------|
| F1 | Feishu 出站图片 → /im/v1/images 上传 | ✅ |
| F2 | Feishu 出站音频 → /im/v1/files 上传 | ✅ |
| F3 | tenant_access_token 获取+缓存 | ✅ |
| C1 | 定期清理超 TTL 文件 | ✅ |
| C2 | 仅删超龄文件 | ✅ |

### 测试结果

```
node --test (13 test files) → 123 passed, 0 failed
tsc --noEmit → exit 0
Biome check (changed files) → 0 errors
pnpm build → exit 0
```

### 相关文档

- Plan: `docs/plans/2026-03-11-f088-feishu-upload-media-cleanup.md`
- Feature: F088 / `docs/features/F088-multi-platform-chat-gateway.md`
- AC: `docs/features/assets/F088/acceptance-criteria.md`
