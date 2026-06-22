---
feature_ids: [F244]
topics: [capability-tips, eval, stale-sunset, dogfood, phase-d]
doc_kind: review-request
---

# Review Request: F244 Phase D PR-D2 — eval domain + dogfood report + stale/sunset check

Review-Target-ID: f244
Branch: feat/f244-phase-d2

## What

Phase D 的第二个 PR（PR-D1 已合入 #2502）。三个交付物：

1. **F192 eval domain 注册**（AC-D2）：`eval:capability-tips` YAML 域配置，`enabled: false`（source adapter 待 telemetry pipeline 建好后启用）。eval-domain-registry 测试验证 schema 合规。
2. **CVO dogfood 报告**（AC-D3）：5 轮 CVO 手动 dogfood 汇总（2026-06-18→2026-06-21），记录正面信号 / 噪音信号 / 尚未观测信号。
3. **Stale/sunset 检测脚本**（AC-D4）：`scripts/check-capability-tips-stale.mjs`，扫描 53 条 tips 的 sourceRef path + anchor 有效性 + feature sunset 状态。13 个测试覆盖 path_missing / anchor_missing / feature_sunset / 分组 / 汇总。

## Why

CVO directive："eval verdict 待 usage 数据自然产出，不卡 close"。Phase D 需要 eval 接入骨架 + dogfood 总结 + stale 治理机制，让 tips system 有闭环能力。PR-D1 解决了体验和数据基础（曝光均匀性 + localStorage events），PR-D2 解决治理和评估。

## Original Requirements（必填）

> "记录 tips 曝光、点击、被用户追问的频率，反推哪些能力还没被讲清楚"
> "支持 stale/sunset：sourceRef 失效、feature done/sunset、连续低价值或被用户 dismiss 的 tip 进入 review"
> "dogfood 报告：第一个用户为铲屎官，Phase B 后用 alpha 录屏 + 使用反馈判断是否继续上 C/D hard layer"

- 来源：`docs/features/F244-capability-tips-system.md` Phase D spec（L151-158）+ CVO Constraints（L42-51）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- eval domain `enabled: false`：source adapter 未实现（需要 web→API telemetry rollup pipeline），但域配置和 schema 已就位。启用只需写 adapter，不需改配置。替代方案是等 pipeline 好了再注册——但那样 Phase D 无法 close。
- 独立 eval domain vs 扩展 `eval:capability-wakeup`：选独立（OQ-3 决议），因为信号源不同（tips usage vs session trace）、cadence 不同（多周窗口 vs 周频）、handoff target 不同（F244 vs F203）。共享 evalCat（opus-47）。
- stale 检测用独立脚本 vs CI 集成：选独立脚本 + `pnpm check:capability-tips:stale`。CI 集成待下次大规模 skill/feature sunset 时接入。

## Architecture Ownership（必填）

Architecture cell: harness-eval
Map delta: none
Why: 只新增一个 YAML eval domain 配置文件 + 一个独立 check 脚本 + dogfood 报告文档。不改现有 Store/Router/Adapter 边界，不新增架构组件。

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. `check-capability-tips-stale.mjs` 的 6 层 fallback（input validation guards）——每层都是 JSON boundary 防御（`?? '(unknown)'`、`|| typeof !== 'string'` 等），非坐标系补丁。请确认是否合理。
2. eval domain `frequency: weekly` + `sla.reevalWithinHours: 336`（14 天）——tips 效果需要多周观察窗口，比 capability-wakeup 的 verdict 节奏慢。请确认 SLA 设置是否合理。

### 价值 OQ（给 CVO，如有）

无。eval domain 启用时机 + stale check 接入 CI 时机均已有 spec 判断标准（下次大规模 sunset 时），不需 CVO 价值取舍。

## Next Action

请做跨家族 code review，重点关注：
- eval domain YAML schema 是否符合 `evalDomainRegistryEntrySchema` 要求
- stale 检测脚本的 finding 分类 + 测试覆盖完整性
- dogfood 报告是否客观反映了 5 轮 CVO feedback

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f244/gpt52`
- Start Command: `pnpm review:start`
- Ports: 无需启动服务（docs + scripts，无 UI 改动；测试用 `node --test` 跑）

## 自检证据

### Spec 合规

Quality Gate PASS — 愿景覆盖 3/3 AC（D2/D3/D4），delivery completeness 确认（PR-D2 = Phase D 第二个 PR，CVO 明确同意分批）。Architecture cell: harness-eval, Map delta: none。Dogfood 可豁免（内部 eval 基础设施 + docs，非 user/cat 可感知路径）。

### 测试结果

- `pnpm test` → exit 0 ✅
- `pnpm lint` → 0 errors ✅
- `pnpm check` → 0 errors ✅
- `pnpm -r --if-present run build` → exit 0 ✅
- `node --test scripts/check-capability-tips-stale.test.mjs` → 13/13 pass ✅
- `node --test packages/api/test/harness-eval/eval-domain-registry.test.js` → 31/31 pass ✅
- Hotfix pattern: `{"hotfix":false}` ✅
- Fallback layers: 6 in stale script — all input validation guards at JSON boundary ✅
- Root artifact guard: clean ✅

### 相关文档

- Feature: `docs/features/F244-capability-tips-system.md`
- Dogfood report: `docs/features/F244-capability-tips-dogfood-report.md`
- Eval domain: `docs/harness-feedback/eval-domains/eval-capability-tips.yaml`

[宪宪/claude-opus-4-6🐾]
