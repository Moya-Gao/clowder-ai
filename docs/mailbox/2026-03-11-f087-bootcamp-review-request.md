# Review Request: F087 CVO Bootcamp — Phase A Infrastructure

## What

F087 猫猫训练营的基础设施层：Thread bootcampState schema、前端入口、环境检测 API、bootcamp-guide Skill、Interactive Rich Block 定义。6 commits on `feat/f087-bootcamp`。

核心变更：
1. **Thread bootcampState** — 13-phase 状态机，ThreadStore/RedisThreadStore/routes/chat-types 全链路
2. **前端入口** — BootcampIcon SVG + Sidebar 按钮 + 空消息态 CTA
3. **环境检测 API** — `GET /api/bootcamp/env-check` 检测 node/pnpm/git/claude/mcp + TTS/ASR/Pencil
4. **bootcamp-guide Skill** — SKILL.md + manifest.yaml + SystemPromptBuilder 注入
5. **Interactive Rich Blocks** — catSelectionBlock (3 cats + random) + taskSelectionBlock (16 tasks, 3 levels + random)

## Why

clowder-ai 开源后需要 onboarding 体验。用户拿到框架不知道怎么用，训练营是"做"——在猫猫陪伴下走完一次真实 feat lifecycle。

## Original Requirements（必填）

> "猫猫训练营！如何快速培养一个合格的 CVO 铲屎官？可以借用游戏的新手任务模式呀！你们几只可爱大猫猫带大家使用我们的猫猫咖啡！"
> "MVP 不是内置预设任务，而是引导新用户像铲屎官一样和猫猫协作——帮装 MCP、解决配置问题、带走一次真正的 feat lifecycle。"
> "入口按钮自己画不要用 emoji；让用户选引导猫；任务菜单加随机抽；可交互富文本做成通用组件。"
> "进阶功能如 TTS Pencil ASR 也要引导，跑不起来就缺失。推荐 Kokoro-82M 给用户，我们自己用 Qwen。"
> "以后有什么需要帮助引导的，可以在这个线程找你们的。"

- 来源：`docs/features/F087-cvo-bootcamp.md` (铲屎官原话 2026-03-08, 2026-03-10, 2026-03-11)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- bootcampState 用 Thread metadata（而非独立 store）— 简单，Phase 流转靠 PATCH thread
- 环境检测用 `child_process.exec` — 直接可靠，不依赖外部检测库
- 前端 bootcamp 按钮内联在 ThreadSidebar（而非独立组件）— 逻辑简单，只有一个按钮+handler
- AC-A8（F075 成就接入）预留 seam 但不实现 — F075 未就绪

## Open Questions

1. **BootcampIcon SVG 设计** — 猫猫学士帽 + 猫耳轮廓，是否需要设计猫（暹罗猫）polish？
2. **环境检测的 MCP 检查** — 当前 hardcode `ok: true`，实际应检测 MCP server 连接状态，是否 P2？
3. **bootcamp-guide SKILL.md 的引导词** — 当前是框架性描述，实际猫猫发消息时由 LLM 自由发挥，是否需要更具体的 prompt template？

## Next Action

请 review 代码质量 + spec 合规。重点关注：
- Thread bootcampState schema 设计是否合理
- 前端入口 UX（按钮位置、CTA 文案）
- 环境检测 API 安全性（exec 调用）
- SystemPromptBuilder 注入是否干净

## 自检证据

### Spec 合规

| AC | 状态 | 说明 |
|----|------|------|
| AC-A1 前端入口 | ✅ | SVG icon + sidebar button + CTA |
| AC-A2 猫猫介绍 | ✅ skill | SKILL.md Phase 1 |
| AC-A3 环境检测 | ✅ | env-check API + SKILL.md Phase 2-3 |
| AC-A4 任务菜单 | ✅ | 16 tasks, 3 levels, allowRandom |
| AC-A5~A7 feat lifecycle | ✅ skill | SKILL.md Phase 5-10 |
| AC-A8 F075 成就 | ⏳ 预留 | seam in SKILL.md |
| AC-A9 Quick Start | ✅ | bootcamp button = entry |
| AC-A10~A11 进阶功能 | ✅ | TTS/ASR/Pencil check + Kokoro-82M recommendation |
| AC-A12 持续帮助 | ✅ skill | SKILL.md Phase 11 |

### 测试结果

```
F087 tests (3 suites): 14 passed, 0 failed ✅
  - thread-bootcamp.test.js: 6 pass
  - bootcamp-env-check.test.js: 3 pass
  - bootcamp-blocks.test.js: 5 pass
SystemPromptBuilder bootcamp tests: 2 passed ✅
tsc --project tsconfig.json: 0 errors ✅
```

### 相关文档
- Feature: `docs/features/F087-cvo-bootcamp.md`
- Plan: `docs/plans/2026-03-11-f087-cvo-bootcamp.md`
- Dependency: F096 Interactive Rich Blocks (PR #365, merged)
