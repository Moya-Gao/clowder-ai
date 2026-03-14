---
feature_ids: [F115]
doc_kind: plan
created: 2026-03-14
---

# F115 Phase D: 交互式 Setup Implementation Plan

**Feature:** F115 — `docs/features/F115-runtime-startup-optimization.md`
**Goal:** setup.sh 检测缺失依赖并提示安装，`--install-missing` 自动安装，start-dev.sh ENABLED=1 但依赖缺失时明确报错。
**Acceptance Criteria:**
- AC-D1: setup 脚本检测缺失依赖并提示安装命令
- AC-D2: `--install-missing` 可自动安装到 venv
- AC-D3: `start-dev.sh` 检测到 ENABLED=1 但依赖缺失时报错而非静默跳过
**Architecture:** AC-D1 already done (setup.sh exists). AC-D2: add `--install-missing` flag to setup.sh that creates venvs + installs deps non-interactively. AC-D3: add `check_sidecar_deps` function to start-dev.sh that validates deps before launch.
**Tech Stack:** Bash
**前端验证:** No

---

## NOT Building

- 不改 setup.sh 的交互式流程（已完成）
- 不改 sidecar 脚本自身的 venv 创建逻辑
- 不支持 Docker 环境自动检测（OQ-2 未定）

---

## Task 1: AC-D3 — start-dev.sh 检测 ENABLED=1 但依赖缺失时报错

In start-dev.sh, the current Phase B code sets `_STATE_*=failed` when script not found,
but doesn't check if python3 is available when ENABLED=1 and script exists.

Add `check_sidecar_dep` function that validates python3 exists before launching.

## Task 2: AC-D2 — setup.sh --install-missing

Add `--install-missing` flag that skips interactive prompts and creates venvs for
ASR/TTS/LLM automatically.

## Task 3: AC-D1 validation — ensure setup.sh detects deps correctly

AC-D1 is already implemented. Add tests to validate.
