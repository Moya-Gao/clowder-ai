# Review Request: F141 Phase B — Reconciliation Scan (RepoScanTaskSpec)

Review-Target-ID: f141-phase-b
Branch: feat/f141-phase-b

## What

F141 Phase B: 补偿扫描——webhook 漏掉的 open PR/Issue 通过定时 `gh api` 查询补发到 inbox thread。

核心变更：
1. **ReconciliationDedup** (34 lines) — 独立于 transport dedup 的 business-level dedup (KD-15)
2. **RepoScanTaskSpec** (188 lines) — F139 TaskSpec_P1 consumer: gate 查 gh api + dedup filter, execute 复用 Phase A 投递管线
3. **Phase A bridge** (+12 lines) — webhook 成功投递后 markNotified, 让 Phase B gate 跳过已知事件
4. **Registration** (+60 lines in index.ts) — 跟 CiCdCheckTaskSpec 等同级注册

## Why

F141 Phase A (webhook) 是主发现通道，但 GitHub webhook 不保证 exactly-once——网络抖动、配置窗口期、重新部署等场景都可能丢事件。Phase B 是补偿机制：低频 (5min) 扫描 open 对象，补发 webhook 漏掉的。

KD-1 决策原文："Webhook 做主发现入口，定时扫描只做补偿"。

## Original Requirements（必填）
> "你看之前的猫猫是如何知道什么时候要挂PR，什么时候要挂CICD的...有的应该是你们主动注册关注哪个 PR 或者 issue 但是有的又是怎么样的？被通知吗？还是都是要主动注册？"
> — 铲屎官，2026-03-26 thread `F140 讨论`
- 来源：`docs/features/F141-github-repo-inbox.md` lines 27-28
- **请对照上面的摘录判断：Phase B 补偿扫描是否填补了 webhook 丢事件的缺口**

## Tradeoff

- **不建 Phase B 自己的 inbox thread**：Phase B execute 只投递到 Phase A webhook 已创建的 inbox thread。如果某 repo 从未收过 webhook（Phase A 从未触发），Phase B 不会为它创建 thread（skip + warn log）。理由：Phase B 是"补偿"，不是"替代"。
- **business dedup 用 Redis TTL 7d 而非永久**：长期不活跃的 PR/Issue 可能在 TTL 过期后被再次通知。可接受——7d 内 webhook 或首次扫描必然覆盖。
- **gate 串行扫描 repos**：小 allowlist（2-3 个 repo）下串行 gh api 足够。大规模需 parallel，但 YAGNI。

## Open Questions

1. **Phase A markNotified 的 failure mode**：markNotified 是 best-effort（catch 吞错误）。如果 Phase A 成功投递但 markNotified 失败，Phase B 下次扫描会重复投递。概率极低（Redis 可用时 deliver 才能成功），但请评估是否需要更强保证。
2. **gh api jq filter 在 gate 中的健壮性**：当前 `--jq '.[] | select(.pull_request == null)'` 过滤 issues 中的 PR。如果 GitHub API 返回非预期格式，整个 repo 会 fail-open（skip）。请评估。

## Next Action

请 cross-family review（缅因猫）。重点关注：
- KD-15 双层 dedup 的正确性
- Phase A → Phase B bridge 的 failure mode
- RepoScanTaskSpec 与其他 F139 consumers 的模式一致性

## 自检证据

### Spec 合规
| AC | Status |
|---|---|
| AC-B1: TaskSpec_P1 consumer | ✅ profile=poller, actor=repo-watcher |
| AC-B2: gate queries + dedup filter | ✅ 6 gate tests |
| AC-B3: shared deliverConnectorMessage | ✅ 4 execute tests |
| AC-B4: run ledger | ✅ framework guarantee |

### 测试结果
```
node --test (F141 suite)  → 45/45 pass, 0 fail ✅
pnpm lint                 → 0 errors ✅
pnpm check                → 0 errors ✅
pnpm -r build             → exit 0 ✅
```

### 相关文档
- Feature: `docs/features/F141-github-repo-inbox.md`
- Plan: `docs/plans/2026-03-26-f141-phase-b-reconciliation.md`
- KD-10, KD-15: Phase B consumer pattern + 双层 dedup 决策

[宪宪/Opus-46🐾]
