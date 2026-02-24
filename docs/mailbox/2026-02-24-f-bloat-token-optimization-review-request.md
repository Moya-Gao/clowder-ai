## Review 请求: F-BLOAT System Prompt Token 膨胀修复

### 背景

铲屎官 2026-02-23 夜间发现：每次猫猫发言，超长系统提示词都会重复注入。10 轮对话重复 10 次，token 消耗飞快（~9100 tokens 浪费在 Codex 10 轮 session）。砚砚已写了 bug report 定位根因，本 PR 在此基础上实现修复。

### 设计文档

- Plan: `.claude/plans/linear-skipping-tide.md` (F-BLOAT plan)
- Bug Report: `docs/bug-report/2026-02-23-system-prompt-context-bloat/bug-report.md`（砚砚的分支 `fix/system-prompt-report`）
- 无 ADR（这是 bug fix，不是架构决策）

### Spec Compliance 自检

| # | Spec 要求 | 状态 | 说明 |
|---|-----------|------|------|
| 1 | Teammates 去重 | ✅ | `route-serial.ts:98` — `[...new Set()]` |
| 2 | Resume 时跳过 systemPrompt | ✅ | `invoke-single-cat.ts:~160` — `!isResume \|\| forceReinjection` |
| 3 | 压缩检测 + 重注入 | ✅ | `invoke-single-cat.ts:~347` — module-level Map |
| 4 | 富块规则共享常量 | ✅ | `rich-block-rules.ts` — RICH_BLOCK_RULES + RICH_BLOCK_SHORT |
| 5 | HTTP 端点 rich-block-rules | ✅ | `callback-docs-routes.ts` — GET /api/callbacks/rich-block-rules |
| 6 | HTTP 端点 instructions | ✅ | `callback-docs-routes.ts` — GET /api/callbacks/instructions |
| 7 | MCP 工具 cat_cafe_get_rich_block_rules | ✅ | `rich-block-rules-tool.ts` + MCP server 注册 |
| 8 | Skill 文件 using-rich-blocks | ✅ | `cat-cafe-skills/using-rich-blocks/SKILL.md` |
| 9 | 精简 MCP_TOOLS_SECTION | ✅ | 从 ~1350 chars 降至 ~450 chars |
| 10 | McpPromptInjector short/full split | ✅ | full (~3100 chars) vs short (~400 chars) |
| 11 | route-serial 使用 short/full 判断 | ✅ | sessionManager.get() 判断 new/resume |
| 12 | Size guard 收紧 | ✅ | 2000→1400 chars |
| 13 | API 测试全通过 | ✅ | 1726 pass, 0 new fail |

### 偏离说明

1. **压缩检测用 module-level Map 而非 SessionRecord 字段**：Plan 提议在 SessionRecord 上加 `needsContextReinjection` 字段。实际用 `_prevContextFill` Map + `_needsReinjection` Set，避免改 shared 类型。Trade-off：服务重启丢状态，但 session seal 先于此触发。
2. **Phase 4 合并到 Phase 3**：McpPromptInjector 的 short/full split 在 Phase 3 实现过程中同步完成。

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `route-serial.ts` | 修改 | teammates 去重 + short/full MCP 判断 |
| `invoke-single-cat.ts` | 修改 | resume 跳过 systemPrompt + 压缩检测 |
| `SystemPromptBuilder.ts` | 修改 | 精简 MCP_TOOLS_SECTION (1350→450 chars) |
| `McpPromptInjector.ts` | 重写 | full/short 双版本 + 提取 resolveExampleHandle |
| `rich-block-rules.ts` | 新增 | 共享富块规则常量 |
| `callback-docs-routes.ts` | 新增 | 渐进式披露 HTTP 端点 (2 个 GET) |
| `index.ts` (api) | 修改 | 注册新路由 |
| `routes/index.ts` | 修改 | 导出新路由 |
| `rich-block-rules-tool.ts` | 新增 | MCP 工具 handler |
| `index.ts` (mcp-server) | 修改 | 注册 MCP 工具 |
| `tools/index.ts` (mcp-server) | 修改 | 导出新工具 |
| `SKILL.md` | 新增 | using-rich-blocks Skill |
| `system-prompt-builder.test.js` | 修改 | size guard 2000→1400 |
| `mcp-prompt-injector.test.js` | 修改 | 新增 4 个 short-form tests |
| `invoke-single-cat.test.js` | 修改 | 新增 3 个 F-BLOAT tests |

### Git SHA

- Base: `5a86484` (main)
- Head: `58d56b9`
- Branch: `feat/f-bloat-token-optimization`

### 测试状态

```
pnpm test (non-Redis): 1726 pass, 0 new fail
新增 F-BLOAT 测试: 7 个全部通过
  - system-prompt-builder: size guard 1400 chars (从 2000 收紧)
  - mcp-prompt-injector: 4 个 short-form tests
  - invoke-single-cat: 3 个 (resume skip / new inject / compression re-inject)
```

### Token 节省量级

| 组件 | 修复前/轮 | 修复后/轮 | 节省 |
|------|-----------|-----------|------|
| SystemPrompt (resume) | ~160 tokens | 0 | ~160 |
| MCP_TOOLS_SECTION | ~330 tokens | ~80 tokens | ~250 |
| McpPromptInjector (Codex/Gemini) | ~750 tokens | ~120 tokens (短版) | ~630 |
| **10轮 Codex session 总计** | **~9100 tokens** | **~2400 tokens** | **~73%** |

### Review 重点

1. **invoke-single-cat.ts 压缩检测逻辑**：module-level Map + 40% 阈值，服务重启丢失状态是否可接受？
2. **route-serial.ts sessionManager.get() 调用**：新增一次 async 调用判断 new/resume，对延迟的影响
3. **callback-docs-routes.ts 无鉴权**：文档端点无需 invocation token，这些都是公开的 API 使用说明
4. **MCP 工具 richBlockRulesInputSchema 为空对象**：无参数工具的 schema 写法是否正确
5. **Skill 文件内容**：using-rich-blocks 是否覆盖了所有必要的富块规范

### 五件套

**What**: 修复系统提示词 token 膨胀问题，通过 5 个 Phase 将 10 轮 Codex session 的 prompt 开销从 ~9100 降至 ~2400 tokens（节省 ~73%）

**Why**: 铲屎官发现每轮对话都注入完整系统提示词，token 消耗线性增长。核心原因是 resume 时重复注入 + 富块规则/MCP 指令每轮全量注入

**Tradeoff**:
- 压缩检测用 module-level 状态（非持久化），服务重启丢失 → 但 session seal 机制会先触发
- 没有改 SessionRecord 类型 → 避免改 shared 包，减少变更范围
- route-parallel.ts 未同步 teammates 去重 → parallel 模式较少用，可后续补

**Open Questions**:
- 压缩检测 40% 阈值是否合适？需要实际运行数据验证
- Codex/Gemini 的 HTTP 文档端点在沙箱环境是否可达？

**Next Action**: 请 review 上述 15 个文件，重点关注 invoke-single-cat.ts 和 route-serial.ts 的逻辑变更

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成
- [x] 设计文档已附
- [x] 测试通过
- [x] 五件套完整
