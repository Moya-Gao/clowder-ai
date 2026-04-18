# Review Request: fix(clowder-ai#223): OPENCODE_CONFIG env var never read by opencode CLI

Review-Target-ID: f189-fix-opencode-config-dir
Branch: (changes in working tree, will create branch at merge-gate)

## What

`OPENCODE_CONFIG` env var is a cat-cafe invention that opencode CLI never reads.
opencode supports `OPENCODE_CONFIG_DIR` (overrides user config directory via
`getCliConfigDir()` in oh-my-opencode). The runtime config file was generated
correctly but completely ignored — opencode fell back to its built-in provider
registry which routed `minimax/*` to `api.minimax.io` (OpenAI endpoint), causing
`invalid api key (2049)`.

**3 source files + 3 test files changed (60 insertions, 53 deletions):**

| File | Change |
|------|--------|
| `opencode-config-template.ts` | `writeOpenCodeRuntimeConfig()` now creates per-invocation subdir (`oc-config-{catId}-{invocationId}/opencode.json`), returns **directory** path |
| `invoke-single-cat.ts` | `OPENCODE_CONFIG` → `OPENCODE_CONFIG_DIR`, cleanup uses `rm -r` |
| `OpenCodeAgentService.ts` | `buildEnv()` checks `OPENCODE_CONFIG_DIR` |
| 3 test files | All assertions updated to match new env var + directory structure |

## Why

铲屎官 reported `@mini hi` → `invalid api key (2049)`. 砚砚 confirmed the bug is
in the invocation handoff layer, not user config. All direct reproduction tests
pass (opencode CLI works fine with the same config), isolating the issue to
how cat-cafe passes the config to the spawned process.

**Evidence chain:**
- `(2049)` is MiniMax OpenAI-format error → request hitting wrong endpoint
- oh-my-opencode source confirms: `OPENCODE_CONFIG_DIR` (line 16823) is real,
  `OPENCODE_CONFIG` does not exist
- Config file was written to `.cat-cafe/opencode-runtime-*.json` but opencode
  only reads `opencode.json` from standard dirs or `OPENCODE_CONFIG_DIR`

## Original Requirements（必填）
> [16:03 铲屎官] @opus 我按照你说的改了。没用啊
> [16:32 铲屎官] @gpt52 布偶猫看起来找错方向了，你要不你来接受解决这个事情？1. 我身为用户如何配置？2. 我们有bug吗？
> [砚砚 结论] "我们有 bug, 在 invocation handoff 层, 不是用户配置问题"
- 来源：当前 thread 对话历史
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

**选择 `OPENCODE_CONFIG_DIR`**（覆盖用户配置目录）而非 `OPENCODE_CONFIG_CONTENT`
（JSON 字符串注入）。原因：
- `OPENCODE_CONFIG_DIR` 是标准的目录级 override，语义清晰
- `OPENCODE_CONFIG_CONTENT` 在 oh-my-opencode 中仅用于 permission 提取，非通用配置注入
- 副作用：自定义 provider 的猫不再加载全局 `~/.config/opencode/opencode.json`（只加载
  runtime 注入的配置 + 项目级配置）。这是 **正确的行为**——minimax 猫不需要全局的
  anthropic provider 配置

## Open Questions

1. **tmux env null 泄漏**（砚砚也发现了）：`buildEnv()` 设 `ANTHROPIC_API_KEY = null`，
   但 tmux spawner 跳过 null 值（不 unset）。对此次修复无影响（`OPENCODE_CONFIG_DIR`
   让 opencode 正确路由 provider，不再依赖 anthropic env vars），但属于独立 tech debt
2. 需要铲屎官重启 runtime 服务后实测 `@mini hi`

## Next Action

请 review 这 6 个文件的 diff，重点关注：
- `writeOpenCodeRuntimeConfig()` 从返回文件路径改为返回目录路径的 API 变更
- 清理逻辑从 `rm(file)` 变为 `rm(dir, { recursive: true })` 是否安全
- 测试的 `readFile(join(dir, 'opencode.json'))` 断言是否完备

## 自检证据

### Spec 合规
- 根因定位：`OPENCODE_CONFIG` 无人读取 ✅
- 修复使用 opencode 官方支持的 `OPENCODE_CONFIG_DIR` ✅
- 保持 per-invocation 隔离（子目录 + 唯一 invocationId）✅
- cleanup 从 `rm file` → `rm -r dir` 正确升级 ✅

### 测试结果
```
opencode-config-template.test.js: 17 passed, 0 failed
opencode-agent-service.test.js:   19 passed, 0 failed
invoke-single-cat.test.js (clowder-ai#223): 7 passed, 0 failed
invoke-single-cat.test.js (full): 64 passed, 4 failed (pre-existing, unrelated)
pnpm --filter @cat-cafe/api build: success
```

### 相关文档
- Feature: F127 (OpenCode provider/model routing)
- Upstream: clowder-ai#223
- 砚砚诊断：invocation handoff 层 bug，铲屎官配置正确
