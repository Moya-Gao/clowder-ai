# A2A Prompt Disambiguation Review Request（缅因猫 → 布偶猫）

## 背景
铲屎官反馈：多 variant 共存时，A2A 系统提示词里的 `@队友` 列表出现重复同名（例如 `@缅因猫 / @缅因猫`），提示层无法区分目标，属于可用性缺陷并会误导 A2A 路由使用。

## 设计文档
- Bug Report: `docs/bug-report/2026-02-23-a2a-prompt-variant-disambiguation/bug-report.md`
- 相关实现：`packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts`

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 多 variant 下 @队友列表不重复同名句柄 | ✅ | 同名组内去重 + 默认/非默认差异句柄 |
| 2 | 提供可区分可用句柄（如 `@gpt52`） | ✅ | 非默认 variant 优先使用 `@catId` |
| 3 | 不破坏现有 A2A mention 解析行为 | ✅ | `a2a-mentions` 回归全绿 |
| 4 | MCP callback 注入文案避免歧义示例 | ✅ | 文案增加“唯一句柄”提示 |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` | 修改 | 新增同名 displayName 场景的可区分 mention 生成逻辑 |
| `packages/api/src/domains/cats/services/agents/invocation/McpPromptInjector.ts` | 修改 | callback 注入文案增加“唯一句柄”示例 |
| `packages/api/test/system-prompt-builder.test.js` | 修改 | 新增 runtime 多 variant 歧义回归用例（Red→Green） |
| `packages/api/test/mcp-prompt-injector.test.js` | 修改 | 新增唯一句柄文案回归用例 |
| `docs/bug-report/2026-02-23-a2a-prompt-variant-disambiguation/bug-report.md` | 新增 | 5件套 bug report + Red/Green 证据 |

## Git SHA
- Base: `16bf165`
- Head: `32da1cf`
- Branch: `fix/a2a-prompt-disambiguation`

## 测试状态
```bash
pnpm --filter @cat-cafe/api build && node --test test/system-prompt-builder.test.js test/a2a-mentions.test.js test/mcp-prompt-injector.test.js
# 结果: 46 pass, 0 fail
```

## Review 重点
1. `SystemPromptBuilder` 的“默认 variant 保留 `@显示名`、非默认 variant 用 `@catId`”策略是否符合咱们长期语义。
2. `pickVariantMention` 在极端配置（variant 无 mentionPatterns）下 fallback 是否需要更严格约束。
3. MCP 注入文案是否需要进一步改成动态句柄（当前为静态示例）。

## 五件套

**What**: 修复 A2A 系统提示词在多 variant 下的 @队友歧义，并补齐回归测试与 bug report。

**Why**: 同名队友重复会误导协作行为，直接影响 A2A 可用性与稳定路由预期。

**Tradeoff**: 选择“提示词层做 disambiguation”而非“路由层做同名模糊推断”；放弃后者是为了避免把文案问题放大成路由不确定性。

**Open Questions**: 当默认 variant 不在可调用集合（被过滤/self）时，是否要对剩余 variant 继续保留某个“品种别名”入口。

**Next Action**: 请布偶猫 review 上述 5 个文件，给出放行/阻塞结论。

@布偶猫
请 review 这次 A2A 提示词歧义修复，重点看 mention 句柄策略是否要调整。
