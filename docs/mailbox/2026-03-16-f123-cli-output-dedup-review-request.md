# Review Request: F123 CLI Output duplicate bubble hotfix

## What
- 修复 `useAgentMessages.ts` 中 callback text 无法回收 **无 invocationId 的 stream 占位气泡** 的路径
- 新增回归测试：`rich_block` 先落无 identity 占位，随后 callback text 到达时必须替换同一气泡，而不是再生成第二个 assistant bubble

## Why
- 铲屎官在真实使用里看到 Codex 一条 `CLI Output` 气泡显示了两次
- 这条链路会在 `rich_block` 先于 invocation 绑定到达时创建孤儿 stream placeholder；后续 callback text 没法按 invocation identity 命中它，于是又落成第二条消息
- 目标是先堵住这个真实重复气泡，不把这次 hotfix 扩成整个 TD111/TD112/TD113 的体质改造

## Original Requirements（必填）
> 「你看codex的一条消息 气泡 显示了两次」
>
> 「如果你要自己修的话，那你赶紧干活」
- 来源：当前 thread `thread_mmrac56gur1luogf`
- 现场证据：用户提供的 Codex `CLI Output` 双气泡截图（同一时间戳、同一内容块）
- **请对照上面的摘录判断这刀是否真的压住了铲屎官看到的双气泡**

## Tradeoff
- 这次没有直接上 store invariant / unified identity contract
- 我只补了一个更窄的 replacement fallback：**仅当 callback text 到达时且当前 stream 占位没有 invocationId**，允许把它回收成正式 callback bubble
- 这样先堵真实漏口，避免把 hotfix 扩成 Phase B 全量重构

## Open Questions
- 这个 fallback 颗粒度是否够窄：只回收“无 invocationId 的 stream 占位”，会不会还误伤别的 callback 路径？
- 当前只补 foreground 路径是否足够；还是你认为 background `rich_block` 镜像路径也该顺手加同构保护？

## Next Action
- 请重点审：
  - replacement fallback 的边界是否过宽/过窄
  - 新测试是否真的复现了用户看到的 duplicate bubble，而不是只测一个近似 case

## 自检证据

### Spec 合规
- 用户报的是“同一条 Codex CLI Output 气泡出现两次”
- 这刀直接把症状收成红灯：`invocationless rich-block placeholder + later callback text`
- 修后该路径从“两条 assistant message 共存”变成“同一条消息被升级为 callback”

### 测试结果
```bash
pnpm -C packages/web test -- --run src/hooks/__tests__/useAgentMessages-richblock-correlation.test.ts
# 9 passed

pnpm -C packages/web test -- --run src/hooks/__tests__/useAgentMessages-placeholder-recovery.test.ts
# 6 passed

pnpm -C packages/web test -- --run src/hooks/__tests__/useAgentMessages-bubble-merge.test.ts
# 2 passed

pnpm -C packages/web test -- --run src/hooks/__tests__/useSocket-background-system-info-web-search.test.ts
# 12 passed

pnpm -C packages/web lint
# 0 errors, existing warnings only

pnpm --filter @cat-cafe/web build
# success
```

### Artifact Hygiene
- `git status --short | rg '^\?\? [^/]+\.(png|jpe?g|webm|mp4)$'`
- 无输出 ✅

### 相关文件
- [useAgentMessages.ts](/Users/lysander/projects/relay-station/cat-cafe-f123-cli-output-dedup/packages/web/src/hooks/useAgentMessages.ts)
- [useAgentMessages-richblock-correlation.test.ts](/Users/lysander/projects/relay-station/cat-cafe-f123-cli-output-dedup/packages/web/src/hooks/__tests__/useAgentMessages-richblock-correlation.test.ts)
