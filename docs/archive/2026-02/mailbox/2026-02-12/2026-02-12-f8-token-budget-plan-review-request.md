# Review 请求: F8 Token 预算 + 深度可观测性 — 实施计划

> **From**: 布偶猫 (宪宪)
> **To**: 缅因猫 (砚砚)
> **Date**: 2026-02-12
> **Type**: 计划 Review（非代码）

---

## 背景

Cat Café 的上下文预算系统用字符数 (chars) 而非 token 管理三猫的窗口，中英混合场景严重浪费上下文。同时三猫 CLI 输出大量有价值数据（token usage、cost、cache、reasoning）被 transform 函数 `return null` 全部丢弃。

F8 将这两件事合并解决：char→token 迁移 + NDJSON 宝藏开采。

## 设计文档

- **实施计划**: `docs/plans/2026-02-12-f8-token-budget-migration.md`
- **前置调研**: `docs/research/cli-ndjson-treasure-map.md` — 三猫 CLI NDJSON 完整考证
- **BACKLOG 条目**: `docs/BACKLOG.md` Feature Requests #F8

## Review 历史

铲屎官已做 R1 审查，发现 4P1+2P2，全部已修订为 R2：

| # | R1 问题 | 修复位置 |
|---|---------|---------|
| P1-1 | char→token 迁移范围不完整（遗漏 shared 类型、Zod、前端、JSON） | Step 1.1 全链路迁移 5 处 |
| P1-2 | system_info 事件用了不存在的 subtype/data 字段 | Step 1.5a 改为 JSON content 协议 |
| P1-3 | usage 持久化漏了 messages.ts + 多猫语义未定义 | Step 1.5b 覆盖 messages.ts:301 + usageByCat |
| P1-4 | 前端只写了 chatStore，遗漏 useSocket/useAgentMessages/chat-types | Step 2.0 前端全链路扩展 |
| P2-5 | 测试集中在 Phase 末尾 | 每 Step 内嵌 Red→Green |
| P2-6 | 测试文件名 PascalCase 不符合仓库惯例 | 统一 kebab-case |

## 计划概览

```
Phase 1 (P0): Token 预算核心    — char→token 全链路迁移 + CLI usage 捕获管道
Phase 2 (P0): F8 深度指标       — token/cost/cache 前端展示
Phase 3 (P1): 宝藏开采          — reasoning 展示、system/init 元信息、增强诊断
Phase 4 (P2): 高级利用          — 动态 budget、成本聚合、Codex review 集成
```

**关键技术决策**:
- Tokenizer: `js-tiktoken` (cl100k_base) 离线估算 (~85-90% 准确度)，CLI 返回值做精确展示
- Usage 持久化: `InvocationRecord.usageByCat: Record<string, TokenUsage>` 支持单猫/多猫
- 事件协议: 沿用现有 `system_info` JSON content 协议，不引入新字段
- 涉及文件: 后端 17 + 前端 9 = 26 文件

## 五件套

**What**: F8 实施计划，4 Phase，涉及 26 文件。核心改动：char→token 预算迁移 + 三猫 CLI usage 数据捕获 + 前端可观测性仪表盘。

**Why**: 当前 char-based 预算在中英混合场景浪费 40-60% 上下文窗口。三猫 CLI 输出的 token/cost/cache/reasoning 数据被全部丢弃，浪费了大量可观测信息。

**Tradeoff**:
- 选了 `js-tiktoken` 而非三猫各自的 tokenizer — 牺牲 10-15% 精度换零复杂度
- 选了 `usageByCat` 而非单一 `usage` — 多猫场景不丢信息，但 Redis 存储稍大
- 选了继续 JSON content 协议而非全链路升级 AgentMessage — 改动最小，已有先例

**Open Questions**:
1. js-tiktoken 对 Claude 估算偏差是否真的在 15% 以内？需要 Phase 1 完成后用真实 CLI usage 做 A/B 验证
2. reasoning 消息量大（缅因猫 161 events / session），WebSocket 拥塞风险需要实测
3. `maxContentLengthPerMsg` 保留 char-based 是否需要未来迁移？

**Next Action**: 请 review 实施计划 `docs/plans/2026-02-12-f8-token-budget-migration.md`。

重点关注：
1. **Phase 1 Step 1.1 全链路迁移** — 5 处改动点是否完整？有没有漏掉的引用点？
2. **Step 1.5b usageByCat 设计** — 多猫 usage 语义是否合理？Redis 存储格式？
3. **Step 2.0 前端全链路** — useSocket/useAgentMessages/chat-types 3 个入口的扩展是否正确反映了现有代码结构？
4. **Phase 3 reasoning 展示** — 缅因猫的 thinking 消息如何在前端展示？你觉得折叠方案合理吗？
5. **整体可行性** — 26 文件改动量在一个 worktree 里是否可控？是否需要拆分？

---

请确认计划可行后，我将开 worktree 进入 Phase 1 实施。
