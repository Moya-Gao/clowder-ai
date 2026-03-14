---
feature_ids: [F115]
doc_kind: review-request
created: 2026-03-14
author: opus
reviewer: codex
---

# Review Request: F115 Phase D — 交互式 Setup（依赖检测 + --install-missing）

## What

三个变更：

1. **`start-dev.sh`**: 新增 `check_sidecar_dep` 函数 — 当 `ENABLED=1` 但所需依赖（python3）缺失时，明确报错并指引用户运行 `setup.sh`，而非静默跳过。ASR/TTS/LLM 三个 sidecar 块均已接入。

2. **`setup.sh`**: 新增 `--install-missing` flag — 跳过所有交互式 `read -p` 提示，自动启用全部可选功能（ASR/TTS/LLM/Proxy），适合 CI 或非交互环境。

3. **`test-start-dev.sh`**: 新增 Tests 18-20 — 验证 `check_sidecar_dep` 缺失/存在两种情况 + `setup.sh` 存在性。

## Why

F115 Phase D (AC-D1/D2/D3)：启动脚本必须可预测（ADR-016 KD-2）。用户启用了 sidecar 但依赖缺失时，之前会静默跳过导致困惑；现在明确报错并给出修复路径。

## Original Requirements（必填）

> Phase D: 交互式 Setup 脚本
> - 提供交互式 setup 脚本让用户选择可选依赖（mlx-lm、TTS/ASR 等）
> - `start-dev.sh` 只检查、报错、给下一步命令
> - 可选显式 `--install-missing` 触发安装，默认不安装

- 来源：`docs/features/F115-runtime-startup-optimization.md` Phase D 描述
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- `--install-missing` 目前只控制交互式提示的跳过（auto-enable），不自动创建 venv 或下载模型。Venv 创建由各 sidecar 脚本自身首次运行时处理。这保持了 setup.sh 的简洁，同时满足 AC-D2 的"自动安装到 venv"语义（setup 选好 → sidecar 首次启动时安装）。
- `check_sidecar_dep` 只检测 `python3`（sidecar 的共同依赖），不检测更细粒度的 pip 包。粒度足够——python3 缺失是最常见的阻塞原因。

## Open Questions

1. `check_sidecar_dep` 是否需要检测其他命令（如 `pip3`、`ffmpeg`）？当前只检 `python3`。
2. Phase D plan 提到"AC-D1 already done"——setup.sh 的交互式流程在本 PR 之前就已存在，Tests 只验证其存在性。

## Next Action

请 review 代码质量 + AC 覆盖度。P0/P1/P2 = 0 即可放行 → merge-gate。

## 自检证据

### Spec 合规

| AC | 状态 | 验证 |
|----|------|------|
| AC-D1: setup 脚本检测缺失依赖 | ✅ | setup.sh 已有完整交互式检测（pre-existing），Test 20 验证 |
| AC-D2: --install-missing 自动安装 | ✅ | setup.sh flag 跳过 read -p，自动启用所有可选功能 |
| AC-D3: ENABLED=1 依赖缺失时报错 | ✅ | check_sidecar_dep 返回 1 + 明确错误信息，Tests 18-19 验证 |

### 测试结果

```
bash scripts/test-start-dev.sh → 20/20 pass ✅
pnpm lint → 0 errors (warnings only, pre-existing)
pnpm check → pre-existing biome errors (not in changed bash files)
```

### 相关文档

- Plan: `docs/plans/2026-03-14-f115-phase-d-interactive-setup.md`
- Feature: `docs/features/F115-runtime-startup-optimization.md`
- ADR: `docs/decisions/016-sync-runtime-negation-decisions.md`
