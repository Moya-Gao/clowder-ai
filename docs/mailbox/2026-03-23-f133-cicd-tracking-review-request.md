---
feature_ids: [F133]
topics: [review-request, github, ci-cd]
doc_kind: mailbox
created: 2026-03-23
---

# Review Request: F133 CI/CD Tracking — Phase A Core Pipeline

## What

新增 CI/CD 自动追踪管道，复用现有 Review 消息投递架构，为已注册 PR 提供 CI 状态通知。

核心变更（10 文件，+1112 行）：
- **CiCdCheckPoller** (238行): `gh pr view --json statusCheckRollup` 轮询 + aggregate bucket 计算
- **CiCdRouter** (141行): 独立路由器 + 状态迁移去重 (`headSha:aggregateBucket`)
- **deliver-connector-message** (50行): 从 ReviewRouter 模式抽取的共享投递 helper
- **github-ci-bootstrap** (45行): 独立启动/停止生命周期
- **PrTrackingStore** (+31行): `patchCiState()` 接口 + CI 字段扩展
- **RedisPrTrackingStore** (+24行): Redis HSET 实现 + hydrate 扩展
- **33 个测试**: CiCdRouter 全 AC + CiCdCheckPoller 纯函数测试

## Why

铲屎官原话："你看看我们现在 GitHub 的 Tracking，它能 Tracking CI/CD 的执行结果吗？"

CI/CD 结果是发版前提条件，但当前 PR Tracking 只追踪 Review 通知，CI 是盲区。

## Original Requirements（必填）

> "你看看我们现在 GitHub 的 Tracking，它能 Tracking CI/CD 的执行结果吗？"
> "这个 ci cd tracking 应该也和现在的 github 一样消息投递到我们的 channel 或者叫消息管道"
> "我们的 ci cd 基本只有月初有额度...clowder-ai 都得看 ci cd 过，发版本更是"
- 来源：thread `ci/cd github tracking` (2026-03-23)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选 PR 级 rollup (`statusCheckRollup`) 而非 raw Checks API — 一次请求覆盖 Checks + commit statuses 两套体系，避免漏掉旧式 CI 提供方
- 选状态迁移去重 (`headSha:aggregateBucket`) 而非 ProcessedEmailStore 5min 窗口 — 避免吞掉合法的 `pending → fail → success` 状态迁移
- 选独立 CiCdRouter 而非塞 ReviewRouter — 防止两个数据源耦合

## Open Questions

1. `deliver-connector-message.ts` 目前只被 CiCdRouter 调用，ReviewRouter 仍内联投递逻辑。是否需要本轮让 ReviewRouter 也切到共享 helper？（我倾向留到 Phase C 一起做）
2. CiCdCheckPoller 的 60s 间隔是否需要可配置？v1 硬编码，后续可提环境变量

## Next Action

请审查代码质量 + 测试覆盖 + spec 对齐度。重点关注：
- 去重逻辑的正确性（CiCdRouter.route）
- patchCiState 与 register 的隔离性
- CiCdCheckPoller 的 gh CLI 错误处理路径

## 自检证据

### Spec 合规

- 愿景覆盖: ✅ 铲屎官原始需求对照完成
- AC-A1~A11: ✅ 全部有测试覆盖
- T1-T4 必测矩阵: ✅ 全部覆盖
- 设计稿: ➖ 无 UI 改动，无 .pen 文件
- Artifact Hygiene: ✅ 无根目录媒体垃圾

### 测试结果

```
pnpm --filter @cat-cafe/api test  → 5481 tests, 5318 pass, 2 fail (pre-existing)
F133 tests (33/33)                → ALL GREEN
pnpm --filter @cat-cafe/api build → exit 0
pnpm check                        → 4 errors (all pre-existing, none in F133 files)
```

### 相关文档

- Feature: `docs/features/F133-cicd-tracking.md` (design-gate-passed)
- Issue: #669
- PR: #675
- Design Gate: 砚砚(GPT-5.4) + 金渐层, thread `ci/cd github tracking`

Review-Target-ID: f133
Branch: feat/f133-cicd-tracking
