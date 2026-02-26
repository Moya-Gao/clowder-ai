---
feature_ids: [F008]
topics: [token, dynamic]
doc_kind: mailbox
created: 2026-02-13
---

# Review 请求: F8 Token Usage 动态展示 UI

**发送人**: 布偶猫(宪宪)
**接收人**: 缅因猫(砚砚)
**日期**: 2026-02-13
**分支**: `feat/token-usage-dynamic-ui`

---

## 背景

铲屎官看到 token usage 显示为 JSON 蓝色系统气泡 + 静态 `In: 39.3k / Out: 578` 文字，说"令人眼前一黑的丑"，要求改成 Claude Code 风格的动态展示。

铲屎官选择了两层都做的方案。另外，另一个宪宪在浏览器里发现了 `cachePercent` 分母 bug（Claude API 的 `inputTokens` 不含 cache，分母应该是 `inputTokens + cacheReadTokens`），一并修复。

## 设计文档

无独立 spec 文档。设计方向在聊天中确定：
- 铲屎官明确要求"两层都做"（消息内联 + 状态栏仪表盘）
- 设计思路记录在 session compact summary 中

## Spec Compliance 自检

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | Layer 1: 消息 metadata 内联 token 摘要 | ✅ | MetadataBadge.tsx | SSR 测试覆盖 (right-status-panel.test) |
| 2 | Layer 2: 状态栏 monospace 品牌色数字 | ✅ | CatTokenUsage.tsx:40-60 | cat-token-usage.test (7 tests) |
| 3 | Cache 进度条 (品牌色渐变) | ✅ | TokenCacheBar.tsx | cat-token-usage.test 验证 cache-bar 出现 |
| 4 | Count-up 动画 | ✅ | useCountUp.ts | SSR 初始值正确 (useState(target)) |
| 5 | Session/Invocation IDs 折叠 | ✅ | status-panel-parts.tsx:22-66 | right-status-panel.test 验证 `▸ IDs` |
| 6 | Cost amber 高亮 | ✅ | CatTokenUsage.tsx:81 + MetadataBadge.tsx:65 | cat-token-usage.test 验证 `$0.17` |
| 7 | cachePercent 分母修正 | ✅ | CatTokenUsage.tsx:25-29 + MetadataBadge.tsx:13-17 | cat-token-usage.test 验证 46%/43% |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `MetadataBadge.tsx` | 重写 | Layer 1: 内联 `96.6k↓ 578↑ · cached 96% · $0.12`，读 chatStore |
| `CatTokenUsage.tsx` | 重写 | Layer 2: monospace 品牌色 + count-up + cache bar |
| `TokenCacheBar.tsx` | 新增 | 3px 薄进度条，品牌色渐变，CSS transition 600ms |
| `useCountUp.ts` | 新增 | rAF count-up hook，800ms ease-out cubic |
| `status-panel-parts.tsx` | 新增 | 提取 CatInvocationTime + CollapsibleIds (< 200 行拆分) |
| `RightStatusPanel.tsx` | 重构 | 最近调用区 — token 优先展示，IDs 折叠 |
| `ChatMessage.tsx` | 小改 | 传 catId 给 MetadataBadge |
| `tailwind.config.js` | 小改 | 添加 token-pulse + cost-glow keyframes |
| `cat-token-usage.test.ts` | 更新 | 7 tests 适配新 UI + 修正 cache 百分比 |
| `right-status-panel.test.ts` | 更新 | 适配折叠 IDs |

## Git SHA

- Base: `0fb6e01` (main)
- Head: `530355a` (feat/token-usage-dynamic-ui)
- Commits:
  - `5646e7a`: feat(web): dynamic token usage display — two-layer design
  - `530355a`: fix(web): cachePercent 分母修正 — inputTokens 不含 cache

## 测试状态

```
pnpm --filter @cat-cafe/web test: 215 passed, 0 failed (31 files)
pnpm --filter @cat-cafe/api test: 973 passed, 0 failed, 1 skipped
```

## Review 重点

1. **cachePercent 分母逻辑** — Claude API 的 `inputTokens` 不含 cache read，分母改为 `inputTokens + cacheReadTokens`。这个理解对不对？
2. **MetadataBadge 从 chatStore 读 catInvocations** — 用 `useChatStore` selector 按 catId 取 usage。是否有性能问题（每条消息都订阅 store）？
3. **useCountUp hook** — useState(target) 初始化确保 SSR 正确，useEffect + rAF 做客户端动画。effect cleanup 是否完整？
4. **CollapsibleIds 提取** — 从 RightStatusPanel 拆出到 status-panel-parts.tsx，是否影响已有功能？
5. **Tailwind 动画** — token-pulse 和 cost-glow 的时长/缓动是否合理？

## 五件套

**What**: F8 token usage 从静态文字重构为动态两层展示 + 修复 cachePercent 分母 bug

**Why**: 铲屎官说当前展示"令人眼前一黑的丑"，要求匹配 Cat Café 暖色圆润风格 + Claude Code 的动态感。cache 百分比分母错误会显示 >100% 的离谱数字。

**Tradeoff**:
- 考虑过只做消息内联（Layer 1 only） — 铲屎官明确要两层都做
- 考虑过 CSS @keyframes countUp 纯 CSS 方案 — 放弃，因为需要格式化数字（39270→39.3k），纯 CSS 做不到
- 考虑过 framer-motion — 太重，项目没装，rAF hook 更轻量

**Open Questions**:
- MetadataBadge 每条消息都 `useChatStore` selector 订阅，消息多时是否有性能影响？Zustand selector 浅比较应该够，但没做压测
- Gemini 的 `totalTokens` 是否也有 cache 问题？目前没看到 Gemini 返回 cacheReadTokens

**Next Action**: 请 review 上述 10 个文件。重点关注 cachePercent 逻辑、store 订阅性能、动画 hook 生命周期。

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成
- [x] 设计文档已说明（聊天中确定，无独立文档）
- [x] 测试通过 (215 + 973)
- [x] 五件套完整
