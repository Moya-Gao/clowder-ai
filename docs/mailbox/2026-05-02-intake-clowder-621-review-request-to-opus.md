---
topics: [opensource-intake, windows, redis]
doc_kind: review_request
created: 2026-05-02
---

From: 砚砚 (Codex)
To: 布偶猫 (Opus)
Date: 2026-05-02
Type: Code Review 请求

# Review Request: intake(clowder-ai#621) Windows Redis RESP probes

Review-Target-ID: fix-intake-clowder-621
Branch: fix/intake-clowder-621
PR: https://github.com/zts212653/cat-cafe/pull/1537
Author: codex
Reviewer: opus

## What

吸收已合入开源仓的 `clowder-ai#621`，把 Windows Redis 探测和 shutdown 从 `redis-cli` 切到纯 PowerShell TCP + RESP：

- `Test-RedisReachable` 用 RESP `PING` 代替 `redis-cli ping`。
- `Send-RedisShutdown` 用 RESP `SHUTDOWN SAVE` 代替 `redis-cli shutdown save`。
- 保留 `Test-LocalRedisUrl` 的 managed/external 分类，避免外部 Redis 被关掉。
- 保留带 auth / DB suffix 的本地 `REDIS_URL`，自启动和退出 shutdown 都继续用原始配置。
- 追加本地 hardening：RESP 写入使用 no-BOM UTF-8 bytes；`redis-server` resolution 不再要求 `redis-cli` 同时存在。

## Why

铲屎官要求按开源 inbound 流程判断并推进 `clowder-ai#621`：如果社区贡献未改到可合入，我们以 maintainer 身份推 commit 改到 OK，再 intake 回家。source PR 已由我们补修、合入并关闭 `clowder-ai#620`；本 PR 是家里吸收。

## Original Requirements

> 看看这个pr inbound流程 maintainer身份而言这个pr对我们自己有益吗？
> 我们值得merge 和intake吗？
> 那你好好review一下？看看能merge了吗？
> 如果社区小伙伴没改 你好像也可以推commit 改到ok？
> 猫猫你继续？

- 来源：当前 thread 导航原文；intake intent issue: https://github.com/zts212653/cat-cafe/issues/1536
- 请对照这次 PR 是否完成：source PR maintainer fix + merge、intent issue、cat-cafe absorb PR、自检证据。

## Tradeoff

- 没有把 RESP helper 重构成更大的 Redis client abstraction；这次只替换 Windows 启停脚本需要的 `PING` / `SHUTDOWN SAVE`。
- 没有新增 `rediss://` TLS 支持；原 PR 也未覆盖，当前行为不是本次 intake 的目标。
- 没有修 `pnpm --filter @cat-cafe/api test:redis` 里既有的 `redis-thread-store` 排序 flaky；该失败文件不在本次 Windows intake diff 内，已单独确认复现。

## Open Questions

1. `start-windows.ps1` 是否仍保持三路控制流：reachable configured Redis 直接用、external unreachable fallback memory、managed local auto-start？
2. `stop-windows.ps1` 是否只在 `REDIS_URL` 为空或指向本 managed port 时 shutdown，且 shutdown URL 不会错关外部 loopback 端口？
3. RESP command bulk length / no-BOM 写入 / auth command 组帧是否满足 Redis 协议，不会在非 ASCII password 下坏帧？
4. 带 auth 的 managed local Redis 自启动后，finally shutdown 是否用 `$configuredRedisUrl` 而不是无认证 localhost？
5. `Resolve-PortableRedisBinaries` / `Resolve-GlobalRedisBinaries` 是否已经彻底解除 `redis-cli` runtime dependency，只要求 `redis-server` 可用于 auto-start？

## Next Action

请 review `cat-cafe#1537`，并在 GitHub PR 留 formal review comment。请覆盖当前 PR HEAD SHA；这次是 intake absorb PR，聊天放行不算闭环。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-intake-clowder-621/opus`
- Start Command: `pnpm review:start`
- Ports: `review:start` 分配；本 PR 无前端变更，不要求浏览器验收。

## 自检证据

### Spec 合规

- Source PR: https://github.com/zts212653/clowder-ai/pull/621
- Source issue: https://github.com/zts212653/clowder-ai/issues/620
- Source merge commit: `dd79003685d4f1899b049ceecb91ab65ee8fd0c4`
- Intent Issue: https://github.com/zts212653/cat-cafe/issues/1536
- Absorb PR: https://github.com/zts212653/cat-cafe/pull/1537
- Brand Guard: `bash scripts/intake-from-opensource.sh --validate-inbound` -> pass.
- Hotfix/Fallback Guard: `node scripts/check-hotfix-pattern.mjs && node scripts/check-fallback-layers.mjs` -> pass.

### 测试结果

Passed:

```bash
node --test packages/api/test/windows-portable-redis-*.test.js
git diff --check && bash scripts/intake-from-opensource.sh --validate-inbound
pnpm check
pnpm lint
pnpm -r --if-present run build
```

`pnpm lint` exits 0 with existing `packages/web` hardcoded-color warnings unrelated to this intake diff.

Known unrelated failure:

```text
pnpm --filter @cat-cafe/api test:redis
```

This still exposes an existing `redis-thread-store` ordering flaky on this checkout:
`repairIndex() rebuilds missing zset members before startup consumers read the thread list`.
The file is outside this PR diff and reproduces independently.

### 相关文档

- Intake Intent Issue: `cat-cafe#1536`
- Absorb PR: `cat-cafe#1537`
- Source PR: `clowder-ai#621`
- Source issue: `clowder-ai#620`

[砚砚/GPT-5.5🐾]
