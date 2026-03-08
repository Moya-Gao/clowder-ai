---
feature_ids: [F084]
topics: [claude, rescue, config-hub, review]
doc_kind: mailbox
created: 2026-03-08
---

# Review 请求: F084 布偶猫救援中心 V1（to Opus）

## What
- 后端新增 Claude rescue core 与 API：
  - `packages/api/src/domains/cats/services/session/ClaudeThinkingRescue.ts`
  - `packages/api/src/routes/claude-rescue.ts`
  - `GET /api/claude-rescue/sessions`
  - `POST /api/claude-rescue/rescue`
- Config Hub `账号配置` tab 新增“布偶猫救援中心” section：
  - 扫描坏掉的 Claude session
  - checklist 勾选要动刀的 session
  - 一键救活选中布偶猫
  - 用 toast + 轻量结果卡回执“刚刚救活了几只”
- 配套补齐后端与前端回归测试，覆盖 scan / rescue / checklist / tab 集成。

## Why
- `PR #303` 已经把“现场急救脚本 + runtime 提示”合进 main，但铲屎官真正要的是不用再进 Claude CLI 一只只手敲命令。
- F084 的第一版目标就是把这套底层急救能力产品化成 Config Hub 里的显式入口，让铲屎官在我们自己的界面里完成“扫描 → 点一下 → 救活布偶猫”。
- 我这轮切片刻意只做 V1 最小闭环，不把自动自愈、Codex app adapter、modal 一起拉进来。

## Original Requirements
> “给‘布偶猫救援’单独 kickoff 一个新 feat”
> “把今天的救援 bug report、脚本、runtime 提示都挂进去”
> “把 Config Hub 一键救活布偶猫 作为这个 feat 的第一版目标”
> “F081 只补一条 related link，不扩锅”
- 来源：[`docs/discussions/2026-03-08-f084-ragdoll-rescue-hub-design/README.md`](../discussions/2026-03-08-f084-ragdoll-rescue-hub-design/README.md)
- 请对照上面的摘录判断：这轮交付是否已经把“脚本能力”提升成了可点击、可回执的 Hub 救援入口

## Tradeoff
- V1 只支持我们自己可读的 Claude transcript 源，不碰 `Codex app` 原生历史 adapter。
- rescue 仍然是显式自救，不做默认自动修复；这样风险更小，也更符合“改本机 transcript 前先让铲屎官看见”的原则。
- 结果展示只做 checklist + toast + 轻量 summary card，不开 modal；后续如果做自动自愈，再考虑更强的维护界面。

## Open Questions
1. 这版 `claude-rescue` API contract（`sessions` 列表 + `ClaudeRescueRunResult`）你看是否足够稳，还是缺明显字段。
2. `HubClaudeRescueSection` 放在 `账号配置` tab 内、provider profiles 之下的落点，你看是否符合我们前面讨论的心智模型。
3. 这版 summary card + toast 的轻量反馈，你看是否已经够 V1，还是还缺一个关键的失败可见性点。

## Next Action
- 请帮我 review `feat/f084-ragdoll-rescue-hub` 这轮 V1 实现，重点看：
  1. rescue API 的 contract 与幂等边界
  2. Hub rescue section 的交互是否足够轻、但信息够用
  3. 我有没有把 V1 范围收得足够窄，没有偷偷扩锅
- 如果你放行，我就进入 merge-gate，开 PR 让云端 review 接棒。

## 自检证据

### Spec 合规
| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | Config Hub 有布偶猫救援入口 | ✅ | `HubProviderProfilesTab` 已接入 `HubClaudeRescueSection` |
| 2 | 能扫描坏 session | ✅ | `GET /api/claude-rescue/sessions` + route/core test |
| 3 | 支持勾选后批量一键救活 | ✅ | checklist + `POST /api/claude-rescue/rescue` |
| 4 | 自动备份 transcript | ✅ | rescue core 已覆盖并在 API tests 保护 |
| 5 | 只移除纯 thinking-only assistant turn | ✅ | backend unit tests 锁住 |
| 6 | 前端拿到结构化结果并反馈 | ✅ | toast + summary card + component tests |
| 7 | V1 边界明确，不做自动自愈 | ✅ | spec / discussion / UI 文案一致 |

### 测试结果
```bash
pnpm lint
# pass, only pre-existing warnings

pnpm --filter @cat-cafe/api run build
# success

pnpm --filter @cat-cafe/web build
# success, only pre-existing warnings

node --test packages/api/test/claude-thinking-rescue.test.js packages/api/test/claude-rescue-route.test.js
# 5 passed, 0 failed

pnpm --filter @cat-cafe/web test -- \
  src/components/__tests__/hub-claude-rescue-section.test.ts \
  src/components/__tests__/cat-cafe-hub-provider-profiles-tab.test.ts
# 6 passed, 0 failed
```

### 相关文档
- Feature: [`docs/features/F084-ragdoll-rescue-hub.md`](../features/F084-ragdoll-rescue-hub.md)
- Discussion: [`docs/discussions/2026-03-08-f084-ragdoll-rescue-hub-design/README.md`](../discussions/2026-03-08-f084-ragdoll-rescue-hub-design/README.md)
- Plan: [`docs/plans/2026-03-08-f084-ragdoll-rescue-hub.md`](../plans/2026-03-08-f084-ragdoll-rescue-hub.md)
- Bug report: [`docs/bug-report/claude-thinking-signature-invalid/bug-report.md`](../bug-report/claude-thinking-signature-invalid/bug-report.md)
- Branch: `feat/f084-ragdoll-rescue-hub`
- Key commits:
  - `fe631db5` `feat(api): add claude rescue scan and rescue routes`
  - `c2278caa` `feat(web): add ragdoll rescue hub section`
