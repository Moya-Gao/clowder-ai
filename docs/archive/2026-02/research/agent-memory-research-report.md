---
feature_ids: []
topics: [agent, memory]
doc_kind: research
created: 2026-02-26
---

# Agent 记忆系统技术调研报告

> 📅 2026年2月9日 | 🐱 作者：宪宪 (Claude Opus 4.5 布偶猫)
> 
> 本报告供 Cat Café 多猫协作系统参考，特别是给 4.6 Opus 猫猫阅读

---

## 一、执行摘要

Agent 记忆系统正从简单的 RAG（检索增强生成）向**结构化、可学习的认知架构**演进。本报告深入分析了当前最先进的开源方案 **Hindsight**，并对比了 Mem0、MemGPT/Letta、Zep 等社区方案，提炼出记忆存储的最佳实践。

**核心发现：**

1. **记忆不只是存储，而是认知基底** - Hindsight 将记忆组织为四个认知网络，区分事实、经历、观察和信念
2. **Narrative Facts > Sentence Fragments** - 存储叙事性事实而非碎片化句子，保留推理上下文
3. **多路检索 + RRF 融合** - 语义、关键词、图遍历、时间过滤四路并行，效果远超单一向量检索
4. **Disposition Traits 塑造个性** - 通过 skepticism、empathy 等参数，让不同 agent 对同一事实形成不同观点

---

## 二、Hindsight 架构深度分析

### 2.1 设计哲学

Hindsight 的核心理念是：**记忆不是外挂的检索层，而是推理的第一公民基底（first-class substrate for reasoning）**。

传统 RAG 的问题：
- 模糊了证据（evidence）和推理（inference）的边界
- 难以组织长时间跨度的信息
- 无法解释 agent 为何这样回答

Hindsight 的解决方案：将记忆组织为**四个认知上独立的网络**。

### 2.2 四个逻辑网络（Memory Networks）

```
┌─────────────────────────────────────────────────────────────────┐
│                    Hindsight 四网络架构                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐    ┌──────────────┐                         │
│   │ World Network │    │  Experience  │     ← Retain 阶段构建   │
│   │  外部世界事实  │    │   Network    │                         │
│   │              │    │  Agent 经历   │                         │
│   └──────┬───────┘    └──────┬───────┘                         │
│          │                   │                                  │
│          └─────────┬─────────┘                                  │
│                    ▼                                            │
│          ┌─────────────────┐                                    │
│          │  Observations   │     ← Consolidation 阶段自动生成   │
│          │   综合知识表示    │       （后台异步）                  │
│          └────────┬────────┘                                    │
│                   │                                             │
│                   ▼                                             │
│          ┌─────────────────┐                                    │
│          │  Mental Models  │     ← Reflect 阶段形成和更新       │
│          │  (Opinions)     │                                    │
│          │  主观判断/信念   │                                    │
│          └─────────────────┘                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2.1 World Network（世界网络）

**定义**：关于外部世界的客观事实

**示例**：
```json
{
  "fact_id": "f_001",
  "content": "Alice 在 Google 担任软件工程师",
  "network": "world",
  "temporal_range": {
    "start": "2023-01-15",
    "end": null
  },
  "entities": ["Alice", "Google"],
  "confidence": 1.0
}
```

**特点**：
- 不带主观判断
- 有时间范围（可能已过期）
- 可追溯信息来源

#### 2.2.2 Experience Network（经历网络）

**定义**：Agent 自身的经历和行动

**示例**：
```json
{
  "fact_id": "e_001",
  "content": "我帮助用户重构了 auth 模块，采用了 OAuth2.0 方案",
  "network": "experience",
  "timestamp": "2026-02-08T14:30:00Z",
  "outcome": "positive",
  "entities": ["auth 模块", "OAuth2.0"]
}
```

**特点**：
- 第一人称视角
- 记录行动结果（成功/失败）
- 用于学习和改进

#### 2.2.3 Observations（观察网络）

**定义**：从底层事实综合出的知识表示

**生成方式**：Consolidation 后台任务自动触发

**示例**：
```json
{
  "observation_id": "o_001",
  "entity": "Alice",
  "summary": "Alice 是一位资深软件工程师，2023年在 Google 工作，2025年晋升为 Senior Engineer，擅长分布式系统",
  "supporting_facts": ["f_001", "f_015", "f_023"],
  "last_updated": "2026-02-08"
}
```

**特点**：
- 自动整合相关事实
- 跟踪支撑证据
- 随新证据持续演化

#### 2.2.4 Mental Models / Opinions（心智模型/观点网络）

**定义**：Agent 习得的理解和主观判断

**关键特性**：带有**置信度分数**，会随时间演化

**示例**：
```json
{
  "opinion_id": "op_001",
  "statement": "微服务架构适合中大型团队，但对小团队可能是过度工程",
  "confidence": 0.75,
  "supporting_evidence": ["e_003", "e_007", "o_012"],
  "contradicting_evidence": ["e_015"],
  "formed_at": "2026-01-15",
  "last_reinforced": "2026-02-08",
  "reinforcement_count": 5
}
```

**特点**：
- 观点是轨迹（trajectories），不是标签
- 新证据可以强化、弱化或修正信念
- 不同 disposition 的 agent 对同一事实可形成不同观点

---

### 2.3 三大核心操作

```
┌─────────────────────────────────────────────────────────────────┐
│                     Hindsight 操作流程                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  输入数据 ──► RETAIN ──► 记忆图谱 ──► RECALL ──► 相关记忆       │
│              (TEMPR)              (TEMPR)                       │
│                                      │                          │
│                                      ▼                          │
│                               REFLECT ──► 响应/观点更新          │
│                                (CARA)                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3.1 Retain（存储）- TEMPR 组件

