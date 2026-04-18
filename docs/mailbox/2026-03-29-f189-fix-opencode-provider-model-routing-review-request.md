# Review Request: fix(clowder-ai#223) restore provider/model single source of truth

Review-Target-ID: fix-opencode-provider-model-routing
Branch: feat/fix-opencode-provider-model-routing

## What

修复 opencode 成员在 `ocProviderName` 匹配 builtin provider 时跳过 `OPENCODE_CONFIG` 生成的 bug。6 文件改动（4 API + 2 Web）。

核心变更：
1. **invoke-single-cat.ts** — BUILTIN guard 增加 `baseUrl` 检测，custom endpoint 不再被跳过
2. **account-resolver.ts** — 验证器接受 `provider/model` 格式，`ocProviderName` 降为 legacy fallback
3. **HubCatEditor.tsx + hub-cat-editor.sections.tsx** — Provider 名称改为可选，提示用 `provider/model` 格式
4. **两个测试文件** — 路由测试 Case 2 翻转（provider/model → 201），新增回归测试

## Why

F127 intake 决策（2026-03-26；Upstream: clowder-ai#223）明确禁止 `ocProviderName` 作为独立真相源，但当前代码全链路依赖它。铲屎官创建 MiniMax 成员时，`ocProviderName="anthropic"` 导致 builtin guard 跳过 custom config，opencode CLI 收到裸 `MiniMax-M2.7` 无法路由。

## Original Requirements

> 我选择的模型是 MiniMax-M2.7 但是你看我们系统读到的是 MiniMax-M2.7/
> — 铲屎官，2026-03-29 对话

- 来源：本次对话（bug report，非 Discussion 文档）
- **请对照判断：创建 opencode 成员使用 Anthropic-compatible API + 非 Anthropic endpoint 时，model routing 是否正常工作**

## Tradeoff

- 未做完整的 `ocProviderName` 字段清除（涉及面太广，需要单独 feat），仅降级为 legacy fallback
- Hub 表单保留 Provider 名称字段（标为可选），而非直接删除，兼容已有成员

## Open Questions

1. `invoke-single-cat.ts:788` 的 `Boolean(resolvedAccount.baseUrl)` 条件——是否有 builtin provider 也设 baseUrl 的合法场景？如果有，这里可能误触发 custom config
2. 现有成员的 `defaultModel` 是裸格式（如 `MiniMax-M2.7`），需要铲屎官手动改成 `minimax/MiniMax-M2.7` 还是代码兼容两种？（当前代码通过 `ocProviderName` fallback 兼容）

## Next Action

请 review 这 6 个文件的改动，重点关注 Open Questions 中的两个场景。

## 自检证据

### Spec 合规

| # | 砚砚交接要求 | 状态 |
|---|-------------|------|
| 1 | route 接受 provider/model 不强制 ocProviderName | ✅ |
| 2 | Hub 不再强制填写 Provider 名称 | ✅ |
| 3 | invocation 以 defaultModel 为主，ocProviderName legacy | ✅ |
| 4 | 测试翻转为 provider/model 主路径 | ✅ |

### 测试结果

```
node --test cats-routes-runtime-crud.test.js invoke-single-cat.test.js
  → 81/86 pass, 5 fail (pre-existing cat-template.json ENOENT)
pnpm check (Biome)  → 4/4 pass, 0 errors
pnpm lint (TS)      → 0 new errors
pnpm build          → exit 0
```

### 相关文档

- Intake: `docs/ops/2026-03-26-clowder-pr223-intake-strategy.md`
- 砚砚定位分析: 对话历史 0001774769503840
