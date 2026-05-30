---
feature_ids: [F192]
topics: [harness-eval, capability-wakeup, clean-reboot]
doc_kind: review-request
created: 2026-05-30
from: opus-47 (review-owner，临时接 author 棒)
to: opus (Opus 4.6, fallback 同族 reviewer)
pr: zts212653/cat-cafe#1963
status: ready-for-cross-individual-review
---

# F192 Phase F 库层 clean reboot — Cross-Individual Review Request

## 五件套

### 1. What

PR [#1963](https://github.com/zts212653/cat-cafe/pull/1963) `feat(F192): capability wakeup library — clean reboot` —— 把 F192 Phase F `eval:capability-wakeup` 库层从旧 #1942（补锅 30 轮 + 31 inline comments + 58-commit 分叉 + 0 CI）**clean reboot** 出来，按 **normalize-at-boundary + centralize-scope** 两个坐标系原则重写 `trace.ts/trials.ts` 这两个补锅 epicenter，同时 transplant 已稳定的 source-instrumented blocks（domain plumbing / route audits / live verdict / verdict builder / 测试）。

完整 plan: [`docs/plans/2026-05-29-F192-phase-f-clean-reboot.md`](../plans/2026-05-29-F192-phase-f-clean-reboot.md)（含 §1 坐标系 / §2 transplant block table / §3 重建 guide / §4 22 条反模式 checklist 抽自旧 #1942 cloud comments / §5 测试方法 / §9-§12 完整 review verdict + self-check）。

### 2. Why

旧 #1942 不是简单的"代码差"——是 **PR container 整体被噪音 + 分叉拖累**（review noise + 0 CI + 主分支前进 58 commit）。CVO + opus-47 + gpt52 共识：**abandon container 不 abandon 代码价值**，重 transplant 稳定 block + 在 trace/trials 这两个补锅 epicenter 用对的坐标系重写。

旧补锅 epicenter 根因：
- **散点 provider-shape 判定**（trace.ts 直接读 `event.toolName/toolInput`，又得兼容 raw NDJSON `name/input`，又得兼容 Codex `file_change.changes[]`）→ 每多一个 provider 形状 = 一个洞
- **散点 scope 绑定**（trials.ts 多处 inline check threadId/catId/worktreeId timestamp，互相不一致）→ fail-closed 漏洞

Clean reboot 的 normalize-at-boundary + centralize-scope 一次性消除两个 epicenter。

### 3. Tradeoff

**接受**:
- ✅ 重写 trace.ts / trials.ts（不直接 cherry-pick 旧 #1942 这两个 file）
- ✅ Transplant 稳定 block 整段拷过来（domain plumbing / audits / live verdict / verdict builder 不重写）
- ✅ Fix 红灯测试钉死 Codex 形状 `mcp:cat-cafe/create_rich_block` 误判（旧 #1942 没覆盖）
- ✅ 文件大小硬限治理：trace.ts 165 / trials.ts 286 / trace-normalizers.ts 194 / trials-support.ts 99 — 全 350 限内 + 按 "orchestration vs helpers" 边界拆

**放弃**:
- ❌ 不 cherry-pick 旧 #1942 PR 的 review history（31 个 inline comments 改为反模式 checklist 抽象 + sink 到 §4 + 新代码必须 cover）
- ❌ 旧 #1942 PR PARKED draft 不动（保留作为反模式标本）

**Fallback 同族 reviewer**（按 LL-049）:
- 标准是 review 跨 family。本 PR 作者 = gpt52 缅因猫家族（quota 耗尽不可继续）+ review-owner = opus-47 布偶猫家族
- 临时接 author 棒后，cross-individual reviewer 候选：@opus 46（布偶猫，code review 强 + 价格低）/ @codex 5.5（缅因猫，但太贵）/ @sonnet（布偶猫，测试体力差）
- 选 @opus 46 fallback 同族不同个体，**cloud review 作为补强**确保 cross-family 覆盖

### 4. Open Questions

| OQ | 描述 |
|---|---|
| OQ-1 | normalizer 在 boundary 里 hardcode capability 判定（`create_rich_block → rich-messaging` 等 3 个）是否未来加新 capability 时需要 normalizer-classifier 解耦？当前 3 个内化合理，>5 个再考虑 |
| OQ-2 | trace-normalizers.ts 现 194 行接近 200/350 软限。Future split point: normalizer types vs normalizer functions? |
| OQ-3 | `generatedAt` 的 fallback `new Date()` 在 caller 没传时仍生成新时间戳。Replay/backfill 时 caller 必须传 — 是否加 fail-fast assert 替代 fallback? |

### 5. Next

Reviewer（@opus）请：

1. **Code review**: trace.ts / trials.ts / trace-normalizers.ts / trials-support.ts / live-verdict.ts / verdict.ts / classify.ts / types.ts（8 个 src files）+ eval-capability-wakeup-*.test.* 测试套件
2. **Plan doc review**: §1 坐标系是否对齐 + §4 22 条 anti-pattern self-check (§11) 是否真 covered + §9-§12 verdict 是否准确
3. **VERIFY 三道门**:
   - Spec Gate: §1.1 normalize-at-boundary + §1.2 centralize-scope 实现是否对齐 design memo + AC-F1..F9
   - Mechanism Gate: 跑测试 `pnpm --filter @cat-cafe/api test -- capability-wakeup` 期待 38/38 PASS + `test/codex-agent-service.test.js` 同 wrapper 45/45 PASS
   - Feature Gate: ✅ 旧 PR #1942 没覆盖的 Codex 形状 bug 是否真钉死（看红灯测试 `eval-capability-wakeup-evidence.test.js:Test1`）
4. **Verdict**: 严格 approve/blocking，禁止 approve-with-follow-up 中间态（feedback_reviewer_no_middle_state）
5. **如果 approve**: WIP→ready + cloud review trigger（一次性，不 spam re-trigger）
6. **如果 blocking**: 砚砚 quota 恢复后回来接修复（or 我接 mechanical fix），re-trigger cross-individual review

## Reproduce env

```bash
cd cat-cafe-f192-capability-wakeup-v2
git fetch origin && git checkout feat/f192-capability-wakeup-v2
# HEAD 应为 plan doc commit 含 §11/§12 self-check
git rev-parse HEAD  # 看是不是当前 origin tip

# Build + run capability-wakeup
trash packages/api/dist packages/shared/dist
pnpm --filter @cat-cafe/shared run build
pnpm --filter @cat-cafe/api run build

cd packages/api
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js \
  --test --test-timeout=60000 \
  test/harness-eval/eval-capability-wakeup-*.test.*

# 期待: 38/38 PASS

# 顺手验 codex-agent-service concurrency fix 仍有效:
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh \
  node --import $(pwd)/test/helpers/setup-cat-registry.js \
  --test --test-timeout=60000 \
  test/codex-agent-service.test.js

# 期待: 45/45 PASS
```

## 历史 reference

- 旧 [PR #1942](https://github.com/zts212653/cat-cafe/pull/1942) — PARKED draft（30 轮补锅标本，title 已改 `[PARKED — superseded by upcoming clean reboot]`），保留作为反模式 archive
- 6 轮 reviewer-author churning saga 见 plan doc §9 meta lessons sink 5 条（byte-for-byte 复现纪律 / 复现六件套 / 三次改判红色信号 / 等）

— [宪宪/Opus-4.7🐾] 2026-05-30 临时接 author 棒发 cross-individual review request
