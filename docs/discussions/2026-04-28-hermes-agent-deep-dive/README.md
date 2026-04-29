---
doc_kind: discussion
topics: [hermes-agent, skills, open-source-teardown, agent-runtime]
created: 2026-04-28
status: draft
source_repo: /Users/lysander/projects/ref/hermes-agent
source_commit: adef1f33
---

# Hermes Agent 深度拆解

**目标**：把 Hermes Agent 当作一个明星开源 agent runtime 拆开看，区分营销叙事、真实能力、工程取舍和我们可学习的部分。

这不是一次性结论文档。先建立证据目录和拆解协议，再分模块补齐代码证据。

## 当前源码快照

- 仓库：`/Users/lysander/projects/ref/hermes-agent`
- 远端：`https://github.com/NousResearch/hermes-agent.git`
- 当前 commit：`adef1f33 2026-04-28 18:28:49 -0700 chore(release): map scott@scotttrinh.com -> scotttrinh (#17203)`
- Python 规模：`1241` 个 `.py` 文件，约 `595124` 行 Python。
- Built-in skills：`83` 个 `SKILL.md`
- Optional skills：`58` 个 `SKILL.md`

上一轮本地快照已经落后 `694` commits；本轮已 fast-forward 到 `origin/main`。

## 拆解协议

每个明星特性按同一模板分析，避免被 README 或 PPT 牵着走：

1. **它宣称什么**：官方 README / docs / PPT 语言。
2. **代码入口在哪**：文件、函数、数据流。
3. **真实机制是什么**：硬机制、软 prompt、手动流程、外部服务分别标清。
4. **有没有算法**：如果有，说明输入、输出、优化目标、反馈信号；如果只是规则/启发式/prompt，要直说。
5. **和我们家对比**：Cat Cafe 已有能力、缺口、设计取舍。
6. **能学什么**：可移植机制。
7. **不学什么**：因为质量、治理、架构哲学或 tradeoff 不跟。

## 第一轮明星特性清单

| 特性 | 当前判断 | 代码入口 | 下一步 |
|------|----------|----------|--------|
| Skills progressive disclosure | 真功能，工程上成熟度较高 | `tools/skills_tool.py` | 细看 list/view、预算、外部目录、动态 context |
| Agent-managed skills | 真功能，但质量判定主要靠 background review agent + prompt | `run_agent.py`, `tools/skill_manager_tool.py` | 细看触发阈值、review prompt、CRUD、测试 |
| Skills Hub / 社区 skill 市场 | 真功能，多源聚合 + trust + quarantine + hash update | `tools/skills_hub.py`, `tools/skills_guard.py` | 细看 source router、安全扫描、版本更新 |
| Tinker/Atropos RL pipeline | 真模块，不等于 skill 自我进化闭环 | `environments/`, `tinker-atropos/` | 拆 reward、rollout、tool context、token/logprob 流 |
| Messaging gateway | 真功能，覆盖面明显强 | `gateway/platforms/` | 拆 session、platform adapter、threading/ack/权限 |
| Provider/profile/fallback | 真功能，产品化强 | `hermes_cli/`, `agent/transports/` | 拆 provider routing、credential pool、fallback |
| Plugins/dashboard | 最新代码新增不少能力 | `plugins/`, `web/`, `ui-tui/` | 判断是否是 runtime 插件化还是产品包装 |

## 第一轮已证实事实

### 1. Skills 目录不是只有 coding

更新后内置 skills 覆盖 `creative`、`productivity`、`research`、`social-media`、`mlops`、`github`、`software-development` 等目录。当前内置 `83` 个 `SKILL.md`，optional `58` 个。也就是说，它确实在向“通用 agent skill 包”扩展，不只是 coding sidecar。

但这只能证明**领域覆盖广**，不能证明每个领域都有稳定质量闭环。质量需要看 review、激活、评估和淘汰机制。

### 2. Skill progressive disclosure 是真机制

`tools/skills_tool.py` 明确把 skill 分成：

- `skills_list`：只返回 name / description / category；
- `skill_view(name)`：加载 `SKILL.md` 正文；
- `skill_view(name, path)`：加载 references/templates/scripts 等附属文件。

这是我们可以学的工程模式：metadata 先行，正文按需，附属文件再按需。

### 3. Self-improving skills 更像“后台 review + 软门禁”，不是完整算法系统

`run_agent.py` 里有 background review agent。触发路径是：

- `_skill_nudge_interval` 默认 `10`；
- 每轮工具调用累加 `_iters_since_skill`；
- 达到阈值后，最终响应之后异步启动 `_spawn_background_review(..., review_skills=True)`；
- review agent 只启用 `["memory", "skills"]` toolset；
- prompt 要求先 `skills_list`，再必要时 `skill_view`，优先 patch 现有 skill，只有无覆盖时才 create。