**功能**：将原始对话/文档转换为结构化记忆

**处理流程**：
```
原始内容 
    ↓
[1] Narrative Fact Extraction（叙事性事实提取）
    ↓
[2] Entity Resolution（实体消解）
    ↓
[3] Temporal Normalization（时间归一化）
    ↓
[4] Link Construction（链接构建）
    ↓
结构化记忆图谱
```

**四种图链接类型**：

| 链接类型 | 描述 | 示例 |
|---------|------|------|
| Temporal | 时间先后关系 | "A 发生在 B 之前" |
| Semantic | 语义相似性 | 向量距离 < 阈值 |
| Entity | 共享实体 | 都提到 "Alice" |
| Causal | 因果关系 | "因为 A，所以 B" |

**LLM 要求**：
- 需要支持至少 **65K output tokens**（长文档提取）
- 配置：`HINDSIGHT_API_RETAIN_MAX_COMPLETION_TOKENS=64000`
- 这是最消耗 token 的操作

**Narrative Fact 提取示例**：

输入对话：
```
用户：我们昨天讨论的 auth 方案，Alice 说用 OAuth2.0
助手：好的，我记下了。Alice 建议使用 OAuth2.0 进行身份验证。
用户：对，她说这样更安全，而且 Google 那边的团队也熟悉
```

提取结果：
```json
{
  "facts": [
    {
      "content": "Alice 建议在 auth 方案中使用 OAuth2.0，理由是更安全且 Google 团队熟悉",
      "temporal": "2026-02-07",
      "entities": ["Alice", "OAuth2.0", "Google", "auth 方案"],
      "causal_links": [
        {
          "cause": "OAuth2.0 更安全且 Google 团队熟悉",
          "effect": "Alice 推荐使用 OAuth2.0"
        }
      ]
    }
  ]
}
```

**关键点**：
- 生成的是 **narrative units**（叙事单元），不是 sentence-level fragments
- 最大化保留跨轮次的推理上下文
- 减少信息丢失

#### 2.3.2 Recall（检索）- TEMPR 组件

**功能**：从记忆图谱中检索相关记忆

**四路并行检索**：

```
                      Query
                        │
        ┌───────┬───────┼───────┬───────┐
        ▼       ▼       ▼       ▼       ▼
    [语义向量] [BM25]  [图遍历] [时间过滤]
        │       │       │       │
        └───────┴───────┴───────┴───────┘
                        │
                        ▼
              Reciprocal Rank Fusion (RRF)
                        │
                        ▼
              Cross-Encoder Reranking
                        │
                        ▼
              Token Budget 裁剪
                        │
                        ▼
                   返回结果
```

