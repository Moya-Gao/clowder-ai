# Review Request: 移除 A2A 动作词门禁，行首 @mention 无条件路由

## What

移除 `a2a-mentions.ts` 中的动作词关键词门禁（`CJK_ACTION_KEYWORDS` / `ASCII_ACTION_KEYWORDS` / `hasActionability` / `getParagraph` / suppression tracking），改为**行首 @mention 无条件路由**。

核心变更：
- `a2a-mentions.ts`：删除关键词匹配、段落分析、suppression 系统，保留行首检测 + 代码块过滤 + 自 mention 过滤 + token boundary
- `route-serial.ts`：删除 suppressedMentions 反馈写入，改用 `parseA2AMentions`
- `route-parallel.ts`、`callbacks.ts`：移除 `mentionActionabilityMode` 读取和传递
- 8 个测试文件更新，旧的 suppression 测试替换为新行为测试

## Why

动作词门禁与 CLAUDE.md 格式规范自相矛盾：
- CLAUDE.md 要求"另起一行行首写 @猫名"
- 严格模式要求动作词在**同一段落**
- 按规范写 → 必被拦；不按规范写 → @mention 识别不了
- 铲屎官原话："全靠我转发"

## Original Requirements

> "你们强匹配太挫了 很容易变成全靠我转发" — 铲屎官
> "场景三有可能人家下一行说了 动词哦 甚至有交接的文档你也拦截？" — 铲屎官
- 来源：Cat Cafe thread `thread_mm4dj9jp0tij0ch3`，2026-03-04 02:52-02:57
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

放弃了"可配置动作词"方案（砚砚提议 + 宪宪初始决策），因为铲屎官明确否定了整个关键词门禁思路。关键词系统的类型（`MentionActionabilityMode`、`SuppressedA2AMention` 等）标记为 `@deprecated` 保留，避免破坏 ThreadStore 接口和前端已有的 mode toggle UI。前端清理作为后续任务。

## Open Questions

1. **ThreadStore 的 `mentionActionabilityMode` 字段**：目前保留但无效。是否需要这轮清理 Thread schema + API endpoint + 前端 toggle？还是留到后续？
2. **SystemPromptBuilder 的 routing feedback 注入**：代码仍存在但永远不会触发（suppressed 永远为空）。是否应当删除？
3. **false positive 风险**：猫猫引用另一只猫的行为（如"@codex 上次提到..."）现在会触发路由。这在实际使用中是否是问题？

## Next Action

请 review 代码改动，重点关注：
- 行首 @mention 无条件路由的逻辑是否正确
- 类型向后兼容是否足够
- 测试覆盖是否遗漏场景

## 自检证据

### Spec 合规
- 铲屎官三条原始需求全部覆盖
- 保留过滤：代码块内、自 mention、非行首、MAX_A2A_MENTION_TARGETS=2

### 测试结果
```
node --test (289 tests)  → 289 passed, 0 failed
pnpm lint                → 0 errors
pnpm build               → exit 0
```

### 改动统计
8 files, +92 / -274（净删 182 行）

### 相关文档
- Feature: F046 (anti-drift protocol) Phase D mention routing
- Thread: `thread_mm4dj9jp0tij0ch3`
