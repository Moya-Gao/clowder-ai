---
feature_ids: [F115]
doc_kind: review-request
created: 2026-03-14
author: opus
reviewer: codex
---

# Review Request: F115 Phase A — start-dev.sh Profile 化

## What

`scripts/start-dev.sh` に `--profile=dev|opensource` 参数を追加。Profile ごとのデフォルト値マップ + `.env` override 優先 + 起動サマリーのソース標注。

改動ファイル：
- `scripts/start-dev.sh` — profile arg 解析、`apply_profile_defaults`、`resolve_config`、`print_config_summary`
- `scripts/test-start-dev.sh` — 13 テスト（元の 4 + Profile 化の 9）
- `docs/plans/2026-03-14-f115-phase-a-profile-startup.md` — 実装計画

## Why

ADR-016 N3 明确否决分叉 `start-dev.sh` 成两份真相源，采纳 Profile 化方案：一份脚本、不同 profile 决定默认值。启动摘要标注值来源让配置漂移一眼可见。

## Original Requirements（必填）

- 来源：`docs/decisions/016-sync-runtime-negation-decisions.md` N3
- **原始需求摘录**：
  > N3: 不分叉 `start-dev.sh` 成两份真相源
  > 采纳方案：Profile 化 `start-dev.sh --profile=dev|opensource`，一份脚本、不同 profile 决定默认值和 sidecar/proxy 策略。
  > `.env` 只做显式 override，不负责定义环境身份。
  > 启动摘要必须标注值来源：每个配置值标注 `profile default` 还是 `.env override`。
- **请 Reviewer 对照上面的摘录判断：交付物是否解决了铲屎官的问题？**

## Tradeoff

- 使用 `_SRC_*` 独立变量代替 bash 关联数组（`declare -A`），因 macOS 默认 bash 3.2 不支持
- `resolve_config` 用 `eval` 设置变量（避免 subshell 丢失状态），权衡了 bash 兼容性和代码清洁度
- start-dev.sh 已 683 行（含变更前 578 行），超过 350 行硬上限 — 这是预存问题，Phase D 或后续可考虑拆分

## Open Questions

1. `dev` profile 的 TTL 默认 0（永久）vs `opensource` 的 86400（24h）—— 这个值是否合理？
2. 无 `--profile` 时保持原有行为（各项 ENABLED 默认 0），是否应该强制要求指定 profile？

## Next Action

请 review 代码变更，特别关注：
- `resolve_config` 的 env > profile > built-in 优先级逻辑
- `apply_profile_defaults` 的默认值设定
- 启动摘要输出格式

## 自检证据

### Spec 合规

| AC | 状态 | 测试覆盖 |
|----|------|----------|
| AC-A1: `--profile=opensource` defaults | ✅ | Test 6, 12 |
| AC-A2: `--profile=dev` defaults | ✅ | Test 5, 11 |
| AC-A3: 启动摘要标注来源 | ✅ | Test 10 |
| AC-A4: `.env` override 覆盖 profile | ✅ | Test 7, 13 |

### 测试结果

```
bash scripts/test-start-dev.sh  # 13/13 PASS
pnpm lint                       # 0 errors (warnings only, pre-existing)
pnpm -r --if-present run build  # exit 0
```

### 相关文档

- Plan: `docs/plans/2026-03-14-f115-phase-a-profile-startup.md`
- ADR: `docs/decisions/016-sync-runtime-negation-decisions.md`
- Feature: F115 / `docs/features/F115-runtime-startup-optimization.md`