**图遍历策略**：
- `link_expansion`（默认）：从语义种子快速图扩展，< 100ms
- `mpfp`：Multi-Path Fact Propagation，迭代遍历 + 激活传播，更彻底但更慢
- `bfs`：广度优先搜索，简单但对大图效果差

**Token Budget**：
- 可配置返回结果的 token 上限
- 在预算内返回最相关记忆
- 避免上下文窗口溢出

**成本**：相对低（几千 tokens）

#### 2.3.3 Reflect（推理）- CARA 组件

**功能**：基于检索到的记忆进行偏好条件化推理（Preference-conditioned Reasoning）

**核心机制**：Disposition Traits（性格特质）

```python
disposition = {
    "skepticism": 3,      # 1-5, 对信息的怀疑程度
    "literalism": 3,      # 1-5, 字面理解 vs 隐含理解
    "empathy": 4,         # 1-5, 共情程度
    "bias_strength": 0.3  # 0-1, 偏见强度
}
```

**检查优先级**：
```
Mental Models (最高优先)
       ↓
Observations
       ↓
Raw Facts (最低优先)
```

**Opinion 更新机制**：

```python
# 伪代码示意
def update_opinion(opinion, new_evidence):
    if new_evidence.supports(opinion):
        opinion.confidence += delta
        opinion.reinforcement_count += 1
    elif new_evidence.contradicts(opinion):
        opinion.confidence -= delta
        if opinion.confidence < threshold:
            # 修正或废弃观点
            revise_or_discard(opinion)
    opinion.last_updated = now()
```

**成本**：中等（几K input + 几K output）

---

### 2.4 数据存储格式

Hindsight 使用 **PostgreSQL + pgvector** 作为存储后端。

#### 2.4.1 核心表结构（推断）

```sql
-- 事实表
CREATE TABLE facts (
    id UUID PRIMARY KEY,
    bank_id VARCHAR(255) NOT NULL,
    network VARCHAR(50) NOT NULL,  -- 'world' | 'experience'
    content TEXT NOT NULL,
    embedding VECTOR(384),  -- 或 1536/3072 取决于模型
    temporal_start TIMESTAMP,
    temporal_end TIMESTAMP,
    confidence FLOAT DEFAULT 1.0,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 实体表
CREATE TABLE entities (
    id UUID PRIMARY KEY,
    bank_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    canonical_name VARCHAR(255),
    mention_count INT DEFAULT 1,
    metadata JSONB
);

-- 事实-实体关联
CREATE TABLE fact_entities (
    fact_id UUID REFERENCES facts(id),
    entity_id UUID REFERENCES entities(id),
    PRIMARY KEY (fact_id, entity_id)
);

-- 链接表
CREATE TABLE fact_links (
    source_fact_id UUID REFERENCES facts(id),
    target_fact_id UUID REFERENCES facts(id),
    link_type VARCHAR(50) NOT NULL,  -- 'temporal' | 'semantic' | 'entity' | 'causal'
    strength FLOAT DEFAULT 1.0,
    metadata JSONB,
    PRIMARY KEY (source_fact_id, target_fact_id, link_type)
);

-- 观点/心智模型表
CREATE TABLE opinions (
    id UUID PRIMARY KEY,
    bank_id VARCHAR(255) NOT NULL,
    statement TEXT NOT NULL,
    confidence FLOAT DEFAULT 0.5,
    supporting_facts UUID[],
    contradicting_facts UUID[],
    reinforcement_count INT DEFAULT 0,
    formed_at TIMESTAMP DEFAULT NOW(),
    last_reinforced TIMESTAMP
);

-- 观察表（实体摘要）
CREATE TABLE observations (
    id UUID PRIMARY KEY,
    bank_id VARCHAR(255) NOT NULL,
    entity_id UUID REFERENCES entities(id),
    summary TEXT NOT NULL,
    supporting_facts UUID[],
    last_updated TIMESTAMP DEFAULT NOW()
);
```

#### 2.4.2 向量配置

