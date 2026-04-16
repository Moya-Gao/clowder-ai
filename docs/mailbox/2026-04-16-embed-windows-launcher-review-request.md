---
doc_kind: review-request
created: 2026-04-16
topics: [embedding, windows, launcher, sync, opensource]
---

# Review Request: Embed Multi-Platform Launcher Hardening

Review-Target-ID: fix-embed-sync
Branch: `fix/embed-sync`

## What

把 embedding sidecar 的启动链从“mac/Unix 半通、Windows 缺口、开源导出还会漏文件”补成跨平台可用：

- `scripts/start-dev.sh` 现在会从 `EMBED_MODE=on|shadow` 自动推导本地 sidecar 启动，`EMBED_ENABLED` 只保留为显式 override
- `scripts/setup.sh` / `scripts/embed-server.sh` 改成平台分支：`Darwin + arm64` 走 MLX，其他平台走 `sentence-transformers + torch`
- 新增 `scripts/embed-server.ps1`，让 Windows 本机也能起 embedding sidecar
- `scripts/start-windows.ps1` 补齐 local/remote `EMBED_URL` 语义、本机 sidecar 编排、端口等待和 fail-open 行为
- `scripts/embed-api.py` 的 fallback 设备选择改成 `cuda -> mps -> cpu`
- `sync-manifest.yaml` + `scripts/sync-to-opensource.sh` 修正开源导出链，确保 embed 脚本不会再漏，且 dry-run/validate 能带上 allowlist 的未跟踪新文件
- `.env.example*` / `SETUP.opensource*` 文档同步更新

## Why

当前问题不是单点 bug，而是两层断链叠在一起：

1. 开源导出漏了 embedding 脚本，导致社区用户拿到的包先天不完整
2. Windows 根本没有本机 embedding launcher，用户只能自己拼外部服务

这两条不补齐，就算 API 侧已经支持 `EMBED_URL`，实际用户路径仍然是 broken。

## Original Requirements

> “社区小伙伴发现 我们的记忆系统 embedding没同步py脚本启动不起来？”
> “那如果人家不是mac场景咋办？”
> “好像得让人支持 url or 用自己的显卡/cpu？”
> “把这个做了？”

- 来源：当前 thread 对话 + 用户截图（2026-04-16）
- 请对照上面的摘录判断：这次交付是否真的把“开源可拿到脚本、非 mac 可跑、本机/远端都支持、Windows launcher 补齐”四件事一起收口，而不是只修了其中一半。

## Tradeoff

- 没有把 Windows 路径做成 in-process embedding，因为 LL-034 已经明确否定这条脚手架路线；本轮坚持 sidecar + HTTP
- 没有为了让 `pnpm check` 变绿而顺手改 `docs/features/index.json`，因为那是当前仓库的既存生成物噪音，不是本轮 embedding diff
- 还没有做真实 Windows 机器 smoke test；这轮证据停在脚本逻辑、回归测试、导出验证和全仓 build

## Open Questions

1. `start-windows.ps1` 里对 `EMBED_URL` 的判断是否足够稳妥？当前策略是：空值或 loopback URL → 本机 sidecar，其余绝对 URL → 远端服务
2. `scripts/sync-to-opensource.sh` 在 `--dry-run/--validate` 模式下改成导出 tracked + untracked allowlist 文件，这个行为边界你是否认同？
3. 就 merge gate 而言，你是否要求补一条“真实 Windows smoke evidence”，还是脚本/导出/回归覆盖已经足够放行？

## Next Action

请重点 review：

- Windows launcher 语义是否和 Unix 路径一致：`EMBED_MODE` 控制启用，`EMBED_URL` 决定本机还是远端
- `embed-server.ps1` / `start-windows.ps1` 的 fail-open 和端口收口是否合理
- `sync-to-opensource.sh` 的 dry-run 行为修正是否会引入副作用

如果没有 P1/P2，请放行我继续推进后续提交/PR。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/fix-embed-sync/opus`
- Start Command: `pnpm review:start`
- Ports: 纯脚本 / 启动链改动，无需启动前端；核心回归命令是 `node --test scripts/start-dev-profile-isolation.test.mjs`

## 自检证据

### Spec 合规

- 报告：`docs/mailbox/2026-04-16-embed-windows-launcher-quality-gate.md`
- 对照基线：
  - `docs/decisions/020-f102-memory-system-architecture.md`
  - `docs/lessons-learned.md` 的 LL-034

### 测试结果

```bash
bash -n scripts/start-dev.sh scripts/setup.sh scripts/embed-server.sh scripts/sync-to-opensource.sh
python3 -m py_compile scripts/embed-api.py
node --test scripts/check-env-example.test.mjs
node --test scripts/start-dev-profile-isolation.test.mjs
git diff --check
pnpm -r --if-present run build
pnpm check
```

结果：

- 脚本语法检查 ✅
- Python 语法检查 ✅
- env example 回归 `4 pass, 0 fail` ✅
- start profile / export 回归 `12 pass, 0 fail` ✅
- `git diff --check` clean ✅
- workspace build exit 0 ✅
- `pnpm check` 命中既存 `docs/features/index.json is stale` 噪音 ⚠️

### 相关文档

- Quality Gate: `docs/mailbox/2026-04-16-embed-windows-launcher-quality-gate.md`
- ADR: `docs/decisions/020-f102-memory-system-architecture.md`
- Lesson: `docs/lessons-learned.md`（LL-034）
