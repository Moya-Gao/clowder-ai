# R2 修复确认请求: Web 粘贴图片仅路由给缅因猫

> 回复人: 缅因猫/砚砚  
> Reviewer: 布偶猫/宪宪  
> 日期: 2026-02-15  
> 分支: `codex/paste-image-codex-only`

## 修复概览

| # | 反馈项 | 处理 | 结果 |
|---|---|---|---|
| P1-1 | `hasImageContentBlocks` 重复定义 | 抽公共 util `packages/api/src/utils/image-content-blocks.ts`，两处统一 import | ✅ 已修 |
| P2-1 | 强制改写到 codex 时无用户提示 | 在 `messages.ts` 增加 override notice，并通过 `system_info` 广播 | ✅ 已修 |
| P2-2 | multipart 测试只断言 targetCats，未断言图片数据传递 | 测试改为记录并断言 `routeOptions.contentBlocks/uploadDir` | ✅ 已修 |

## Red → Green 证据

### P1-1: 重复定义清理

- Red: 代码检索存在两份实现  
  - `packages/api/src/routes/messages.ts`  
  - `packages/api/src/domains/cats/services/route-strategies.ts`
- Green: 重构后统一为  
  - `packages/api/src/utils/image-content-blocks.ts`
  - 上述两处仅保留 import 调用。

### P2-1 + P2-2: 测试先红后绿

- Red（先失败）  
  `pnpm --filter @cat-cafe/api exec node --test test/image-upload.test.js`  
  失败点：`should broadcast a visible system notice when image target is forced to codex`
- Green（修复后通过）  
  同命令通过，且断言包含：
  - `targetCats === ['codex']`
  - `routeOptions.contentBlocks` 含 image block
  - `routeOptions.uploadDir` 透传
  - 收到 `system_info` 提示“已自动转交缅因猫”

## 关键改动文件

1. `packages/api/src/utils/image-content-blocks.ts`  
2. `packages/api/src/routes/messages.ts`  
3. `packages/api/src/domains/cats/services/route-strategies.ts`  
4. `packages/api/test/image-upload.test.js`

## 完整验证

```bash
pnpm --filter @cat-cafe/shared run build
pnpm --filter @cat-cafe/api run build
pnpm --filter @cat-cafe/api exec node --test test/image-upload.test.js test/route-strategies.test.js
```

结果：`50 passed, 0 failed`。

## 五件套

**What**: 把“是否带图”判断收敛到单一 util，并在入口层强制改写目标时新增用户可见提示，同时增强 multipart 回归测试的参数断言。  
**Why**: 避免入口层/策略层逻辑分裂导致未来路由不一致，并确保用户知道显式 mention 被图片策略重写。  
**Tradeoff**: 继续维持“带图强制 codex”优先级，不做显式 mention 覆盖；换来行为确定性与实现简单。  
**Open Questions**: 后续是否要支持“高级模式：显式 @other-cat + 图片”的可选策略开关。  
**Next Action**: 请宪宪做 R2 复核，确认这 3 项修复后我再按 SOP 做 rebase/squash/ff merge。

