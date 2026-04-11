# Review Request: 运行时 account 解析改为确定性绑定（502 regression hardening）

## What

把 4 个运行时裸调用 `resolveForClient(projectRoot, client)` 改为显式传 `preferredAccountRef`，消除 discovery chain 对运行时执行路径的劫持风险。

核心变更（4 文件，+71/-11）：
1. `account-resolver.ts` — `resolveAnthropicRuntimeProfile` 接受 `preferredAccountRef`，默认 `builtinAccountIdForClient('anthropic')` = `'claude'`
2. `LlmAIProvider.ts` — `resolveApiKey` 用 `resolveEffectiveAccountRefForCat` 取猫绑定，再传显式 ref
3. `index.ts:601` — F102 abstractive client 用显式 `builtinAccountIdForClient('anthropic')`
4. `index.ts:383` — session sealer 已通过 (1) 自动修复

保留 `cats.ts:247` 的裸调用（UI 建议场景，discovery 合理）。

## Why

2026-04-11 502 事故根因之一：测试污染往 `~/.cat-cafe/` 写入 `installer-anthropic: "generic-key"` 假凭据 → discovery chain "apiKey 优先" 规则选了假 key → 所有布偶猫 502。

社区小伙伴发现并提出："成员哪里 client 用那个 provider 不是固定的么，怎么还存在优先级的。" 砚砚确认：运行时不用 discovery，discovery 不决定运行时。

## Original Requirements
> 社区小伙伴："成员哪里 client 用那个 provider 不是固定的么，怎么还存在优先级的。"
> 铲屎官："成员哪里 client 用那个 provider 不是固定的么！所以就不应该猜？都写清楚到底用 oauth 还是 api 了啊！前端的设置里面啊"
> 砚砚："运行时不用 discovery，discovery 不决定运行时。"
- 来源：thread_mntzhg8h8e9pf7z8（2026-04-11 01:00-01:10 讨论）
- **请对照上面的摘录判断：运行时执行路径是否已全部改为确定性解析**

## Tradeoff

- 保留了 `resolveForClient` 的 discovery 逻辑（`cats.ts:247` UI 建议仍需要）
- 没有拆分 `resolveForClient` 为两个函数（P2 scope，PR-B）

## Open Questions

1. `LlmAIProvider` 用 `resolveEffectiveAccountRefForCat` 是否正确？游戏 AI 的 catId 可能是虚拟玩家
2. `resolveAnthropicRuntimeProfile` 无参调用默认 `'claude'`——对 self-hosted 只有 installer 账户的场景是否需要 fallback？

Review-Target-ID: fix-deterministic-resolver
Branch: feat/deterministic-resolver

## Next Action

请 review 代码正确性 + 上述两个 open questions。

## 自检证据

### Spec 合规
Quality gate 通过。502 regression 测试覆盖。无 .pen 设计稿（纯后端）。

### 测试结果
```
account-resolver tests   → 17/17 pass (含 2 个新 regression test)
catalog-accounts tests   → all pass
cat-account-binding      → all pass
proxy-fallback           → all pass
invoke-single-cat        → all pass (总计 98/98)
pnpm lint (tsc --noEmit) → 0 errors
biome check              → 0 errors
pnpm -r build            → exit 0
```

### 相关文档
- 无独立 plan（502 follow-up hardening）
- 相关 commit: `f07ea79d9` (clowder-ai#376 intake, discovery chain 引入源)
- 相关 commit: `40871a2b3` (砚砚 Layer 1 fix)
- 相关 commit: `1dbeb421a` (skipConflicts fix)
