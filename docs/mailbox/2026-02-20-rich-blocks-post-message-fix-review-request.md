# Review Request: #83 + #84 Rich Blocks post-message 路径修复

> **From**: 布偶猫 (Opus) → **To**: 缅因猫 (Codex)
> **Branch**: `fix/rich-blocks-post-message`
> **Date**: 2026-02-20
> **Commits**: 3 (1 fix/api + 1 fix/mcp + 1 docs)

## What

修复 F22 Rich Blocks 在 `post_message` 回调路径不工作的问题。两个 BACKLOG 条目：

### #83 (P1): `post-message` 回调路径不支持 Rich Blocks

**Root cause**: `extractRichFromText` 只在 `route-serial.ts:251`（猫调用路径）执行。`callbacks.ts` 的 `post-message` handler 直接存原始文本 + SSE 广播原始文本，不做 `cc_rich` 提取。

**Fix** (`callbacks.ts`):
1. 在 `messageStore.append` 前调用 `extractRichFromText(content)` 提取 `cc_rich` blocks
2. 存 `cleanText`（不含 cc_rich JSON）+ `extra.rich.blocks`
3. 每个提取的 block 广播为 `rich_block` SSE 事件
4. A2A mention 解析也使用 `cleanText`（避免 JSON 噪声干扰 @mention 检测）

**Tests**: 3 new (extraction + SSE broadcast + no-block fallback)

### #84 (P2): `create_rich_block` MCP 工具 Route A→B 降级

**Root cause**: `create_rich_block` 依赖 invocation-scoped callback token。Token 过期或非 invocation 场景下返回 401。

**Fix** (`callback-tools.ts`):
1. Route A: 先尝试直接 callback（`/api/callbacks/create-rich-block`）
2. Route A 失败 → Route B: 包装为 `cc_rich` 文本，通过 `post_message` 发送（#83 修复的提取在 server 端生效）
3. 两路都失败 → 返回 cc_rich hint 文本让猫手动嵌入

**Tests**: 5 new (Route A success + Route B fallback + both-fail hint + 2 validation)

## Why

F22 设计了双路径（MCP Route A + cc_rich Route B），但两条路径都只在猫调用（invocation）流程中工作。猫猫通过 `post_message`（回复提及、主动发言、A2A 等场景）发送的富块显示为原始 JSON 代码块，前端的渲染组件完整但数据到不了。

## Tradeoff

- #84 采用降级方案而非根治（session-scoped token），因为：
  - Route A + Route B 共享同一 callback token，Route A 失败时 Route B 大概率也失败
  - 但仍有价值：Route A 可能因非 auth 原因失败，Route B 作 fallback
  - 根治需要引入新 auth 机制（session-scoped token / API key），改动范围更大
- `callbacks.ts` 已 436 行（超 350 硬限），但这是 **pre-existing** violation（main 上已 421 行），本次改动仅增 15 行

## Open Questions

1. `callbacks.ts` 超 350 行是否需要本次拆分？还是单独开 ticket？
2. `create_rich_block` 的 session-scoped token 根治方案要不要单独记 BACKLOG？

## Self-Check Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` (api + mcp-server) | ✅ Clean |
| Tests (callback-routes) | ✅ 39/39 pass |
| Tests (callback-tools) | ✅ 23/23 pass |
| Biome (changed files) | ✅ No new violations |
| `pnpm check:dir-size` | ✅ All within thresholds |
| File sizes | ⚠️ Pre-existing: callbacks.ts 436 > 350 |

## Next Action

请 review 两个 fix 的代码改动 + 测试覆盖。重点关注：
- `extractRichFromText` 在 post-message 路径的集成是否完整
- Route A→B 降级逻辑是否有边界遗漏
- 测试是否覆盖关键路径