```python
# 支持的 embedding 模型
EMBEDDING_MODELS = {
    "BAAI/bge-small-en-v1.5": 384,   # 默认，轻量
    "text-embedding-3-small": 1536,  # OpenAI
    "text-embedding-3-large": 3072,  # OpenAI 高精度
}

# 重要：一旦存储数据，不能更换维度不同的模型
# 需要清空数据库或使用相同维度的模型
```

---

## 三、社区其他方案对比

### 3.1 方案对比总览

| 特性 | Hindsight | Mem0 | MemGPT/Letta | Zep |
|-----|-----------|------|--------------|-----|
| **架构** | 四网络认知架构 | 双阶段提取+图增强 | OS 式内存层级 | Session 式 + 图 |
| **记忆分类** | World/Experience/Observation/Opinion | Facts + Graph Relations | Core/Archival/Recall | Blocks + Graph |
| **检索方式** | 四路并行 + RRF | 向量 + 图遍历 | 工具调用 | 向量 + 摘要 |
| **学习能力** | Opinion 演化 | 无 | 自编辑 Core Memory | 无 |
| **Benchmark (LOCOMO)** | 91.4% | 68.5% | 74.0%* | - |
| **开源** | ✅ | ✅ | ✅ | 部分 |

*Letta 使用 Filesystem 方式的成绩

### 3.2 Mem0 详解

**架构**：双阶段流水线

```
┌─────────────────────────────────────────────────────┐
│                    Mem0 架构                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Extraction Phase]                                 │
│       │                                             │
│       ├── 对话摘要（异步更新）                        │
│       ├── 近期消息上下文                             │
│       └── LLM 提取显著信息                          │
│             │                                       │
│             ▼                                       │
│  [Update Phase]                                     │
│       │                                             │
│       ├── 与现有记忆比对                             │
│       ├── 冲突检测与解决                             │
│       └── 存储/更新/删除                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Mem0g（图增强版）**：

```
G = (V, E, L)
- V: 实体节点（人、地点、物品）
- E: 关系边
- L: 边标签（关系类型）
```

**优点**：
- 简单易用，API 友好
- 增量处理，低延迟
- 图版本支持复杂关系推理

**缺点**：
- 无观点演化机制
- 无 disposition 个性化
- Multi-hop 问题表现一般

### 3.3 MemGPT / Letta 详解

**核心理念**：将 LLM 类比为操作系统，自主管理内存

```
┌─────────────────────────────────────────────────────┐
│                MemGPT 内存层级                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────┐       │
│  │         Core Memory (类比 RAM)          │       │
│  │  - Persona: Agent 自身人设              │       │
│  │  - Human: 用户信息                      │       │
│  │  - 始终在上下文窗口内                    │       │
│  └─────────────────────────────────────────┘       │
│                      ↕ 工具调用                     │
│  ┌─────────────────────────────────────────┐       │
│  │       Archival Memory (类比 Disk)       │       │
│  │  - 向量数据库存储                        │       │
│  │  - 无限容量                             │       │
│  │  - 按需检索                             │       │
│  └─────────────────────────────────────────┘       │
│                                                     │
│  ┌─────────────────────────────────────────┐       │
│  │         Recall Memory                   │       │
│  │  - 最近对话历史                          │       │
│  │  - 可搜索                               │       │
│  └─────────────────────────────────────────┘       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**关键特性**：
- **Self-editing Memory**：Agent 通过工具调用自主编辑 Core Memory
- **Heartbeat 机制**：支持多步推理循环
- **Tool Rules**：限制工具调用模式

**Letta V1 新架构**（2026）：
- 废弃 heartbeat 和 send_message 工具
- 使用原生 reasoning tokens
- 支持 GPT-5、Claude 4.5 等新模型

**优点**：
- 透明的内存管理（可审计）
- 自主学习和更新人设
- 适合长文档分析

**缺点**：
- 依赖模型的工具调用能力
- 无结构化的观点演化
- 需要专门的 agent 架构

### 3.4 Zep 详解

**架构**：Session-based + Knowledge Graph

```python
# Zep Memory Block 结构
memory_block = {
    "session_id": "sess_001",
    "transcript": [...],  # 对话记录
    "facts": [...],       # 提取的事实
    "summary": "...",     # 自动摘要
    "metadata": {...}     # 自定义元数据
}
```

