---
doc_kind: review-request
topic: git-attribution
author: 宪宪/Opus-4.8
reviewer: 砚砚/GPT-5.4 (@gpt52)
created: 2026-05-28
review-target-id: git-attribution
branch: feat/git-attribution
---

# Per-cat git author attribution — Review 请求

@gpt52 砚砚，跨族 review（布偶猫 → 缅因猫）。铲屎官指定你 review（省猫粮，不找 55）。

## What

每只猫提交 commit 时，git **author 字段**不再全部塌缩成「砚砚」，而是按猫署名
`{breed 标识}-{真实模型}`（`Ragdoll-Opus-4.8`、`MaineCoon-GPT-5.4`；provider-named breed 去重后如 `Deepseek-v4-pro`、`Moonshot-Kimi-k2.6`）。

## Original Requirements（铲屎官原话，thread 2026-05-28）

> 现象：每只猫提交代码，git 记录的"作者"都是"砚砚"……最近 50 个 commit 约 39 个 author 显示砚砚。
> 方案①：harness 唤醒猫时动态 export GIT_AUTHOR_NAME=该猫（email 保持你的 GitHub noreply 以关联账户）。

追加 directive（**关键纠偏**）：
> zts212653 是我的 github 账号！
> Ragdoll-opus-45 你不是45！你是48！你这里出bug了为什么你觉得你是45！
> 你要看 claude code 或者 anthropic 给你的模型身份哦！

## ⚠️ 一次中途翻车（透明记录）

我第一版用 `{英文猫种}-{catId}`（→ `Ragdoll-opus-45`），被铲屎官抓出 bug：**catId `opus-45`
名实不符**——这只猫升级到 4.8 了，catId/catalog 还停在 45。我用 catId 当 name 把数据滞后
暴露成了错误署名。根因定位（grep 实证）：

- 全代码库 `grep claude-opus-4-8` → 0 命中；catalog `defaultModel` = `claude-opus-4-5`
- 我的 env：`CAT_CAFE_CAT_ID=opus-45`、`PROFILE_MODE=subscription`、**无 model override**
- 真值 4.8 只来自 `getCatModel(catId)`（`SystemPromptBuilder.ts:612` 注入 identity 用的同一个源）
  → env `CAT_{CATID}_MODEL` override > **runtime catRegistry**（铲屎官配的 4.8）

**结论**：model 真相源是 `getCatModel(catId)`，不是 catId、不是 worktree 的 `catConfig.defaultModel`
（那是 catalog 的开发副本，滞后在 4.5）。改用它，author name 与 system-prompt 的 `model=...` 永远同源。

## Changes（2 文件实现 + 2 文件测试）

- `packages/api/src/config/cat-git-identity.ts`（新）：
  - `prettifyModel(model)`：`claude-opus-4-8`→`Opus-4.8`、`gpt-5.4`→`GPT-5.4`、`z-ai/glm-4.7`→`GLM-4.7`
    （去 path 前缀 / 去日期后缀 / dash→dot 版本 / 仅首段大写、trailing tag 保留原样）
  - `resolveCatGitAuthorName(catId, breedId, model)` → `{Breed}-{prettyModel}`
  - `buildCatGitIdentityEnv(catId, breedId, model)`
- `invoke-single-cat.ts` callbackEnv（~536）：注入 `GIT_AUTHOR_NAME` + `GIT_COMMITTER_NAME`，
  model 取 `getCatModel(catId)`（try/catch fallback），**email 不设**（继承 config 的 zts212653）。
- 测试：`cat-git-identity.test.js`（13 例，含 prettify 跨 provider）+ `invoke-single-cat.test.js`
  wiring 断言（`/^MaineCoon-GPT-/`）。

## Architecture Ownership（F191）

- **Architecture cell**: `identity-session`（`identity-agent` subcell，F032 owns CatId/roster/breed/model）
- **Map delta**: `none` — 扩展现有 catId→identity 解析（复用 `getCatModel`）；新增 code anchor
  `cat-git-identity.ts`，reviewer 通过后我补进 cell。
- **Why**: 只新增「breed + 真实 model → git author name」映射 + 一处 spawn env 注入；不新建
  Store/Queue/Router，不改 dispatch / identity 边界。

## 自检证据

- `pnpm check`: 17 checks 全绿（biome ✓，含 format）
- `cat-git-identity.test.js`: 13/13 pass
- `invoke-single-cat.test.js`: 89/89 pass（wiring + 88 回归 0 退化）
- build: `tsc` exit 0
- hotfix: `no` / fallback: 实现 2 层（触发的 total=74 是 test.js pre-existing）/ architecture-ownership: 28 warnings 全是其他 feature
- **Dogfood**: 临时 repo 实证 `GIT_AUTHOR_NAME` env 覆盖 config `user.name`（config=砚砚 → author 用 env name，email 继承 zts212653）

## ⚠️ Review 重点 / 我最可能错的地方

1. **worktree vs runtime 的 model 副本差异**：worktree catalog 是 4.5，runtime 是 4.8。所以
   **worktree 跑出来 author = `Ragdoll-Opus-4.5`，runtime/alpha 才是 `Ragdoll-Opus-4.8`**。
   这是数据副本差异不是逻辑错——但请你确认这个 reasoning（getCatModel 在 runtime 取真实 model）成立。
   真实 4.8 的端到端验证只能在 runtime/alpha 做。
2. **prettifyModel 跨 provider 脆性**：我的美化规则（去 vendor 前缀、dash→dot、acronym 表）
   是启发式。请扫 roster 所有 model 字符串，看有没有美化成奇怪结果的（如 opencode 的
   `anthropic/claude-opus-4-6`、dare 的 `z-ai/glm-4.7`、spark 的 `gpt-5.3-codex-spark`）。
3. **丢了 catId 唯一性**：name 现在是 `breed+model`，不含 catId。若两只同 breed 同 model 的猫
   并存会撞名（当前 roster 无此情况）。可接受吗？
4. **email 继承假设**：若某 runtime/worktree 的 git config 没有 `user.email`，只设 name 会让
   git 用默认 email。我假设 config 一定有 email。

## Review 沙盒

- **Review-Target-ID**: `git-attribution`
- **Branch**: `feat/git-attribution`
- 纯后端逻辑，无需起服务。验证：
  `pnpm --filter @cat-cafe/api build && node --test test/cat-git-identity.test.js test/invoke-single-cat.test.js`
  （worktree 若 `NODE_ENV=production` 缺 @types，先 `env -u NODE_ENV pnpm install --config.confirmModulesPurge=false`）

[宪宪/Opus-4.8🐾]
