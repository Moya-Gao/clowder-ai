---
feature_ids: []
topics: [phases, memory, operation]
doc_kind: note
created: 2026-02-26
---

# Phase 5.1: 记忆操作参数化文档

> 作者: 布偶猫 (Opus 4.6)
> 日期: 2026-02-09
> 状态: **草案**
> 来源: `docs/archive/2026-02/research/agent-memory-research-report.md` + 三猫共识

---

## 1) 目标与非目标

**目标**: 把 Hindsight Retain/Recall/Reflect 的调用参数固化为可执行配置，补齐 Phase 5.0 的"怎么调"缺口。

**非目标**:
- 不做 per-cat bank（单一 `cat-cafe-shared`）
- 不做运行时 Disposition 个性化（仅 `template_only`）
- 不做全代码库向量检索 / GraphRAG

---

## 2) Retain Profile

### 提取原则
- **6 个月价值规则**: 只存 6 个月后仍有用的信息
- **Narrative Fact**: 叙事性事实，不是碎片化句子

### 应该存的
- 技术决策及其理由
- 架构模式和设计选择
- 代码审查反馈
- 项目背景和约束条件
- 关键人物和角色信息
- 时间线和里程碑

### 不应该存的
- 通用寒暄
- 过程性闲聊
- 已记录过的重复信息
- 临时性/一次性信息

### Narrative Fact 最低结构
每条 fact 必须包含:
- **结论**: 做了什么决策 / 发生了什么事
- **依据**: 为什么这样做
- **时间**: 何时发生
- **参与者/实体**: 谁参与了、涉及什么模块

### Hindsight 配置
```
HINDSIGHT_API_RETAIN_EXTRACTION_MODE=custom
HINDSIGHT_API_RETAIN_CUSTOM_INSTRUCTIONS="
ONLY extract facts that are:
- Technical decisions and their rationale
- Architecture patterns and design choices
- Code reviews and feedback
- User preferences and working styles
- Project milestones and timeline events

DO NOT extract:
- Generic greetings or pleasantries
- Process chatter
- Repeated information already captured

CONSOLIDATE related technical discussions into ONE fact when possible.
Ask yourself: 'Would this technical context be useful in 6 months?'
"
```

### tags/metadata 约定
- `project:cat-cafe` (必填)
- `kind:decision | phase | discussion | review | bug-report`
- `status:draft | published | archived`
- `author:opus | codex | gemini | user`
- `anchors` in metadata: JSON string of file paths / commit hashes

---

## 3) Recall Profile

### 默认参数
| 参数 | 默认值 | 说明 |
|------|--------|------|
| `budget` | `mid` | 检索深度 |
| `tagsMatch` | `all_strict` | 排除 untagged 记忆 |
| `limit` | `5` | 返回 Top-K |
| `tags` | `["project:cat-cafe"]` | 项目过滤 |

### 图策略
- 使用 `link_expansion`（默认，< 100ms）
- 不用 `mpfp`（太慢）或 `bfs`（大图效果差）

### Token Budget
- 返回结果控制在 4000 tokens 以内
- 留足空间给 system prompt + user message

---

## 4) Reflect Profile

### 当前模式: `template_only`
- 不传 disposition 参数给 Hindsight
- 使用 Hindsight 默认 reflect 行为
- 后续可扩展为 per-cat disposition

### 预留的 Disposition 模板（不实现）
```json
{
  "ragdoll": { "skepticism": 3, "empathy": 4, "literalism": 2, "bias_strength": 0.3 },
  "maine_coon": { "skepticism": 4, "empathy": 3, "literalism": 4, "bias_strength": 0.2 },
  "bengal": { "skepticism": 2, "empathy": 5, "literalism": 2, "bias_strength": 0.4 }
}
```

---

## 5) Step 3 治理 Checklist

| 陷阱 | 缓解措施 |
|------|----------|
| 记忆爆炸 | 提取过滤规则 (custom instructions) + 定期清理低价值记忆 |
| 实体漂移 | 使用规范名称 (canonical_name) + 定期合并重复实体 |
| 观点僵化 | 设置合理的 bias_strength + 允许观点被证伪 |
| 上下文溢出 | 严格控制 token budget (4000) + 分层检索 |
| 隐私泄露 | 敏感信息不存储 + metadata 不含凭据 |
| 锚点失效 | onAccess 轻量校验 (file 路径存在 / commit 存在) |

---

## 6) 验收标准映射

| Phase 5.0 标准 | 5.1 落地方式 |
|---------------|-------------|
| 30s 内返回证据锚点 | `GET /api/evidence/search` → Hindsight Recall (降级: grep docs/) |
| 协作记忆可回答"谁写的、依据是什么" | tags/metadata 含 author + anchors |
| UI 显示检索/写入/降级状态 | system_info 事件 + tool variant (5.0-pre 已实现) |

---

## 7) 风险与回滚

| 风险 | 缓解 | 回滚 |
|------|------|------|
| Hindsight 响应格式不一致 | defensive parsing + 结构化错误 | 降级到 grep docs/ |
| 降级检索命中率低 | 日志收集 evidence_hit_rate | 保留降级路径，优化匹配 |
| 治理状态机与 F3-lite 混淆 | memory/publish 与 /api/memory 完全分路 | 禁用 memory/publish，保留 F3-lite |

---

*布偶猫🐾 (2026-02-09)*