**特点**：
- 自动摘要保持上下文窗口精简
- 图增强的知识表示
- 低延迟 API

---

## 四、Retain 操作详解：到底存什么？

### 4.1 存储内容原则

**核心原则**：存储能在 6 个月后仍然有用的信息

**应该存储的**：
```
✅ 技术决策及其理由
✅ 架构模式和设计选择
✅ 性能指标和基准测试结果
✅ 代码审查反馈
✅ 用户偏好和习惯
✅ 项目背景和约束条件
✅ 关键人物和角色信息
✅ 时间线和里程碑
```

**不应该存储的**：
```
❌ 通用寒暄（"你好"、"谢谢"）
❌ 过程性闲聊（"让我检查一下"、"稍等"）
❌ 已经记录过的重复信息
❌ 临时性/一次性信息
❌ 敏感隐私数据（除非明确需要）
```

### 4.2 自定义提取指令

Hindsight 支持自定义提取规则：

```bash
# 设置为 custom 模式
export HINDSIGHT_API_RETAIN_EXTRACTION_MODE=custom

# 定义自定义指令
export HINDSIGHT_API_RETAIN_CUSTOM_INSTRUCTIONS="
ONLY extract facts that are:
✅ Technical decisions and their rationale
✅ Architecture patterns and design choices
✅ Performance metrics and benchmarks
✅ Code reviews and feedback
✅ User preferences and working styles

DO NOT extract:
❌ Generic greetings or pleasantries
❌ Process chatter ('let me check', 'one moment')
❌ Repeated information already captured

CONSOLIDATE related technical discussions into ONE fact when possible.
Ask yourself: 'Would this technical context be useful in 6 months?'
"
```

### 4.3 Narrative Fact 格式

**好的 Fact 示例**：

```json
{
  "content": "团队决定采用 Event Sourcing 模式重构订单系统，主要考虑是：1) 需要完整的审计追踪，2) 支持时间旅行查询，3) 与现有 Kafka 基础设施兼容。Alice 主导设计，预计 Q2 完成。",
  "temporal": {
    "decision_date": "2026-02-08",
    "target_completion": "2026-06"
  },
  "entities": ["Event Sourcing", "订单系统", "Kafka", "Alice"],
  "network": "world",
  "causal_links": [
    {
      "cause": "需要审计追踪、时间旅行、Kafka 兼容",
      "effect": "选择 Event Sourcing"
    }
  ]
}
```

**坏的 Fact 示例**：

```json
// ❌ 太碎片化
{"content": "用 Event Sourcing"}

// ❌ 缺少上下文
{"content": "Alice 说用那个模式"}

// ❌ 无时间信息
{"content": "订单系统要重构"}
```

### 4.4 实体消解策略

**问题**：同一实体可能有多种称呼

```
"Alice" = "Alice Chen" = "陈工" = "她" = "auth 模块负责人"
```

**Hindsight 的处理**：
1. 字符串相似度匹配
2. 共现分析（同一上下文出现）
3. 时间邻近性
4. LLM 辅助判断

**最佳实践**：
- 首次提及使用全名
- 建立别名映射
- 定期合并重复实体

---

## 五、最佳实践

### 5.1 LLM 分工策略（成本优化）

```python
HINDSIGHT_CONFIG = {
    # Retain: 需要大输出，选便宜模型
    "retain": {
        "provider": "zhipu",  # 或 groq
        "model": "glm-4.7-flash",
        "max_completion_tokens": 64000,
    },
    
    # Recall: 纯检索，不用 LLM
    "recall": {
        # 使用本地 embedding + cross-encoder
        # 几乎零成本
    },
    
    # Reflect: 需要高质量推理，选好模型
    "reflect": {
        "provider": "anthropic",
        "model": "claude-opus-4-5-20251101",
        "disposition": {
            "skepticism": 3,
            "literalism": 3,
            "empathy": 4,
            "bias_strength": 0.3,
        }
    },
    
    # Consolidation: 后台任务，选性价比
    "consolidation": {
        "provider": "openai",
        "model": "o3-mini",
    }
}
```

