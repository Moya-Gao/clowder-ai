---
feature_ids: [F180]
doc_kind: review-request
created: 2026-04-29
---

# Review Request: F180 Phase A+B — Agent CLI Hook Health API

Review-Target-ID: f180
Branch: feat/f180-agent-cli-hook-health
Implementation Commit: 6f3f56f82
Scope Cleanup Commit: 102d1f478
Review Feedback Commit: 26b763c77
Reviewer: @opus-47

## What

F180 Phase A+B 后端实现已完成：

- 新增 `packages/api/src/agent-hooks/`，把 user-level hook targets、drift 检测、同步写入、health status mapping 抽成 API/CLI 共用模块。
- `scripts/sync-system-prompts.ts` 改为复用同一个 `buildAgentHookTargets` / `checkDrift` / `applySync` 真相源。
- 新增 `GET /api/agent-hooks/status` 与 `POST /api/agent-hooks/sync`，检测不写入，显式 POST 才写 user home。
- Claude settings 写入只增删 Cat Cafe managed SessionStart/Stop command entry，保留未知 user hook。
- Managed hook 匹配已收紧到目标 home 的 `.claude/hooks/` 路径，避免同名外部脚本被误删。
- Codex `hooks.json` 每次按当前目标 home 本机渲染，JSON health 使用 canonical 比较。

## Why

铲屎官指出：只补安装流程不够，现有用户、安装包用户、新线程/新项目入口都需要检测 hook 是否已安装，并给出一键同步修复路径。Phase A+B 先交付后端 contract/API，供 source install、desktop first-run 和 Hub surface 复用。

## Original Requirements

> 铲屎官：安装流程是可以，但是现在的用户的？是不是得和我们家比如新建 project 那些那样，检测一下 hook 安装没有？比如新建 thread 如果检测到 hook 没安装点击一下同步安装啊！
>
> 铲屎官：新用户记得考虑如果是安装包的？这个场景你现在的设计 cover 了吗？
>
> 铲屎官：你这里主要聚焦完成这个 issue。

来源：本 thread 2026-04-29 F180 讨论；spec 落点为 `docs/features/F180-agent-cli-hook-health.md`。

## Tradeoff

- 没把 hook target 再做一套 API 私有列表，而是把既有 sync script 的 target 生成逻辑移动到共用模块；脚本和 API 都依赖同一个实现。
- `GET status` 对缺失 Codex config dir 返回 `unsupported`，避免把未安装 Codex 当成错误；`POST sync` 仍可按用户显式动作创建 `hooks.json`。
- `sync-system-prompts.test.ts` 的动态 roster count 修正已拆成独立 `chore` commit，不再混在 F180 implementation commit。
- Phase C/D 的 install、outbound manifest、前端 health surface 不混进本次代码，避免把后端 contract review 变成安装器/UI review。

## Open Questions

请重点看：

1. `claude-settings.ts` 的 managed hook 合并规则是否足够保守，是否会误删用户自定义 hook。
2. `sync-targets.ts` 的 JSON canonical 比较和 Codex 绝对路径渲染是否满足你 spec review 里要求的本机解析 invariant。
3. `agent-hooks.ts` route 的身份校验和显式 POST 写入边界是否够清楚。
4. Phase C 的 `sync-manifest.yaml` 仍由 install/outbound work 承接；请确认本次 A+B 没把这件事提前做错。

## Next Action

请做 code review，给明确结论：LGTM 或 changes requested。若有 blocking 问题，我按 `receive-review` 处理。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f180/opus-47`
- Start Command: `pnpm review:start`
- Ports: N/A；本次为 backend/API contract review，无前端 dev server 或浏览器取证要求。

## 自检证据

### Spec 合规

- AC-A1/A5: shell script 使用字节级比较；Codex JSON 使用 canonical compare；missing/stale 返回 diff-like summary。
- AC-A2/B2: Claude `settings.json` 检测与同步覆盖，保留未知 hook entries；同 basename 但不在目标 `.claude/hooks/` 下的用户脚本不会被删。
- AC-A3/KD-5: Codex hooks command path 按目标 home 即时渲染，不 ship 静态绝对路径。
- AC-A4: `HealthResult extends DriftResult`，状态映射覆盖 configured/missing/stale/unsupported/error。
- AC-B1/B5: CLI 与 API 共用 `buildAgentHookTargets` / `checkDrift` / `applySync`，定向测试验证写入结果与 renderer 字节一致。
- AC-B3/B4: `GET status` 不写文件；`POST sync` 显式写入后重新检测。

### 设计稿对照

`find designs -name '*.pen' -print | rg -i 'f180|hook|agent' || true`

结果只命中既有 `F143-hostable-agent-runtime.pen` / `F122-queue-panel-agent-entries.pen` 的 agent 关键词；无 F180/hook 专用设计稿。本次无前端改动。

### 验证命令

- `pnpm check` → exit 0；Biome clean；feature truth / env / guide / tail scan 全绿；skills manifest 仅既有 advisory warnings。
- `pnpm lint` → exit 0；仅既有 Web hardcoded color / React hook warnings。
- `pnpm -r --if-present run build` → exit 0；仅既有 Web lint warnings。
- `pnpm test` → exit 0；API summary: 9692 tests, 9689 pass, 3 skipped, 0 fail。
- Targeted: `pnpm --filter @cat-cafe/api run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --import $(pwd)/packages/api/test/helpers/setup-cat-registry.js --test --test-timeout=60000 packages/api/test/agent-hooks.test.js && pnpm exec tsx --test scripts/sync-system-prompts.test.ts` → 6 agent-hook tests pass, 14 sync-system-prompts tests pass.

### Gate 辅助检查

- `node scripts/check-hotfix-pattern.mjs` → hotfix=false。
- `node scripts/check-fallback-layers.mjs` → total net +6，no threshold trigger after refactor.
- 根目录媒体/设计工件闸门：工作树与 `origin/main...HEAD` 差异均无命中。
- 主 worktree `cat-cafe/` status clean；feature worktree status clean。

[砚砚/GPT-5.5🐾]
