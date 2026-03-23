---
title: "Review Request: release channel governance for clowder-ai"
reviewer: "@opus"
author: "@gpt52"
review-target-id: "release-channel-governance"
branch: "fix/release-channel-governance"
created: "2026-03-22"
---

# Review Request: release channel governance for clowder-ai

## What

- 给 `opensource-ops` skill 增加发布线口径：`cat-cafe main`、`clowder-ai main`、`clowder-ai release tag`、`clowder-ai next/prerelease` 四条线各自承接什么
- 给 outbound sync ref 增加“先选通道，再谈同步”规则：激进但未完全稳定的社区特性不直接进 `clowder-ai main`
- 更新 `docs/open-source-status.md`，把“stable 由 release tag 承诺、`main` 不是实验场、激进社区特性走 `next/prerelease`”写进家里的开源治理真相源
- 顺手收掉 3 条 repo 里现存的 biome import-order baseline，避免 `pnpm check` 被无关红灯卡住
- 在 `clowder-ai` 社区仓新建并 pin 了公告 issue：`#175 Release channels: main, stable tags, and preview lane`

## Why

- 铲屎官明确追问了一个之前口径里缺失的点：**社区其他小伙伴贡献的激进特性，不够稳时到底走哪里**
- 如果不把这个规则写成真相源，后面又会回到“是不是要开 `dev` 分支”“`main` 到底算不算稳定版”的循环讨论
- 这次我们已经把 `release provenance` 和 `source-owned public gate` 落进脚本，现在缺的是**社区发布线的治理边界**

## Original Requirements

> “那你这里好像没能解决一个问题！ 社区其他小伙伴贡献的特性 激进的未必稳定的走哪里？”
>
> “可以那你记得在家里的 开源管理skills 更新一下我们的规范？然后好像社区那边如何公告这个规范呢？”

- 来源：本 thread 铲屎官指令（2026-03-22）

## Tradeoff

- 我没有在这张 PR 里直接创建 `clowder-ai next` 分支；这次先把**治理规则**落成真相源，避免先建一条没人用、却要长期维护的分支
- `clowder-ai` 社区公告我选的是 **pinned issue**，不是 README 直接改写；这样先把规则公开可见，后续如果稳定，再决定要不要升格进 README/CONTRIBUTING
- 为了让 `pnpm check` 真绿，我带了 3 条纯 biome import-order baseline；它们和 release 规则无关，但不收会卡住 repo gate

## Open Questions

1. 你是否同意当前口径：**默认不引入长期 `dev` 分支，而是优先用 `next/prerelease` 承接激进社区特性**？
2. 社区公告现在落在 `clowder-ai#175` pinned issue；你是否认可这就是第一层公开入口，README/CONTRIBUTING 可以后补？
3. 这 3 条 biome-only baseline 一起带进来，你是否接受？如果不接受，我可以拆走。

## Next Action

- 请按严格标准 review 这张 release channel governance PR，重点看：
  - `main / release / next/prerelease` 的边界是否够硬
  - 社区激进特性的落点规则是否清楚
  - `pinned issue` 作为社区公告入口是否足够

## 自检证据

### 真相源更新

- `cat-cafe-skills/opensource-ops/SKILL.md`
- `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`
- `docs/open-source-status.md`

三处都已明确：
- stable 承诺来自 `release tag`
- `clowder-ai main` 是 rolling stable，不是实验场
- 激进但未完全稳定的社区特性走 `next/prerelease`，或保留在 PR/feature branch

### 社区公告

- `clowder-ai#175` 已创建并 pin：
  - `Release channels: main, stable tags, and preview lane`

### 测试结果

```bash
pnpm check
```

结果：
- `pnpm check` ✅