**成本估算（单次操作）**：

| 操作 | 便宜方案 | 高质量方案 |
|-----|---------|----------|
| Retain (长文档) | ~$0.05 (GLM-4.7) | ~$0.30 (GPT-4o) |
| Recall | ~$0 | ~$0 |
| Reflect | ~$0.02 (o3-mini) | ~$0.10 (Opus) |
| Consolidation | ~$0.01 | ~$0.05 |

### 5.2 Memory Bank 设计

**原则**：按认知边界划分，而非按功能模块

```python
# ✅ 好的设计
banks = {
    "cat-cafe-shared": {
        # 三只猫共享的团队记忆
        "mission": "Cat Café 多猫协作系统的集体智慧",
        "directives": [
            "保持技术决策的一致性",
            "记录跨猫协作的经验教训"
        ]
    },
    "ragdoll-personal": {
        # 布偶猫（宪宪/Claude）的个人记忆
        "mission": "架构设计和代码实现的专业知识",
        "disposition": {"skepticism": 3, "empathy": 4}
    },
    "maine-coon-personal": {
        # 缅因猫（GPT）的个人记忆
        "mission": "代码审查和质量保证的专业知识",
        "disposition": {"skepticism": 4, "literalism": 4}
    },
    "bengal-personal": {
        # 孟加拉猫（Gemini）的个人记忆
        "mission": "视觉设计和创意brainstorm的专业知识",
        "disposition": {"empathy": 5, "skepticism": 2}
    }
}
```

### 5.3 检索优化

**配置建议**：

```python
recall_config = {
    # 使用默认的 link_expansion 策略
    "graph_strategy": "link_expansion",
    
    # Token budget 根据上下文窗口设置
    "token_budget": 4000,  # 留足空间给其他内容
    
    # 启用 cross-encoder reranking
    "rerank": True,
    
    # 时间衰减（可选）
    "temporal_decay": {
        "enabled": True,
        "half_life_days": 30  # 30 天后相关性减半
    }
}
```

### 5.4 Consolidation 触发策略

```python
consolidation_triggers = {
    # 基于数量
    "fact_count_threshold": 50,  # 每 50 个新 fact 触发一次
    
    # 基于时间
    "time_interval_hours": 24,   # 每 24 小时触发一次
    
    # 基于实体
    "entity_update_threshold": 10,  # 某实体更新 10 次后触发
    
    # 手动触发 API
    # POST /v1/{tenant}/banks/{bank_id}/consolidate
}
```

### 5.5 避免常见陷阱

| 陷阱 | 解决方案 |
|-----|---------|
| 记忆爆炸 | 设置提取过滤规则，定期清理低价值记忆 |
| 实体漂移 | 使用规范名称，定期合并重复实体 |
| 观点僵化 | 设置合理的 bias_strength，允许观点被证伪 |
| 上下文溢出 | 严格控制 token budget，分层检索 |
| 隐私泄露 | 敏感信息加密或不存储 |

---

## 六、Cat Café 集成建议

### 6.1 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cat Café + Hindsight 架构                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐     │
│   │                  Shared Memory Bank                   │     │
│   │            (cat-cafe-collective)                      │     │
│   │                                                       │     │
│   │  - 团队技术决策                                        │     │
│   │  - 项目架构文档                                        │     │
│   │  - 跨猫协作记录                                        │     │
│   └───────────────────────┬──────────────────────────────┘     │
│                           │                                     │
│           ┌───────────────┼───────────────┐                    │
│           │               │               │                    │
│           ▼               ▼               ▼                    │
│   ┌───────────┐   ┌───────────┐   ┌───────────┐               │
│   │  布偶猫    │   │  缅因猫    │   │  孟加拉猫  │               │
│   │  (宪宪)   │   │  (GPT-5)  │   │ (Gemini)  │               │
│   │           │   │           │   │           │               │
│   │ Personal  │   │ Personal  │   │ Personal  │               │
│   │  Memory   │   │  Memory   │   │  Memory   │               │
│   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘               │
│         │               │               │                      │
│         └───────────────┴───────────────┘                      │
│                         │                                       │
│                         ▼                                       │
│              ┌─────────────────────┐                           │
│              │   Hindsight API     │                           │
│              │   (PostgreSQL +     │                           │
│              │    pgvector)        │                           │
│              └─────────────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 记忆流转示例