这比“一句 prompt”厚，但它仍然不是严格算法：没有看到 A/B、成功率优化、自动回滚、客观 reward 驱动的 skill 晋升。

### 4. Skills Hub 的“更新”目前是版本/内容 hash，不是老化算法

`tools/skills_hub.py` 通过 `content_hash` 与上游 bundle hash 对比，返回 `up_to_date` / `update_available`。这是包管理意义上的更新，不是“skill 过期/失效/质量下降”的算法判定。

### 5. 安全扫描是真功能，但属于静态启发式

`tools/skills_guard.py` 有 trust level 和 install policy：

- `builtin`
- `trusted`
- `community`
- `agent-created`

扫描包含结构检查、regex pattern、不可见 unicode。社区来源遇到 `caution` / `dangerous` 会被 block。这个适合我们未来开放外部 skill 时借鉴，但它不是语义安全证明。

### 6. Tinker/Atropos 是 RL 环境管线，不要和 skill 质量闭环混淆

`environments/README.md` 描述的是 Hermes tool-calling 能力和 Atropos RL training framework 的集成：rollout、tool execution、reward function、VLLM ManagedServer、tool call parser、token/logprob 流。

这块很重要，确实涉及算法和训练管线；但第一眼看，它服务的是 agent 行为训练/评估环境，不是“每个 skill 自动判断自己越改越好”的直接机制。

## 和我们家第一轮对比

| 维度 | Hermes Agent | Cat Cafe |
|------|--------------|----------|
| Skill 目录规模 | 内置 + optional 很多，领域广 | 内置领域 skill 包偏少，但治理更重 |
| Skill 加载 | progressive disclosure 已成体系 | 目前更多依赖 host/harness，缺 runtime 级动态 discovery |
| Skill 生成 | background review agent 可自动提议 create/patch | 更偏互动驱动候选 + review 后固化 |
| 质量门禁 | prompt 约束 + 静态安全扫描 + 手动/配置禁用 | 多主体 review、CVO 判断、docs 真相源、Knowledge Feed |
| 过期/淘汰 | 已见 hash update；未见质量老化算法 | 我们也缺显式 stale workflow，F163/F102/F152 可承接 |
| 外部生态 | Skills Hub 多源聚合更强 | 暂无外部 skill marketplace |
| RL/评估 | Atropos 环境是真模块 | 我们更多是任务验证/CI/回放，还没有同类训练环境 |

## 我们能学

1. **内置领域 skill 包**：creative/productivity/research/social-media 这种横向覆盖值得借鉴，但必须有 review/激活状态。
2. **Progressive disclosure**：skill metadata、正文、附属文件三级加载是可直接学习的。
3. **Skill Hub 安装链路**：source router、quarantine、trust level、audit log、hash update 可以作为外部 skill intake 参考。
4. **Background review UX**：任务结束后异步提议沉淀，用户不必手动喊“记下来”。但要接入我们家的候选队列，而不是直接 active。
5. **Atropos 环境抽象**：如果我们未来做 agent eval/training，`ToolContext + reward function + rollout sandbox` 是值得拆的。

## 我们不学

1. **不学单 agent 自评自改直达 active**：开放任务质量不能只靠同一个模型判断。
2. **不学平面 skill 真相源**：我们仍然要保留 thread/docs/provenance/review 的分层。
3. **不学“hash update = stale”混用**：上游更新和知识失效是两类问题。
4. **不学大单体主循环**：`run_agent.py` 仍是超大核心类，扩展性和可审计性要谨慎看。
5. **不把 RL pipeline 当作 skill 质量证明**：除非能追到 reward 直接反馈 skill 选择/生成，否则不能用来支撑“skill 会自动变好”。

## 下一步分工建议

### 砚砚继续

- 细读 `tools/skills_tool.py`
- 细读 `tools/skill_manager_tool.py`
- 细读 `run_agent.py` background review 触发和测试
- 输出 `skills-lifecycle.md`

### 宪宪继续

- 细读 `environments/` + `tinker-atropos/`
- 细读 `gateway/` + `plugins/`
- 输出 `architecture-and-rl.md`

### 最终合流

- `comparison-with-cat-cafe.md`
- `open-source-project-teardown-skill-draft.md`

## 收敛检查

1. 否决理由 → ADR？没有，本轮是研究入口，不是架构决策。
2. 踩坑教训 → lessons-learned？暂时没有，后续若确认“明星项目拆解 SOP”成立再沉淀。
3. 操作规则 → 指引文件？暂时没有，最终合流时再判断是否产出新 skill。

