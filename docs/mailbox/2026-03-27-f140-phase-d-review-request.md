# Review Request: F140 Phase D — PR Tracking 注册校验护栏

Review-Target-ID: f140-phase-d
Branch: feat/f140-phase-d

## What
PR tracking 注册前新增 `gh repo view` 校验，拦截不存在或无权限的仓库。两条注册路径（`/api/pr-tracking` + `/api/callbacks/register-pr-tracking`）都加了校验。Injectable validator 设计，测试用 mock。

## Why
2026-03-25 一次 merge-gate 注册了 `anthropic-cat-cafe/cat-cafe#743`（repo 不存在），脏数据驻留导致 F139 CI/CD Check 轮询假仓库。

## Original Requirements（必填）
> "别硬编码我们自己的仓库...应该是开源社区小伙伴在写别的项目也能用的"
> "ci cd check 最新的怎么会是anthropic-cat-cafe/cat-cafe#743...你们到底注册了什么到f139的定时任务里面？"
- 来源：铲屎官 2026-03-26 23:44 + 23:28 对话
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 选择 `gh repo view` 而非 GitHub API（无需 token 管理，复用 `gh` CLI 已有认证）
- 校验是可选注入（`validateRepo?`），不传则跳过——向后兼容，测试无需 mock CLI

## Open Questions
1. 422 vs 400 作为"repo 不存在"的状态码——选了 422（Unprocessable Entity：格式合法但语义无效）
2. `gh repo view` 超时设 10s，是否合适？

## Next Action
请 review 代码变更（4 文件，+102 行），重点关注：
- 校验逻辑是否有绕过路径
- 错误消息是否 leak 不该暴露的信息
- `gh` CLI 依赖是否合理

## 自检证据

### Spec 合规
| AC | 状态 | 位置 |
|----|------|------|
| D1: `gh repo view` 校验 | ✅ | `index.ts:896-905` |
| D2: 无硬编码 | ✅ | generic `validateRepo` |
| D3: 两条路径 | ✅ | `pr-tracking.ts:64` + `callbacks.ts:1019` |
| D4: 测试覆盖 | ✅ | 3 tests: reject/accept/compat |

### 测试结果
```
pnpm test (PR tracking suite) → 19/19 pass, 0 failed
pnpm check → 0 errors (biome)
pnpm lint → 0 errors (tsc)
```

### Diff 概览
```
packages/api/src/index.ts                   | +17 (validateRepo 实现 + 注入)
packages/api/src/routes/callbacks.ts        | +12 (option + 校验)
packages/api/src/routes/pr-tracking.ts      | +12 (option + 校验)
packages/api/test/pr-tracking-route.test.js | +63 (3 tests)
```

### 相关文档
- Feature: `docs/features/F140-github-pr-automation.md` Phase D
- Root cause: 铲屎官 + GPT-5.4 调查 `anthropic-cat-cafe/cat-cafe#743` 脏数据
