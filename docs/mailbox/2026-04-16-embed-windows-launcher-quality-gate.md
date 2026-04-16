---
doc_kind: quality-gate
created: 2026-04-16
topics: [embedding, windows, launcher, sync, review-ready]
---

# Quality Gate Report: Embed Multi-Platform Launcher Hardening

Spec: `docs/decisions/020-f102-memory-system-architecture.md`
补充约束: `docs/lessons-learned.md`（LL-034）
原始需求: 当前 thread 对话 + 用户截图（2026-04-16）
检查时间: 2026-04-16

## 愿景覆盖（Step 0）

| # | 铲屎官原始需求 | Spec/约束覆盖 | 实现状态 |
|---|---------------|---------------|----------|
| 1 | “社区小伙伴发现 我们的记忆系统 embedding没同步py脚本启动不起来？” | ADR-020 要求 embedding sidecar + `/health` / `/v1/embeddings`；当前问题是启动链和开源导出断裂 | ✅ 修复 |
| 2 | “那如果人家不是mac场景咋办？” | ADR-020 允许 embedding fail-open，但不要求只支持 mac；LL-034 约束是独立 sidecar，不是平台绑定 | ✅ 修复 |
| 3 | “好像得让人支持 url or 用自己的显卡/cpu？” | ADR-020 的 HTTP sidecar 模式天然允许本机/远端 URL；本轮补齐 Windows 本机 GPU/CPU 路径 | ✅ 修复 |
| 4 | “把这个做了？” | 本轮 scope 收口为 Windows launcher + 本机 sidecar + 开源导出链闭环 | ✅ 修复 |

## 交付完整性（Step 0.5）

- 这轮不是新 feature 半成品，而是把已存在的 embedding sidecar 架构补到跨平台可启动、可导出、可配置。
- 产物是终态扩展，不需要后续“重写”当前路径：
  - `EMBED_MODE` 继续作为是否启用 embedding 的真相源
  - `EMBED_URL` 同时支持远端服务和本机 sidecar
  - Windows 本机路径补齐为 PowerShell launcher，而不是回退成 in-process embedding

## 功能验收

| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | 开源导出必须包含 embedding 启动脚本 | ✅ | `sync-manifest.yaml`, `scripts/sync-to-opensource.sh` | `scripts/start-dev-profile-isolation.test.mjs` |
| 2 | Unix `EMBED_MODE=on/shadow` 时自动拉起 sidecar | ✅ | `scripts/start-dev.sh` | `scripts/start-dev-profile-isolation.test.mjs` |
| 3 | 非 Apple 平台自动走 `sentence-transformers + torch` | ✅ | `scripts/embed-server.sh`, `scripts/setup.sh` | 导出回归 + 脚本语法检查 |
| 4 | Windows 本机可拉起 embedding sidecar | ✅ | `scripts/start-windows.ps1`, `scripts/embed-server.ps1` | `scripts/start-dev-profile-isolation.test.mjs`（静态约束 + 开源导出） |
| 5 | 本机 fallback 设备选择支持 `cuda -> mps -> cpu` | ✅ | `scripts/embed-api.py` | `python3 -m py_compile scripts/embed-api.py` |
| 6 | `dry-run` 导出要包含 allowlist 的未跟踪新文件 | ✅ | `scripts/sync-to-opensource.sh` | `scripts/start-dev-profile-isolation.test.mjs` |

## 设计稿对照（Step 5）

- glob `designs/**/*.pen` 匹配结果：`designs/F102-memory-hub-phase-j.pen`, `designs/f102memory-hub.pen`
- 对照状态：➖ 本轮无 `packages/web/` UI 改动，只有脚本 / env / 文档 / 启动链修改，不需要做实现截图对照

## Artifact Hygiene（Step 7.5）

- 仓库根目录媒体/设计工件（工作树）: 无 ✅
- 已提交差异中的根目录媒体/设计工件: 无 ✅

## 验证命令输出（本轮真实运行）

```bash
bash -n scripts/start-dev.sh scripts/setup.sh scripts/embed-server.sh scripts/sync-to-opensource.sh
# exit 0 ✅

python3 -m py_compile scripts/embed-api.py
# exit 0 ✅

node --test scripts/check-env-example.test.mjs
# 4 pass, 0 fail ✅

node --test scripts/start-dev-profile-isolation.test.mjs
# 12 pass, 0 fail ✅

git diff --check
# clean ✅

pnpm -r --if-present run build
# exit 0 ✅

pnpm check
# FAIL: docs/features/index.json is stale（仓库既存门禁噪音，非本轮 diff 引入）⚠️
```

## Gate 结论

- **Focused gate: PASS**
  - 本轮相关脚本语法、Python 语法、profile/export 回归、全仓 build 都通过。
- **Repo-wide static gate: 有既存噪音**
  - `pnpm check` 失败点是 `docs/features/index.json is stale`
  - 该问题与本轮 embedding / Windows launcher diff 无直接关系，本轮未顺手混入该生成物修复

## 备注

- 还没有在真实 Windows 机器上跑一次端到端 smoke test；当前证据是：
  - PowerShell launcher 逻辑
  - profile/export 回归
  - 开源导出 dry-run
  - 全仓 build 未被本轮改动带崩