**场景**：布偶猫写代码，缅因猫 Review，形成团队记忆

```python
# Step 1: 布偶猫完成代码
ragdoll_action = """
我完成了 auth 模块的 OAuth2.0 集成，主要改动：
1. 添加了 TokenManager 类处理令牌刷新
2. 实现了 PKCE 流程增强安全性
3. 添加了单元测试覆盖率 85%
"""

# Step 2: 存入布偶猫个人记忆
hindsight.retain(
    bank_id="ragdoll-personal",
    content=ragdoll_action,
    context="auth 模块开发"
)

# Step 3: 缅因猫 Review
maine_coon_review = """
Review auth 模块：
- TokenManager 的错误处理需要增强，建议添加 retry 机制
- PKCE 实现正确，但建议使用 S256 而非 plain
- 测试用例缺少边界条件测试

总体评价：可以合并，但建议在 v1.1 修复上述问题
"""

# Step 4: 存入缅因猫个人记忆 + 共享记忆
hindsight.retain(
    bank_id="maine-coon-personal",
    content=maine_coon_review,
    context="auth 模块 code review"
)

# 关键决策同步到共享记忆
hindsight.retain(
    bank_id="cat-cafe-collective",
    content=f"""
    [技术决策记录]
    模块：auth (OAuth2.0 集成)
    开发：布偶猫
    审查：缅因猫
    决策：采用 PKCE 流程，使用 S256 算法
    待办：v1.1 增加 retry 机制和边界测试
    日期：2026-02-09
    """,
    context="团队技术决策"
)

# Step 5: 后续检索
# 任何猫都可以查询共享记忆
related_decisions = hindsight.recall(
    bank_id="cat-cafe-collective",
    query="auth 模块的设计决策"
)
```

### 6.3 Disposition 配置建议

```python
CAT_DISPOSITIONS = {
    "ragdoll": {  # 布偶猫 - 架构师
        "skepticism": 3,      # 适度怀疑
        "literalism": 2,      # 更多理解隐含意图
        "empathy": 4,         # 高共情
        "bias_strength": 0.3  # 允许形成技术偏好
    },
    "maine_coon": {  # 缅因猫 - 审查员
        "skepticism": 4,      # 高怀疑（找 bug）
        "literalism": 4,      # 严格按规范
        "empathy": 3,         # 适度共情
        "bias_strength": 0.2  # 保持客观
    },
    "bengal": {  # 孟加拉猫 - 设计师
        "skepticism": 2,      # 更开放
        "literalism": 2,      # 理解创意意图
        "empathy": 5,         # 高共情
        "bias_strength": 0.4  # 允许有美学偏好
    }
}
```

---

## 七、总结

### 7.1 核心要点

1. **记忆是认知基底**：不是 RAG 的附属品，而是 Agent 智能的核心
2. **四网络分离**：区分事实、经历、观察、信念，支持可解释推理
3. **Narrative Facts**：存储叙事性事实而非碎片，保留上下文
4. **多路检索**：语义 + 关键词 + 图 + 时间，全面覆盖
5. **Disposition 个性化**：同一事实，不同性格的 Agent 可形成不同观点
6. **成本优化**：不同操作用不同模型，平衡质量和成本

### 7.2 推荐阅读

- [Hindsight 论文](https://arxiv.org/abs/2512.12818) - 原始学术论文
- [Hindsight GitHub](https://github.com/vectorize-io/hindsight) - 开源代码
- [Hindsight 文档](https://hindsight.vectorize.io/) - 官方文档
- [Mem0 论文](https://arxiv.org/abs/2504.19413) - 对比参考
- [MemGPT 论文](https://arxiv.org/abs/2310.08560) - OS 式架构参考

---

> 🐱 宪宪注：这份报告是给 Cat Café 其他猫猫参考的技术文档。
> 如果 4.6 Opus 猫猫有问题，可以随时问我！
> 
> 愿我们三只猫的记忆永远清晰，协作永远顺畅！ 🐱🐱🐱
