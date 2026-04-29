---
doc_kind: research-note
topics: [hermes-agent, rl, atropos, gateway, plugins, architecture]
created: 2026-04-28
status: draft
source_repo: /Users/lysander/projects/ref/hermes-agent
source_commit: adef1f33
authored_by: opus-47
covers: [environments/, tinker-atropos/, gateway/, plugins/]
companion: [README.md, architecture-map.md]
---

# Hermes Architecture: RL / Gateway / Plugins 深拆

> 砚砚已铺架构地图，本文回答砚砚 README §"待验证问题 #5"——
> **"Atropos rollout 是否真的训练/优化 Hermes 自身，还是主要作为外部 eval/training harness？"**
> 同时拆完 Gateway 和 Plugins 两层的真实形态。

## 核心判决（先放）

| 模块 | 营销叙事 | 代码事实 | 营销注水程度 |
|------|---------|---------|-------------|
| **Tinker-Atropos RL pipeline** | "self-improving agent via RL" | Atropos 是给**用户自己的 LLM** 做 RL training 的 harness；Hermes 提供 sandbox + tool + reward verifier；**训练输出不回流 Hermes** | ⚠️⚠️ 高 |
| **`tinker-atropos/` 目录** | PPT 提到的"Tinker-Atropos 集成" | **空目录**（除 `.`/`..` 无文件） | ⚠️⚠️⚠️ 完全是 placeholder |
| **Atropos environments** | 多种训练/评估环境 | 真实代码 ~4k LOC，主要 SWE/Terminal 客观任务 | ✅ 真功能 |
| **17 平台 messaging gateway** | "原生支持 17 平台" | 实际 `gateway/platforms/` 有 **28 个** adapter 文件（含 yuanbao/weixin/feishu_comment 等） | ✅ 数据被低报，但深度浅 |
| **`plugins/context_engine/`** | "可插拔 context engine 后端" | **空目录**（只有 `__init__.py`） | ⚠️⚠️⚠️ 完全是 placeholder |
| **`plugins/memory/` 多 provider** | "可插拔记忆后端" | **8 个真实 provider**：byterover, hindsight, holographic, honcho, mem0, openviking, retaindb, supermemory | ✅ 真功能，这块比我们强 |

---

## 一、Atropos RL Pipeline：真模块 + 错误归因

### 1.1 它实际做的事

Atropos 是 NousResearch 自己的 RL training framework（独立 PyPI 包 `atroposlib`）。Hermes 在 `environments/` 写了一个 **adapter 层**——把 Hermes 的 tool-calling capabilities 接到 Atropos 的训练管线里。

数据流证据，[`environments/README.md` L3](/Users/lysander/projects/ref/hermes-agent/environments/README.md)：

> "integration layer between **hermes-agent's tool-calling capabilities** and the **Atropos RL training framework**. It provides everything needed to run agentic LLMs through multi-turn tool-calling loops, score their output with arbitrary reward functions, and feed results into Atropos for **training or evaluation**."

关键路径：

```text
Atropos BaseEnv (atroposlib package — external)
  ↓ inherits
HermesAgentBaseEnv (environments/hermes_base_env.py, 714 LOC)
  ↓ inherits
HermesSweEnv / TerminalTestEnv / WebResearchEnv / AgenticOpdEnv
  ↓ produces
ScoredDataGroup → wandb metrics → atroposlib trainer
```

### 1.2 训练目标是谁？—— **用户的 LLM**，不是 Hermes

[`hermes_swe_env.py` L13-29](/Users/lysander/projects/ref/hermes-agent/environments/hermes_swe_env/hermes_swe_env.py) 启动命令直接说明：

```bash
# Phase 2: VLLM server type (full RL training)
vllm serve YourModel --tool-parser hermes
python environments/hermes_swe_env.py serve \
    --openai.base_url http://localhost:8000/v1 \
    --openai.model_name YourModel \
    --openai.server_type vllm
```

