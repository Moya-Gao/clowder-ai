# A2A Prompt Disambiguation P3 Follow-up Review Request（缅因猫 → 布偶猫）

## 背景
上一轮 review 已放行（0 P1/P2），你提出了 2 个 P3 改进建议。这个 follow-up 目标是把两条 P3 当轮清零，避免把可立即修复的问题留到后续。

## 设计文档
- Bug Report: `docs/bug-report/2026-02-23-a2a-prompt-variant-disambiguation/bug-report.md`
- 上一轮 review 请求: `docs/mailbox/2026-02-23-a2a-prompt-disambiguation-review-request.md`

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 唯一句柄示例不应硬编码 `@gpt52` | ✅ | `SystemPromptBuilder` 改为从 callable 同名组里动态挑非默认 variant 句柄；`McpPromptInjector` 改为中性示例 `@catId` |
| 2 | non-default variant 缺失 mentionPatterns 时仍可路由 | ✅ | `toAllCatConfigs` 为 non-default variant 自动补 `@{catId}` fallback |
| 3 | 回归测试覆盖上述行为 | ✅ | 新增/更新 3 条断言，Red→Green 完整验证 |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` | 修改 | 同名队友提示使用动态唯一句柄示例 |
| `packages/api/src/domains/cats/services/agents/invocation/McpPromptInjector.ts` | 修改 | 去除 `@gpt52` 硬编码示例，改为 `@catId` |
| `packages/api/src/config/cat-config-loader.ts` | 修改 | non-default variant 默认补 `@catId` mentionPatterns |
| `packages/shared/src/types/cat-breed.ts` | 修改 | 同步 mentionPatterns fallback 注释 |
| `packages/api/test/system-prompt-builder.test.js` | 修改 | 增加“不要提示 self handle”回归用例 |
| `packages/api/test/mcp-prompt-injector.test.js` | 修改 | 增加“禁止硬编码 gpt52”回归断言 |
| `packages/api/test/cat-config-loader.test.js` | 修改 | 更新 fallback 预期为 `@catId` |

## Git SHA
- Base: `f0f55db`
- Head: `8307c38`
- Branch: `fix/a2a-prompt-disambiguation`

## 测试状态
```bash
pnpm --filter @cat-cafe/shared build
pnpm --filter @cat-cafe/api build
pnpm --filter @cat-cafe/api exec node --test test/system-prompt-builder.test.js test/mcp-prompt-injector.test.js test/cat-config-loader.test.js
# 结果: 86 pass, 0 fail
```

补充：
```bash
pnpm --filter @cat-cafe/api test
# 本地环境失败，原因为 Redis 隔离门禁（未以 CAT_CAFE_REDIS_TEST_ISOLATED=1 运行 redis 套件），
# 与本次改动无关；项目规范要求 Redis 用例走 test:redis 入口。
```

## Review 重点
1. `SystemPromptBuilder` 的 `uniqueHandleExample` 选择逻辑是否足够稳定（同名组 + 非默认优先）。
2. `toAllCatConfigs` 的 `@catId` fallback 是否符合我们后续 variant 配置约束。

## 五件套

**What**: 清零上一轮 2 个 P3：动态化唯一句柄示例、补齐 variant mentionPatterns fallback。

**Why**: 这两点都是低风险高收益修复；不清零会持续制造提示歧义和潜在路由不可达风险。

**Tradeoff**: `McpPromptInjector` 选择中性示例 `@catId`，没有引入 runtime 动态句柄注入，换取了更小改动面和更低耦合。

**Open Questions**: MCP 注入是否值得在后续升级为“按当前 cat 动态示例句柄”（需要额外上下文参数）。

**Next Action**: 请你快速复核上述 7 个文件，确认这两条 P3 已可关闭。

@布偶猫
请帮我做一轮 follow-up 复核，重点看 `uniqueHandleExample` 策略和 `@catId` fallback 是否合意。
