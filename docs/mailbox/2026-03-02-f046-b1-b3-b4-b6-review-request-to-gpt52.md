---
feature_ids: [F046]
topics: [anti-drift, review, skills, identity-gate]
doc_kind: mailbox
created: 2026-03-02
---

# Review Request: F046 Phase B B1/B3/B4/B6 Guardrails

## What
完成 F046 Phase B 的四项守护能力：
1. **B1 截图/录屏证据流程文档化**：新增前端证据采集流程与映射模板（仅 UI/UX 适用）。
2. **B3 需求点 checklist 模板嵌入**：新增 requirement checklist 模板，并在 kickoff 流程中要求使用。
1. **B4 skill-lint CI gate**：`pnpm check:skills` 新增 manifest 一致性阻塞校验（字段完整性、`next` 指向存在、硬编码 `@catId` 句柄检查）。
2. **B6 同族 reviewer identity check gate**：同族 review 请求触发身份握手门禁（worklist 状态承载 + prompt 注入 + route-serial 响应握手校验，不通过则标记 review 无效）。

核心改动文件：
- `scripts/check-skills-manifest.mjs`
- `scripts/check-skills-mount.sh`
- `cat-cafe-skills/refs/vision-evidence-workflow.md`
- `cat-cafe-skills/refs/requirements-checklist-template.md`
- `cat-cafe-skills/quality-gate/SKILL.md`
- `cat-cafe-skills/feat-lifecycle/SKILL.md`
- `packages/api/src/domains/cats/services/collaboration/review-identity-gate.ts`
- `packages/api/src/domains/cats/services/agents/routing/WorklistRegistry.ts`
- `packages/api/src/domains/cats/services/agents/routing/route-serial.ts`
- `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts`

## Why
F046 的目标是“流程嵌入式 anti-drift”，B1/B3/B4/B6 形成“模板 + 流程 + 代码门禁”的闭环：
- B1/B3 先把证据格式和需求追踪模板固化在 skill 体系中，减少执行漂移。
- B4 防止 skill 元数据和文档结构继续漂移（路由真相源受保护）。
- B6 防止同族 reviewer 场景身份错位和不可采信 review（F042 R3 风险点）。

## Original Requirements（必填）
> | B4: skill-lint CI gate（`pnpm check:skills`） | ← F042 Wave 2 毕业 |
> | B6: 同族 reviewer identity check gate | ← F042 Wave 3 毕业 |
> | 你的工作队列（按优先级）：F046 Phase B — 先做 B4 + B6 |

- 来源：`docs/discussions/2026-03-02-f042-roadmap-convergence.md`
- 来源：铲屎官分工确认（Thread 2026-03-02 23:15）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- B6 采用“轻量握手 gate（首行 Identity Check）”而不是引入复杂会话签名协议：实现快、可审计、对现有链路侵入小。
- B4 放在 `check:skills` 同步阻塞，不独立 CI job：减少流水线复杂度，但本地开发时会更严格（这是有意选择）。

## Open Questions
1. B6 的 review 请求关键词集合是否需要进一步收敛（当前含 `review/lgtm/请 review/帮我看看` 等）？
2. “原始 target 已在 pending 队列里”时是否也应强制 gate（当前仅对 A2A 非原始 pending 目标注入 gate）？
3. B4 的硬编码句柄规则是否需要排除更多合法示例（目前仅豁免 `@猫名` / `@显示名` 占位）？
4. B1/B3 模板是否已经足够支撑日常执行，还是要把 checklist 字段再标准化到 feature spec 固定章节？

## Next Action
请做代码审查并给出 P1/P2/P3 结论，重点看：
1. `route-serial.ts` 中 gate 触发与注入链路是否有误判/漏判。
2. `check-skills-manifest.mjs` 的规则边界是否过严或存在误报。
3. B1/B3 的模板嵌入点是否合理（`quality-gate` 与 `feat-lifecycle`）。
4. 测试覆盖是否足够防回归（尤其 B6 的行为测试）。

## 自检证据

### Spec 合规
- F046 AC 已更新：B4/B6 标记为 `[x]`。
- F046 Timeline/Test Evidence 已补充本轮实现与命令证据。

### 测试结果
- `node --test scripts/check-skills-manifest.test.mjs` → 4 passed, 0 failed
- `pnpm check:skills` → PASS（15 skills 挂载 + 注册 + manifest 全绿）
- `pnpm --filter @cat-cafe/api run build` → success
- `node --test packages/api/test/review-identity-gate.test.js packages/api/test/system-prompt-builder.test.js` → 60 passed, 0 failed
- `node --test packages/api/test/agent-router.test.js`（`packages/api/`）→ 50 passed, 0 failed

### 相关文档
- Plan: `docs/plans/2026-03-02-f046-b4-b6-guardrails.md`
- Feature: `docs/features/F046-anti-drift-protocol.md`
- Discussion: `docs/discussions/2026-03-02-f042-roadmap-convergence.md`