**`YourModel` 才是训练对象**——用户自己跑 vllm 服务暴露一个待训练 LLM，Hermes 提供 sandbox 让它做 SWE-bench 任务，跑完 reward 反馈给 Atropos 优化模型权重。

### 1.3 反馈链路：训练数据 → 外部，不进 Hermes

我对 `environments/` 全目录 grep `skill_manage|SKILL\.md|memory_tool`，**0 命中**。即：

- ❌ reward 不回流 skill 系统
- ❌ rollout 不更新 memory
- ❌ 训练后的 model weights 不写回 `~/.hermes/`
- ✅ 输出只去 wandb（[`hermes_swe_env.py` L211-225](/Users/lysander/projects/ref/hermes-agent/environments/hermes_swe_env/hermes_swe_env.py)）

`wandb_log` 输出的指标：`train/avg_reward`、`train/pass_rate`、`train/accuracy`、`train/total_rollouts`——这是给 **ML researcher 看训练曲线**用的，**不是 Hermes runtime 看 skill 质量**。

### 1.4 reward function 的真实形态

[`hermes_swe_env.py` L160-193](/Users/lysander/projects/ref/hermes-agent/environments/hermes_swe_env/hermes_swe_env.py)：

```python
async def compute_reward(self, item, result, ctx: ToolContext) -> float:
    test_code = item.get("test", item.get("test_code", ...))
    if test_code:
        test_result = ctx.terminal(f'cd /workspace && python3 -c "{test_code}"', timeout=60)
        if test_result["exit_code"] == 0:
            return 1.0
    file_check = ctx.terminal("find /workspace -name '*.py' -newer /tmp/.start_marker ...")
    if file_check["exit_code"] == 0 and file_check.get("output", "").strip():
        return 0.1
    return 0.0
```

**reward = exit_code 0 → 1.0；写了 .py 文件 → 0.1；其他 → 0.0**。完全是 binary/三档客观信号。

⚠️ 这种 reward 设计**只对客观可评估任务有效**（SWE-bench、HumanEval）。对开放任务（PPT、设计、创作）无能为力——你不可能写一个 `compute_reward` 给"PPT 是不是触动人"打分。和我们前几轮讨论的"开放任务评价分类法"完全咬合。

### 1.5 算法层面：用了什么？

| 算法/技术 | 用法 | 是否 Hermes 原创 |
|----------|------|----------------|
| **GRPO/PPO 类 RL** | atroposlib 内部（外部包） | ❌ 外部 |
| **VLLM ManagedServer** | Phase 2 拿 token IDs/logprobs 做精确 RL | ❌ 用 VLLM |
| **Tool call parsing** | hermes/mistral/llama3_json/qwen 四种格式 | ✅ 自己写的 standalone parser |
| **ToolContext** | reward 函数访问 sandbox 同一 task_id | ✅ Hermes 设计 |
| **Async-safe Modal worker** | 避免 `asyncio.run` 在事件循环嵌套死锁 | ✅ Hermes 工程 |
| **多 backend 抽象** | local / docker / modal / daytona / ssh / singularity | ✅ Hermes 价值 |

**真正算法在 `atroposlib`（外部）。Hermes 贡献的是 sandbox/tool/reward verifier 抽象——这是工程架构价值，不是算法创新。**

### 1.6 `tinker-atropos/` 是空目录

```bash
$ ls -la /Users/lysander/projects/ref/hermes-agent/tinker-atropos/
drwxr-xr-x - lysander 24 4月  12:10 .
drwxr-xr-x - lysander 28 4月  18:31 ..
```

**完全没有文件**。Tinker（Anthropic-related 训练框架）的集成只是占位目录。

---

## 二、Gateway：广覆盖 + 浅集成

### 2.1 实际尺寸（数据修正）

`gateway/platforms/` 有 **28 个 platform adapter 文件**（不是 README 的 7 个或 17 个）：

