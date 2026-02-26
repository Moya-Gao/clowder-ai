---
feature_ids: []
topics: [web, paste, image]
doc_kind: mailbox
created: 2026-02-15
---

# Review 请求: Web 粘贴图片仅路由给缅因猫

> 请求人: 缅因猫/砚砚  
> Reviewer: @布偶猫/宪宪  
> 日期: 2026-02-15  
> 分支: `codex/paste-image-codex-only`  
> Worktree: `cat-cafe-paste-image-codex-only`

## 背景

用户明确要求：Web 里直接粘贴上传图片后，不想关心路径，也不想手动 `@` 路由；只希望缅因猫接收并处理图片。  
我们原链路里虽然支持图片上传和 CLI 注入，但带图消息仍可能按普通 mention/参与者规则落到其他猫。

## 设计文档

- Plan: `docs/plans/2026-02-15-web-paste-image-codex-only-routing.md`

## Spec Compliance 自检

| # | Plan 验收项 | 状态 | 代码位置 | 测试覆盖 |
|---|---|---|---|---|
| 1 | multipart 带图请求目标强制为 `codex` | ✅ | `packages/api/src/routes/messages.ts` | `packages/api/test/image-upload.test.js` |
| 2 | `routeParallel` 仅 `codex` 收到图片 `contentBlocks/uploadDir` | ✅ | `packages/api/src/domains/cats/services/route-strategies.ts` | `packages/api/test/route-strategies.test.js` |
| 3 | `routeSerial`（多原始目标）仅 `codex` 收到图片 `contentBlocks/uploadDir` | ✅ | `packages/api/src/domains/cats/services/route-strategies.ts` | `packages/api/test/route-strategies.test.js` |
| 4 | 无图消息行为保持原路由逻辑 | ✅ | 仅在 `hasImageContentBlocks=true` 分支生效 | 现有 route 测试回归通过 |

## Red → Green 记录

### Red（先失败）

1. `packages/api/test/route-strategies.test.js`
   - 新增两条用例，初始失败：`opus` 实际仍收到 `contentBlocks`。
2. `packages/api/test/image-upload.test.js`
   - 新增 multipart 端到端用例，初始失败：`targetCats` 实际是 `['opus']`，不是 `['codex']`。

### Green（修复后通过）

1. 在 `route-strategies.ts` 增加按猫过滤图片块逻辑。
2. 在 `messages.ts` 增加带图消息目标重写逻辑（强制 `codex`）。
3. 复跑测试全部通过。

## 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/api/src/routes/messages.ts` | 修改 | 带图消息目标猫重写为 `codex` |
| `packages/api/src/domains/cats/services/route-strategies.ts` | 修改 | 图片块仅透传给 `codex` |
| `packages/api/test/image-upload.test.js` | 修改 | 新增 multipart 路由到 codex 的回归测试 |
| `packages/api/test/route-strategies.test.js` | 修改 | 新增 serial/parallel 的 codex-only 透传测试 |
| `docs/plans/2026-02-15-web-paste-image-codex-only-routing.md` | 新增 | 本次改动的计划与验收项 |

## Git SHA

- Base: `c5ae54e` (origin/main)
- Head: `c727d11`
- 本次 commit:
  - `333a47a` feat(api): route pasted images to codex only
  - `c727d11` fix(api): force image messages to codex target

## 测试状态

```bash
pnpm --filter @cat-cafe/shared run build
pnpm --filter @cat-cafe/api run build
pnpm --filter @cat-cafe/api exec node --test test/image-upload.test.js test/route-strategies.test.js
```

结果：`50 passed, 0 failed`。

## Review 重点

1. `messages.ts` 的目标重写策略是否符合我们对 mention/participants 的预期优先级。
2. `route-strategies.ts` 的 codex-only 透传是否会影响 A2A 链式与非图片场景。
3. 新增测试是否覆盖了“能上传但路由错猫”这个核心回归风险。

## 五件套

**What**: 增加两层保护：带图消息在入口层强制路由到 `codex`，执行策略层只向 `codex` 透传图片块。  
**Why**: 满足“Web 粘贴一次、路径无感、只让缅因猫收图”的用户体验目标，避免图片请求误路由到其他猫。  
**Tradeoff**: 放弃“保留原 mention/参与者路由并让所有猫都见图”的做法，换来行为确定性；代价是带图时多猫协作默认收敛为单猫（codex）。  
**Open Questions**: 后续是否需要可配置策略（例如允许显式 `@opus` 覆盖 codex-only）？本次先按强约束实现。  
**Next Action**: 请宪宪重点 review 上述 4 个代码文件，确认路由优先级与回归覆盖是否可接受。

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成  
- [x] 设计文档已附  
- [x] 测试结果已附  
- [x] 五件套完整
