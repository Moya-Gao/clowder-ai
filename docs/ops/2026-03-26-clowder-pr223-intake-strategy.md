---
title: clowder-ai#223 Intake Strategy
date: 2026-03-26
topics: [open-source, intake, clowder-ai, opencode, provider-profiles, f189]
status: active
owner: 缅因猫-gpt5.4
---

# clowder-ai#223 Intake Strategy

## Scope

本轮处理社区 PR：

- `clowder-ai#223` `feat(F189): ocProviderName + OpenCode custom provider config`（原文保留；`F189` 为伪锚点，实际映射 `clowder-ai#223`）

upstream 已于 `2026-03-26T08:49:19Z` squash merge，merge commit 为 `24740ee8c3083b9e1e66abfff334f244d3fe82f7`。

## Decision

- Merge 立场：可 merge
- Intake 立场：`absorbed`
- 吸收方式：`manual-port`

这条 intake **不是** safe-cherry-pick。source 侧（Cat Café）已经在 F127 中把 opencode 的模型语义定为 `provider/model`，而 upstream `#223` 的主线是引入 `ocProviderName` 字段去补这个信息。我们不能把 target 的契约形状直接搬回家里，否则会和 source truth 冲突。

> 备注：`scripts/intake-from-opensource.sh --pr 223 --mode=plan` 当前会把这条 PR 机械地归到 `safe-cherry-pick`。这是 classifier 的保守默认，不理解 F127 语义分歧；本轮以这份策略文档为准，人工 override 为 `manual-port`。

## Source / Target Divergence

### Target（clowder-ai）

- Hub / API 通过 `ocProviderName` 显式记录上游 provider
- `opencode + api_key` 的兼容桥围绕 `ocProviderName` 展开
- UI 会让用户单独编辑 provider 名称

### Source（cat-cafe）

- F127 已明确约束 `opencode` 的 `defaultModel` 使用 `provider/model` 格式
- Hub 和 API 现有校验都围绕 `providerId/modelId` 语义工作
- source 不需要再额外引入一个 `ocProviderName` 字段，否则会产生双真相源

## Intake Shape

### Absorb

吸收 upstream 里真正有价值、且和 source 语义兼容的部分：

- invocation-scoped OpenCode runtime config 生成
- custom provider 的 runtime `provider` block
- API key / base URL 通过 env 注入到临时 runtime config
- invocation 结束后的临时 config 清理
- 针对 custom provider 路径的回归测试

### Do Not Absorb

显式不带回家的 upstream 形状：

- `ocProviderName` 字段及其在 loader / route / Hub form 上的显式存储
- 为 `ocProviderName` 服务的前后端校验与 UI 字段
- `ProcessLivenessProbe` 的 Windows CPU 采样修补
- `ClaudeAgentService` 的 `ANTHROPIC_AUTH_TOKEN` 兼容改动
- `hub-cat-editor.sections.tsx` 里和本轮 intake 无关的 `autoSlug` / ComboField 结构变化

以上项要么与 source truth 冲突，要么是独立问题，后续如有需要另立 intake / fix，不顺手混入这轮 clowder-ai#223 intake。

## Implementation Notes

- 保持 source 的 `provider/model` 语义：从 `defaultModel` 解析 custom provider 名称，而不是新增 `ocProviderName`
- 仅当：
  - `provider === 'opencode'`
  - 绑定账号是 `api_key`
  - `defaultModel` 能解析出 provider 前缀
  - provider 不属于 builtin 集合
  时，才写 invocation-scoped runtime config
- runtime config 文件落在 `.cat-cafe/opencode-runtime-{catId}-{invocationId}.json`
- invocation `finally` 中强制删除 runtime config，避免污染工作目录

## Validation Requirements

- API build 通过
- `opencode-config-template` 单测覆盖：
  - `provider/model` 解析
  - runtime config 生成
  - invocation-scoped 文件写入
- `invoke-single-cat` 回归覆盖：
  - custom provider 收到 `OPENCODE_CONFIG`
  - env 注入正确
  - invocation 结束后 runtime config 已清理

## Tradeoff

- 不把 `ocProviderName` 带回家，意味着 source / target 在 clowder-ai#223 上继续存在实现差异；但这是有意的 source-owned 差异，不是漏吸
- 这轮吸收的是“custom provider runtime wiring”，不是“把 upstream 的表单契约原样复制”
- 通过 manual-port 保住 source truth，可以避免再次引入双真相源和配置漂移
