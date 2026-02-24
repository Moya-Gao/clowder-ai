# Plan: Skills 作为工具文档单一真相源

> 日期：2026-02-24
> 决策人：铲屎官 + 布偶猫 + 缅因猫
> 触发：F-BLOAT PR #63 合入后，铲屎官指出 curl endpoint 不应作为主路径
> 关联讨论：[压缩检测讨论](../discussions/2026-02-24-compression-detection-cross-provider/README.md)

## 背景

PR #63 (F-BLOAT token optimization) 为了"渐进式披露"创建了：
- `GET /api/callbacks/instructions` — 返回全量 HTTP callback curl 文档
- `GET /api/callbacks/rich-block-rules` — 返回 rich block 完整规范
- `cat_cafe_get_rich_block_rules` MCP tool — 封装上述 endpoint
- `McpPromptInjector` full form — 首轮注入 ~3100 chars 的完整 curl 示例

**铲屎官批评**：三猫都已挂了标准 Skills（`~/.claude/skills/`、`~/.codex/skills/`、`~/.gemini/skills/` 全部 symlink 到 `cat-cafe-skills/`），工具文档应该走 Skills 标准加载，不应该自创 HTTP endpoint + curl 这套旁路。

## 三方共识

1. **Skills 做单一真相源**：callback 用法、rich block 规范都写在 `cat-cafe-skills/` 里
2. **prompt 只留最小提示**：凭证变量名 + 工具名列表 + "需要细节就加载对应 skill"
3. **HTTP endpoint / MCP tool 仅作 fallback**：用于 skill 文件不可读 / 人类调试，不在 prompt 里主动引导猫去 curl
4. **`McpPromptInjector` 永远 short**：废弃 full form，只保留 short form 并引用 skill 名称

## 具体改动

### Phase 1: 创建 `using-mcp-callbacks` Skill

新建 `cat-cafe-skills/using-mcp-callbacks/SKILL.md`：
- 凭证说明（`$CAT_CAFE_INVOCATION_ID` + `$CAT_CAFE_CALLBACK_TOKEN`）
- 每个工具的完整 curl 示例（从 `McpPromptInjector.buildMcpCallbackInstructions` 迁移）
- @队友的正确方式（行首 `@猫名`）
- 三猫都能通过 Skills 标准加载

### Phase 2: 改造 McpPromptInjector

- **废弃 `buildMcpCallbackInstructions`（full form）**
- **`buildMcpCallbackInstructionsShort` 改名为 `buildMcpCallbackInstructions`**（只有一种 form 了）
- 内容调整：
  - 保留：凭证变量名 + 工具名列表 + @队友规则
  - 新增：`"需要工具使用详情，加载 using-mcp-callbacks skill"`
  - 删除：curl 示例、endpoint 引用
- `route-serial.ts` / `route-parallel.ts` 不再区分 new/resume session 选 short/full

### Phase 3: 调整 SystemPromptBuilder

- 保留 `RICH_BLOCK_SHORT` 精简提示
- 把 "无 MCP 的猫也可通过 GET /api/callbacks/rich-block-rules 获取同等规范" 改为 "加载 using-rich-blocks skill 查看完整规范"

### Phase 4: 降级保留 HTTP endpoints

- `GET /api/callbacks/instructions` 和 `GET /api/callbacks/rich-block-rules` 保留
- `cat_cafe_get_rich_block_rules` MCP tool 保留
- 但 **prompt 里不再主动引导猫去 curl 这些 endpoint**
- 仅作为 fallback（skill 不可读时）和人类调试用

### Phase 5: 更新测试

- `mcp-prompt-injector.test.js`：删除 full form 相关测试，更新 short form 断言
- `system-prompt-builder.test.js`：更新 rich block 提示文案
- `invoke-single-cat.test.js`：确认 route-serial 不再区分 short/full
- Size guard 可能需要调整（prompt 会变小）

## 不做的事

- 不删除 `using-rich-blocks/SKILL.md`（已有，保留）
- ~~不改 `callback-docs-routes.ts`~~ → R1 review 修正：endpoint 改为直接读取 `SKILL.md` 文件内容返回，避免"fallback 指向 skill → skill 不可用 → fallback 失效"的循环依赖
- 不改 MCP tool `cat_cafe_get_rich_block_rules`（保留作 fallback）

## 验证标准

1. `McpPromptInjector` 只有一种 form，<500 chars
2. prompt 里无 curl 示例、无 endpoint URL
3. prompt 里有 skill 名称引用
4. 三猫都能通过 Skills 加载完整文档
5. 全量测试通过

## Symlink 现状确认（2026-02-24 查验）

```
~/.claude/skills/ → 19 个 cat-cafe-skills symlinks ✅
~/.codex/skills/  → 19 个 cat-cafe-skills symlinks ✅（含 Codex 额外的 figma/pencil 等）
~/.gemini/skills/ → 19 个 cat-cafe-skills symlinks ✅（含 Gemini 额外的 figma/pencil 等）
```

新建的 `using-mcp-callbacks` 需要三猫都加 symlink。