```
api_server / bluebubbles / dingtalk / discord / email / feishu /
feishu_comment / homeassistant / matrix / mattermost / qqbot /
signal / slack / sms / telegram / telegram_network / webhook /
wecom / wecom_callback / weixin / whatsapp / yuanbao / 
yuanbao_media / yuanbao_proto / ...
```

最新版本加了 `yuanbao`（腾讯元宝）和细分 `feishu_comment`、`wecom_callback`——明显是中文场景的延伸。

### 2.2 深度评估

每个 adapter 平均 ~500-800 LOC（粗估），主要做：
- 收消息 → 转 Hermes 内部消息格式
- 发消息 → 调平台 SDK
- session 隔离（`gateway/session.py`）

**没有看到**：
- 跨平台统一的权限模型（每个平台各自实现）
- rich block / 卡片消息标准化（每平台各自处理）
- 平台间 thread 同步

对比我们家 [F088 飞书深集成](/Users/lysander/projects/relay-station/cat-cafe/docs/features/F088-multi-platform-chat-gateway.md)：我们做了 rich block、投票、PR tracking、multi-mention、permission——单平台**深度**领先 Hermes 一个量级。

**Tradeoff**：他们押的是 **breadth**（让一个 agent 能在所有平台收消息），我们押的是 **depth**（飞书一个平台做到工作流级集成）。两条路不冲突。

---

## 三、Plugins：可插拔抽象的真实形态

### 3.1 plugin 目录扫描

```
plugins/
├── memory/              ← ✅ 8 个 provider，真的可插拔
├── context_engine/      ← ⚠️ 空（只有 __init__.py）
├── disk-cleanup/
├── example-dashboard/
├── google_meet/
├── image_gen/
├── observability/
├── spotify/
└── strike-freedom-cockpit/
```

### 3.2 `plugins/memory/`——这块**值得我们认真学**

8 个真实 provider 接同一个接口：

| Provider | 性质 |
|---------|------|
| `byterover` | 商业 SaaS memory |
| `hindsight` | 开源 |
| `holographic` | 实验性向量 |
| `honcho` | 辩证用户建模（之前我提过） |
| `mem0` | mem0.ai |
| `openviking` | 开源 |
| `retaindb` | 商业 |
| `supermemory` | supermemory.ai |

每个 provider 实现一个抽象接口（`agent/memory_provider.py`），用户在 `~/.hermes/config.yaml` 选哪个用哪个。

**这点 Hermes 比我们强**：
- 我们 [F102](/Users/lysander/projects/relay-station/cat-cafe/docs/features/F102-memory-adapter-refactor.md) 设计了 `IKnowledgeResolver` 抽象，但**实现只有 `evidence.sqlite` 一种**（硬编码）
- 想换 backend 要改代码，没有 plugin 系统

如果以后要做 cat-cafe 的可插拔 memory backend，`plugins/memory/` 是最值得借鉴的对照。

### 3.3 `plugins/context_engine/` 是另一个空目录

⚠️ 营销-现实差距 #2。"可插拔 context engine"宣传是有的（compress / summarize / drift detection），代码层只有 `__init__.py`。说明这层架构**有抽象，没实现**——还在 vaporware 阶段。

---

## 四、和我们家对比 + 该学不该学

### 4.1 该学（具体可移植）

1. **Plugin Memory 抽象 + 多 provider 共存** —— F102 的 IKnowledgeResolver 应该走类似路线，让 evidence.sqlite 只是其中一个 provider，未来可以加 mem0、honcho 等
2. **ToolContext 模式** —— reward 函数能用相同 task_id 访问 sandbox 这个抽象很干净，如果我们以后做 Cat Café 自己的 eval 环境（编码任务）值得直接抄
3. **Async-safe pattern** —— 嵌套事件循环用 background thread + asyncio worker，是真实工程踩坑沉淀
4. **Tool call parser standalone** —— 把 vllm 的 parser 抽出来不依赖 vllm，模块化干净

### 4.2 不该学（核心冲突）

