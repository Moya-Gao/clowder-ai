---
doc_kind: review_request
feature_ids: [F127]
topics: [accounts, migration, runtime-config]
created: 2026-04-28
author: codex
reviewer: opus
---

# Review Request: F127 Account Config Pollution Guard

Review-Target-ID: f127
Branch: fix/f127-account-pollution

## What

Restricted cross-root homedir legacy account migration so old `~/.cat-cafe/provider-profiles.json` experiments no longer get copied into every project-local `.cat-cafe/accounts.json`.

Changed both runtime migration and installer helper:
- `packages/api/src/config/catalog-accounts.ts`
- `scripts/install-auth-config.mjs`

Added regression coverage for:
- unreferenced `Agent Teams Local` / fixture accounts are skipped
- well-known installer accounts still migrate
- project catalog referenced custom accounts still migrate
- installer script follows the same filter

## Why

铲屎官在 runtime 的「系统配置 > 账号配置」看到 `Agent Teams Local`、`installer-*`、`codex-sponsor` 这类历史污染。只读诊断确认 `Agent Teams Local` 来自 legacy homedir `provider-profiles.json`，当前 migration 默认把 homedir 旧 profiles 合并进项目 accounts。

## Original Requirements

> "你最好自己来干 不过我发现有bug 现在家里的 api 配置 就是账号配置那边好像有很多奇怪的污染 Agent Teams Local 之类的"
> "你可以看看 我的runtime的 api配置看到好多垃圾不知道哪里来的。感觉属于127的issue"

- 来源：当前 A2A thread，铲屎官 2026-04-28 21:50 原文
- 请对照上面的摘录判断：这次交付是否阻断了 F127 账号页继续被 homedir legacy 垃圾污染

## Tradeoff

没有自动删除当前 runtime 里已经存在的脏账号，因为那是用户运行态数据变更。代码层只阻断后续迁移污染；现有 runtime 清理需要铲屎官确认删除清单后执行。

保留了 installer/builtin 自动迁移，以及 project catalog 已引用的自定义账号迁移，避免把旧 installer 升级路径打断。

## Open Questions

请重点看：
- cross-root homedir allowlist 是否过宽或过窄
- `readProjectAccountRefs()` 递归扫描 `accountRef` 是否足够稳妥
- runtime migration 与 standalone installer helper 的规则是否保持一致

## Next Action

请 review。若放行，我再进 receive-review/merge-gate；当前 runtime 数据清理单独等铲屎官确认。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f127/opus`
- Start Command: `pnpm review:start`
- Ports: N/A，后端迁移逻辑改动；本轮不需要启动前端 review server

## 自检证据

### Spec 合规

- F127 账号配置与猫猫实例分离不变
- 本次只修账号配置污染根因，不改 Hub UI、不改 runtime 运行数据
- `.pen` 匹配到 `docs/designs/F127/F127-hub-ux-wireframe.pen`，但本轮无前端 UI 改动，未进入截图对照
- 根目录媒体/设计工件闸门：工作树与 diff 均无命中

### 测试结果

```bash
pnpm --filter @cat-cafe/api run build
# exit 0

node --test \
  packages/api/test/catalog-accounts.test.js \
  packages/api/test/install-auth-config-script.test.js \
  packages/api/test/config-write-sandbox.test.js \
  packages/api/test/account-startup.test.js \
  packages/api/test/account-resolver.test.js
# 74 pass, 0 fail

pnpm lint
# exit 0; existing web hardcoded-color warnings only
```

### 相关文档

- Feature: `docs/features/F127-cat-instance-management.md`
- Lesson context: `docs/lessons-learned.md` LL-043 account migration guard
