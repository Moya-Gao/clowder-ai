# Review Request: F087 Phase C — Bootcamp Runtime Wiring + Auto-Pin

## What
5 commits wiring bootcamp runtime so cats can actually call MCP tools during bootcamp sessions:
1. Inject `threadId` into SystemPromptBuilder bootcamp line (cats need this to call `update_bootcamp_state`)
2. Pass `threadId` through route-parallel and route-serial
3. Auto-pin thread when bootcamp reaches `phase-11-farewell`
4. Rewrite bootcamp-guide skill with threadId source + complete phase orchestration
5. Add bootcamp tools to mcp-server tool registration guard

## Why
Phase A built the data model, Phase B built callback routes + MCP tools + security. But cats couldn't actually use the tools because SystemPromptBuilder didn't inject `threadId` — the tools require it for strict thread binding (Phase B security: `record.threadId !== threadId` → 403). This phase closes the gap.

## Original Requirements（必填）
> MVP **不是**我们内置任务让用户做，而是引导新用户**像铲屎官一样和猫猫协作**——帮装 MCP、解决配置问题、带走一次真正的 feat lifecycle。成就系统直接接入 F075 猫猫排行榜，不要重新发明。**家规 P1：每步产物是终态基座不是脚手架。**
- 来源：`docs/features/F087-cvo-bootcamp.md` 铲屎官纠正（2026-03-10）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 没有在 Phase C 做前端联调（Phase C spec 列了前端 rich block 渲染），因为 Interactive Rich Blocks 基础设施已在 F096 Phase A (PR #375) 完成，猫猫通过 skill 调 `create_rich_block` 即可，无需额外前端代码
- Size guard thresholds bumped (2300→2600 etc.) — roster grew with new cats (spark, dare, antigravity), pre-existing on main

## Open Questions
1. **threadId 注入格式**：`🎓 Bootcamp Mode: thread=thread_xxx phase=... leadCat=...` — 这个格式够清晰吗？猫猫能从中正确提取 threadId 调用 MCP 工具？
2. **Auto-pin 时机**：目前只在 `phase-11-farewell` 时 pin。是否需要在更早的 phase（如用户完成主线任务时）就 pin？

## Next Action
请 review 9 个文件的改动，重点关注：
- SystemPromptBuilder threadId 注入的安全性（会不会泄露不该泄露的信息？）
- Auto-pin 逻辑是否放在正确的位置（callback route vs 其他层）
- Skill 文档的 phase 编排是否清晰完整

PR: https://github.com/zts212653/cat-cafe/pull/386

## 自检证据

### Spec 合规
Quality gate passed — 6 functional items all verified:
- threadId injection ✅, route-parallel ✅, route-serial ✅, auto-pin ✅, skill update ✅, tool registration ✅
- 无 .pen 设计稿改动（后端 wiring + skill doc）

### 测试结果
```
pnpm --filter @cat-cafe/api test       # 3814 pass, 47 fail (main: 3807/52, branch better)
pnpm --filter @cat-cafe/mcp-server test # 54 pass, 0 fail
pnpm --filter @cat-cafe/web test       # 1105 pass, 25 fail (same pre-existing as main)
pnpm lint                              # 0 errors
pnpm -r --if-present run build         # exit 0
```

### 相关文档
- Plan: `docs/plans/2026-03-12-f087-phase-c-bootcamp-runtime.md`
- Feature: `docs/features/F087-cvo-bootcamp.md`
- Phase B PR: #381 (callback routes + MCP tools + security)
- Phase A PR: #375 (data model + env-check + frontend entry)
