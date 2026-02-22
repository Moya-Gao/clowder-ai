## Review 请求: Callback 提示词统一 + thinkingMode 默认改 debug + Whisper 可见性修复

### 背景

铲屎官反映猫猫频繁遇到 401 callback credentials expired 错误，根因是：
1. 提示词误导猫猫用 `curl` 发 `post_message` 来 @队友，而不是直接在文本里 @
2. 心里话默认模式是 `play`（隐藏），导致猫猫看不到彼此的 CLI 输出，更依赖 callback
3. Whisper 内容在 debug 模式下也对其他猫不可见（canViewMessage viewer 选择错误）
4. 401 错误没有 hint 引导猫猫用文本 @

铲屎官要求：修复这些问题 + 心里话默认改 debug + 统一 401 hint。

### 设计文档

- Bug report: `docs/bug-report/whisper-content-invisible-to-cats/bug-report.md`
- 无独立 plan 文档（铲屎官直接指示的 bug fix + 改善任务）
- BACKLOG #88/#89: 延后的 session-scoped token 和 parallel A2A 配置

### Spec Compliance 自检

| # | 需求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| A | @队友提示词统一：文本@为主，callback为辅 | ✅ | McpPromptInjector.ts, SystemPromptBuilder.ts, callback-tools.ts, mcp-server/index.ts | mcp-prompt-injector.test.js (5p), system-prompt-builder.test.js (27p) |
| B | thinkingMode 默认 play→debug (8站点) | ✅ | AgentRouter.ts, route-serial.ts, route-parallel.ts, route-helpers.ts, callbacks.ts, RedisThreadStore.ts, ThreadStore.ts, RightStatusPanel.tsx | route-strategies.test.js (42p) |
| C | whisper debug 模式可见 | ✅ | callbacks.ts, route-helpers.ts | route-strategies.test.js whisper tests ×2 |
| D | 401 统一 hint | ✅ | callbacks.ts (定义+5处), callback-memory-routes.ts (3处), callback-task-routes.ts (1处), callback-auth.ts (2处) | - |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| McpPromptInjector.ts | 修改 | 重构提示词：文本@优先、callback降级 |
| SystemPromptBuilder.ts | 修改 | MCP_TOOLS_SECTION 加 @队友警告头 |
| callback-tools.ts | 修改 | post_message description 缩窄 |
| mcp-server/index.ts | 修改 | 同步 description 变更 |
| AgentRouter.ts | 修改 | thinkingMode 默认 → debug ×2 |
| route-serial.ts | 修改 | thinkingMode 默认 → debug |
| route-parallel.ts | 修改 | thinkingMode 默认 → debug |
| route-helpers.ts | 修改 | thinkingMode 默认 → debug + viewer 选择 |
| callbacks.ts | 修改 | thinkingMode默认 + viewer选择 + EXPIRED_CREDENTIALS_ERROR常量 + 5处401替换 |
| RedisThreadStore.ts | 修改 | thinkingMode 默认 → debug |
| ThreadStore.ts | 修改 | 接口注释更新 |
| RightStatusPanel.tsx | 修改 | 前端 thinkingMode 默认 → debug |
| callback-auth.ts | 修改 | 2处401替换 |
| callback-memory-routes.ts | 修改 | 3处401替换 |
| callback-task-routes.ts | 修改 | 1处401替换 |
| route-strategies.test.js | 修改 | 3个测试显式指定 thinkingMode: 'play' |
| bug-report.md | 修改 | 状态更新 + 根因分析 |

### Git SHA
- Base: `f20f587` (main HEAD)
- Head: `1c11de6` (5 commits)

### 测试状态
```
route-strategies.test.js: 42 passed, 0 failed
system-prompt-builder.test.js: 27 passed, 0 failed
mcp-prompt-injector.test.js: 5 passed, 0 failed
全量 API tests: 1675 passed, 6 failed (全部 pre-existing Redis 隔离守护, 非本次改动)
```

### Review 重点

1. **Task C: viewer 选择逻辑** — debug 模式用 `{ type: 'user' }` 让所有消息可见，play 模式用 `{ type: 'cat', catId }` 保留 whisper 隐私。这个逻辑是否有安全隐患？
2. **Task A: 提示词一致性** — McpPromptInjector（Codex/Gemini用）和 SystemPromptBuilder（Claude用）的指引是否一致、无歧义？
3. **Task D: EXPIRED_CREDENTIALS_ERROR hint** — hint 内容是否清晰，会不会混淆猫猫？

### 五件套

**What**: 4项修复——提示词统一、thinkingMode默认改debug、whisper可见性修复、401 hint统一
**Why**: 猫猫频繁401错误的根因是提示词误导+心里话隐藏模式不合适；whisper bug阻碍了调试模式的完整性
**Tradeoff**: 没有实现 session-scoped token（根治方案，登记为BACKLOG #88，改动面太大）；选择了快速见效的提示词+默认值修复
**Open Questions**: 1) debug模式下whisper对所有猫可见是否符合铲屎官预期？2) hint文案是否需要英文版本？
**Next Action**: 请 review 上述 17 个文件，重点关注 viewer 选择逻辑和提示词一致性

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成
- [x] Bug report 已更新
- [x] 测试通过（1675p, 6 pre-existing Redis fail）
- [x] 五件套完整