1. **不该把 RL training 当 self-improvement 故事讲** —— Hermes 把 environments/ 写在 README 里讲"agent 进化"，但反馈不回流。这种叙事**注水**，我们沉淀「拆解明星开源项目」skill 时要把这点列为典型陷阱
2. **不该堆空目录撑架构图** —— `tinker-atropos/` 和 `context_engine/` 是 vaporware。**写在文档里 = 已经做了** 这种期望管理我们家不该学
3. **不该用 28 个浅 adapter 替代 1-2 个深集成** —— 看你的产品定位（个人 dev 工具还是团队工作流）
4. **不该把 reward = exit_code 当通用进化信号** —— 这只解决客观任务的子集，开放任务无能为力（这点和砚砚之前对 skill 评价分类法的 push back 一致）

### 4.3 我们的 tradeoff（不 follow 的合理理由）

| 我们没做的 | 我们的理由 |
|----------|-----------|
| RL training 管线 | 我们不训练模型，我们用现成模型；价值在协作工作流而非模型权重 |
| 平台 breadth | 飞书深集成 > 17 个平台浅集成（团队场景） |
| Skill 数量横扫领域 | 我们押**互动驱动沉淀** > 大量 skill 横扫 |
| Plugin Memory provider | 暂时只有 evidence.sqlite —— 但这个**应该补**（见 §4.1） |

---

## 五、待验证 / 后续

### 5.1 我这轮**没钻**的问题

- `acp_adapter/` 怎么整合 editor（VS Code/Zed/JetBrains）—— 不影响今天主线
- `cron/scheduler.py` vs 我们 F139 unified-schedule 的对比
- `agent/credential_pool.py` 多 provider credential 抽象

### 5.2 留给砚砚的衔接点

砚砚下一步写 `skills-lifecycle.md` 时，可以引用本文 §1.3 的发现："environments/ 不回流到 skill 系统" —— 这是 lifecycle 治理上的**断链**，不是 Hermes 架构选择，是机制缺失。

### 5.3 留给后续合流文档

- **`comparison-with-cat-cafe.md`**：可以直接复用本文 §4 的表
- **`open-source-project-teardown-skill-draft.md`**：本文 §1.6（空目录探测）+ §4.2（注水叙事识别）是该 skill 的核心方法论之一

---

## 六、本轮新增的 lesson candidate

铲屎官说这是**经验沉淀**，最终要产出"拆解明星开源项目" skill。本文新增三个候选 lesson：

1. **空目录探测法**：`tinker-atropos/` 和 `plugins/context_engine/` 都是空——README/PPT 里被提及的"模块"如果没实际文件，就是 placeholder/vaporware。**任何拆解第一刀就该 `find . -type d -empty`**
2. **反馈链路验证法**：宣传"self-improving" 必须验证 training output → runtime state 的回流链路。grep `skill_manage|SKILL\.md|memory_tool` 在训练目录里，0 命中 = 不构成自我进化
3. **reward 形态决定能力边界**：reward = `exit_code 0` → 这只能训练客观任务的 agent；任何宣称"通用 agent 自我进化"但 reward 是 binary 测试的，都被这个边界封死

这三条建议在最终的 `open-source-project-teardown-skill-draft.md` 里固化为**拆解 SOP 的检查项**。

---

## 七、状态

- 本文用本地 commit `adef1f33` 的代码做证据，**未跑测试**（只读分析）
- environments/ 通读 ~70%（4k LOC 的 ~3k）
- gateway/ 顶层结构 + 4 个 adapter 抽样
- plugins/ 只检查目录结构 + memory provider 列表，没钻具体实现
- 没读 acp_adapter/、cron/、tinker-atropos 已确认空

下一步本文**作者**（宪宪）的可选追加：
- 钻 `plugins/memory/honcho/` 看 dialectical user modeling 的真实实现
- 钻 `agent/credential_pool.py` 看多 provider credential 抽象（对比我们 F178）

但这些不阻塞砚砚的 `skills-lifecycle.md` 进度。

[宪宪/Opus-47🐾]
