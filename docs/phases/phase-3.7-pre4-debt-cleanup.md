---
feature_ids: []
topics: [phases, pre4, debt]
doc_kind: note
created: 2026-02-26
---

# Phase 3.7: Pre-4.0 技术债全面清理

> 布偶猫 (Opus 4.6) | 2026-02-07
> 前置: Phase 3.6 完成 (362 tests), 缅因猫 review 通过
> 设计: 详见 plan file `distributed-chasing-pebble.md`

## 决策记录

### 范围: P1 全清 + P2 精选

**参与者**: 布偶猫 + 铲屎官 + 缅因猫 (2026-02-07)

铲屎官提议进入 4.0 前清理技术债务。布偶猫评估后建议:

- **P1 全部**: #1 MCP统一挂载, #2 Redis ThreadStore, #3 Redis TaskStore+SummaryStore, #4 MCP工具接入, #5 目录安全
- **P2 精选**: #6 token预算 (4-E前置), #9 cancel鉴权 (缅因猫补充), #13 AgentRouter拆分 (379行)
- **P2 跳过**: #7 图片压缩, #8 级联删除, #10-12 等 — 不阻塞 Phase 4

### 三批次排序: Safety → Persistence → Prerequisites

**来源**: 缅因猫建议, 布偶猫认同

缅因猫 3 条建议:
1. #9 cancel auth 提进清单 — "room membership ≠ 身份验证"
2. #18 加最小 shell 回归测试
3. 排序: Safety先 → Persistence中 → 4.0 Prerequisites后

### MCP 统一方案: HTTP Callback Prompt 注入

只有 Claude CLI 有 `--mcp-config`。Codex/Gemini 无 MCP 配置选项。
方案: systemPrompt 注入 curl HTTP callback 指令。
风险: 沙箱可能阻止出站调用。兜底: prompt 注入无害, 后续探索。

### Token 预算: 字符估算 (不用 tiktoken)

三猫各用不同 tokenizer, 精确计算不现实。字符数足够防超限。

## 三批次概要

| Batch | 主题 | Steps | 预估测试 |
|-------|------|-------|----------|
| 1 | Safety/Stability | 1.1 目录安全 + 1.2 cancel鉴权 + 1.3 shell测试 | ~9 |
| 2 | Persistence | 2.1 Redis ThreadStore + 2.2 Redis Task/SummaryStore | ~12-14 |
| 3 | Phase 4 Prerequisites | 3.1 AgentRouter拆分 + 3.2 token预算 + 3.3 MCP统一 | ~10-16 |

**目标**: ~31-40 新增测试, 总计 ~395-402

## 详细实现

详见 plan file — 每个 Step 含: 问题分析、修改文件列表、代码骨架、测试用例、commit message。
