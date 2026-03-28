# Review Request: F145 Phase B — `requires_mcp` + MCP doctor

Review-Target-ID: f145
Branch: feat/f145-phase-b

## What
- 给 `cat-cafe-skills/manifest.yaml` 增加 `requires_mcp`
- `check:skills` 读取 skill→MCP 依赖，missing/unresolved 时只报 advisory warning，不阻塞 manifest 校验
- `/api/skills` 返回 `requiresMcp` 状态，Hub Skills 表新增 “MCP 依赖” 列
- 新增共享脚本侧健康检查库 `scripts/lib/mcp-health.mjs`
- 新增 `pnpm mcp:doctor`，输出 `ready/missing/unresolved` 报告
- 导出 `hasUsableTransport()`，让 Phase A resolver 语义可被 Phase B 复用

## Why
Phase A 只解决了 resolver-backed pencil 的“声明态 vs 本机解析态”问题；Phase B 要把这个能力接到 skill 层和新机器引导层，让我们能回答两件事：

1. 某个 skill 依赖的 MCP 在这台机器上到底能不能用
2. 铲屎官 clone 仓库后，跑一条命令就能看到缺什么，而不是自己猜

## Original Requirements
> “我搞了一个新电脑，要把你们从 GitHub 下载回来，然后我这些 MCP 如果还要我自己一个个去挂就很奇怪了。”
> “我们现在就有个 bug，pencil MCP 写死用 antigravity 的插件，但是 vscode 其实也有插件，是一个东西。”

- 来源：[`docs/features/F145-mcp-portable-provisioning.md`](/Users/lysander/projects/relay-station/cat-cafe-f145-phase-b/docs/features/F145-mcp-portable-provisioning.md)
- **请对照上面的摘录判断交付物是否真的让“新机器 clone 后知道缺什么/怎么补”这件事变得可操作**

## Tradeoff
- 没把 `pnpm doctor` 硬顶到底。因为它和 pnpm builtin 冲突，真实可用入口改成了 `pnpm mcp:doctor`
- 没把 `install.sh` 一起接成自动 resolve/provision；这轮只做“声明依赖 + 状态诊断”，不做宿主自动安装
- 没给非 resolver-backed MCP 再造一层 resolver；`playwright` 继续按普通 stdio/npm MCP 处理

## Open Questions
1. `check:skills` 的 advisory warning 粒度是否合适，还是应该把 `disabled` 和 `not declared` 文案再拆开
2. `/api/skills` 在 route 层 live-resolve pencil 的实现位置是否合理，还是应该继续抽到共享层
3. `pnpm mcp:doctor` 现在对 missing/unresolved 直接 exit 1，这个语义是否够稳
4. 我顺手修了一个 pre-existing 的 biome 格式项 [`packages/api/test/shared-state-preflight.test.js`](/Users/lysander/projects/relay-station/cat-cafe-f145-phase-b/packages/api/test/shared-state-preflight.test.js)，只为让 `pnpm check` 过 gate；请确认这笔 scope 可以接受

## Next Action
请按严格标准 review，重点盯：
- `requires_mcp` schema 是否过轻或过重
- live resolve / resolved state / board status 三条链语义是否一致
- `mcp:doctor` 作为 Phase B 入口是否足够清晰

## 自检证据

### Spec 合规
- F145 Phase B 覆盖了 AC-B1 ~ AC-B5；其中 AC-B4/5 的命令入口按真实能力收敛为 `pnpm mcp:doctor`
- 无 `.pen` 设计稿匹配：`designs/**/*.pen` 下没有 `f145` / `mcp` / `skill` 相关文件
- Artifact hygiene：仓库根目录无未跟踪媒体垃圾

### 测试结果
- `node --test scripts/check-skills-manifest.test.mjs scripts/mcp-doctor.test.mjs` → 8/8 pass
- `pnpm --filter @cat-cafe/api run build && cd packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 node --test test/skills-route.test.js` → build 成功，6/6 pass
- `pnpm --filter @cat-cafe/web run build` → exit 0（仅有仓库既有 lint warnings）
- `pnpm --filter @cat-cafe/web run lint` → exit 0（仅有仓库既有 warnings）
- `pnpm check:skills` → PASS；另有 2 条预期 advisory warning：
  - `pencil-design -> pencil: missing`
  - `browser-automation -> playwright: missing`
- `pnpm mcp:doctor` → 当前 worktree 下准确返回 `missing`（因为这棵隔离 worktree 没有 `.cat-cafe/capabilities.json`），并以 exit 1 表示“本机依赖未就绪”
- `pnpm check` → 通过

### 相关文档
- Feature: [`docs/features/F145-mcp-portable-provisioning.md`](/Users/lysander/projects/relay-station/cat-cafe-f145-phase-b/docs/features/F145-mcp-portable-provisioning.md)
- Mailbox: [`docs/mailbox/2026-03-27-f145-phase-b-review-request.md`](/Users/lysander/projects/relay-station/cat-cafe-f145-phase-b/docs/mailbox/2026-03-27-f145-phase-b-review-request.md)
