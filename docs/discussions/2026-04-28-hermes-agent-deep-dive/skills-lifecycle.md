---
doc_kind: research-note
topics: [hermes-agent, skills, lifecycle, self-improvement]
created: 2026-04-28
status: draft
source_repo: /Users/lysander/projects/ref/hermes-agent
source_commit: adef1f33
authored_by: codex
covers: [tools/skills_tool.py, tools/skill_manager_tool.py, tools/skills_hub.py, tools/skills_guard.py, agent/prompt_builder.py, run_agent.py]
companion: [README.md, architecture-map.md, architecture-and-rl.md]
---

# Hermes Skills Lifecycle 深拆

本文回答一个窄问题：Hermes 的 "self-improving skills" 到底是怎样的生命周期？哪些是硬机制，哪些是 prompt 软约束，哪些只是市场/更新/安全工程，不是质量进化。

## 核心判决

| 环节 | 代码事实 | 判决 |
|------|----------|------|
| Skill 来源 | bundled `skills/` sync 到 `~/.hermes/skills/`，Hub/agent-created/external dirs 也进入发现面 | 真机制 |
| Skill 发现 | system prompt 构建完整 skill index；`skills_list` 也可按需列 metadata | 真机制，但不是 search-first lazy loading |
| Skill 加载 | `skill_view` 加载正文和 linked files；slash command 会把 skill body 注入用户消息 | 真 progressive disclosure |
| Skill 创建/修改 | `skill_manage` 支持 create/edit/patch/delete/write_file/remove_file | 真 CRUD |
| 触发沉淀 | 主 prompt + background review agent；默认 10 次 tool iteration 后触发 review | 有自动触发，但判断靠 LLM |
| 安全门禁 | Hub 安装必扫；agent-created 默认不扫，需 `skills.guard_agent_created=true` | 外部安全链路较真，agent-created 偏宽 |
| 更新 | bundled sync 用 origin hash；Hub 用 content hash 对比 | 版本更新，不是质量老化 |
| 使用统计 | `insights.py` 统计 loads/edits/last_used | 只读分析，不回流排序/淘汰 |
| 过期/淘汰 | disabled 手动配置；未见自动 stale/retire/eval | 缺口 |

一句话：**Hermes 的 skill 生命周期是“可自动触发的 CRUD + progressive disclosure + marketplace 安装链”，不是完整的“质量可证明自我进化系统”。**

## 一、生命周期总图

```text
bundled skills/ ── sync_skills() ─┐
                                  │
Hub / optional / URL install ─────┼──> ~/.hermes/skills/  <── skill_manage(create/patch/edit/delete)
                                  │          │
external_dirs (read-only) ────────┘          │
                                             ▼
                         prompt_builder.build_skills_prompt()
                         skills_list()
                         slash command scan
                                             │
                                             ▼
                         skill_view(name[, file_path])
                         skill command invocation
                                             │
                                             ▼
                         agent uses skill during task
                                             │
                                             ▼
                         run_agent counts tool iterations
                         background review agent may patch/create
```

这条链路的状态突变点只有三个：

1. `sync_skills()` / Hub install 把外部内容写入 `~/.hermes/skills/`；
2. `skill_manage` 修改 `~/.hermes/skills/`；
3. 用户配置禁用、外部目录、平台条件改变发现面。

没有发现一条 `eval result -> promote/demote skill` 或 `Atropos reward -> patch skill` 的状态突变链。

## 二、来源与同步：`~/.hermes/skills/` 是主真相源

Hermes 把运行时 skill 真相源放在 `~/.hermes/skills/`，不是 repo 内 `skills/`。repo 内 built-in skills 通过 manifest-based sync 复制过去。

`tools/skills_sync.py` 的策略：

- 新 bundled skill：复制到用户目录并记录 origin hash；
- 用户副本等于旧 origin hash 且 bundled hash 变了：安全更新；
- 用户副本不等于 origin hash：认为用户改过，跳过；
- 用户删掉的 bundled skill：尊重删除，不重新加回；
- bundled 被移除：清 manifest。

证据入口：

- [`tools/skills_sync.py` L3-L21](/Users/lysander/projects/ref/hermes-agent/tools/skills_sync.py:3)
- [`tools/skills_sync.py` L177-L318](/Users/lysander/projects/ref/hermes-agent/tools/skills_sync.py:177)

这套是合理的产品工程：保护用户改动，也允许 bundled skill 升级。但它仍然只是 **file sync policy**，不是质量治理。

## 三、发现与加载：真 progressive disclosure，但 metadata 仍前置

### 3.1 System prompt skill index

`agent/prompt_builder.py` 会生成 `## Skills (mandatory)` 区块，要求模型先扫描 skill index，匹配就必须 `skill_view(name)`。它还做了两层 cache：

- 进程内 LRU；
- `.skills_prompt_snapshot.json` 磁盘 snapshot，按 mtime/size manifest 校验。

这能优化启动扫描成本，但不是上下文层面的完全 lazy loading。skill metadata 仍会被组织成 prompt index。

证据入口：

- [`agent/prompt_builder.py` L660-L775](/Users/lysander/projects/ref/hermes-agent/agent/prompt_builder.py:660)
- [`agent/prompt_builder.py` L849-L865](/Users/lysander/projects/ref/hermes-agent/agent/prompt_builder.py:849)

### 3.2 `skills_list`

`skills_list` 返回 name / description / category。它扫描 local skills 和 external dirs，跳过 disabled、platform 不匹配、重复名，最后按 category/name 排序。

这说明它是目录式 discovery，不是基于使用效果、质量分、最近使用的 ranking。

证据入口：

- [`tools/skills_tool.py` L9-L12](/Users/lysander/projects/ref/hermes-agent/tools/skills_tool.py:9)
- [`tools/skills_tool.py` L546-L625](/Users/lysander/projects/ref/hermes-agent/tools/skills_tool.py:546)
- [`tools/skills_tool.py` L671-L728](/Users/lysander/projects/ref/hermes-agent/tools/skills_tool.py:671)

### 3.3 `skill_view`

`skill_view` 负责加载完整 `SKILL.md` 或 linked file，并处理：

- plugin-qualified skill：`namespace:skill`；
- platform mismatch；
- disabled skill；
- path traversal；
- prompt injection warning；
- references/templates/scripts/assets 逐文件加载。

证据入口：

- [`tools/skills_tool.py` L846-L930](/Users/lysander/projects/ref/hermes-agent/tools/skills_tool.py:846)
- [`tools/skills_tool.py` L1000-L1075](/Users/lysander/projects/ref/hermes-agent/tools/skills_tool.py:1000)
- [`tools/skills_tool.py` L1440-L1470](/Users/lysander/projects/ref/hermes-agent/tools/skills_tool.py:1440)

### 3.4 Slash command path

每个 skill 也会变成 slash command。`agent/skill_commands.py` 扫描 skills，构造 `/skill-name`，调用时 `skill_view(..., preprocess=False)`，然后把 skill body 格式化成一条消息。

证据入口：

- [`agent/skill_commands.py` L215-L277](/Users/lysander/projects/ref/hermes-agent/agent/skill_commands.py:215)
- [`agent/skill_commands.py` L306-L330](/Users/lysander/projects/ref/hermes-agent/agent/skill_commands.py:306)

这条路径说明 Hermes 的 skill 不只靠模型自然语言选择，也有显式 command invocation。

## 四、动态上下文：有，但默认安全边界要看配置

`agent/skill_preprocessing.py` 支持两种动态渲染：

- `${HERMES_SKILL_DIR}` / `${HERMES_SESSION_ID}` 模板变量；
- `!` + backtick inline shell，执行命令并把 stdout 写入 skill 内容。

inline shell 默认由 `skills.inline_shell` 控制，输出 capped at `4000` 字符，有 timeout，失败返回错误 marker。

证据入口：

- [`agent/skill_preprocessing.py` L10-L20](/Users/lysander/projects/ref/hermes-agent/agent/skill_preprocessing.py:10)
- [`agent/skill_preprocessing.py` L63-L90](/Users/lysander/projects/ref/hermes-agent/agent/skill_preprocessing.py:63)
- [`agent/skill_preprocessing.py` L115-L131](/Users/lysander/projects/ref/hermes-agent/agent/skill_preprocessing.py:115)

判断：

- 这是很实用的 **dynamic context injection**。
- 这不是学习算法，是确定性预处理。
- 如果我们学，必须默认关闭 shell 执行，并把命令白名单、输出预算、审计日志纳入设计。

## 五、创建与修改：`skill_manage` 是真实能力

`skill_manage` 声明 skill 是 procedural memory，支持：

- `create`
- `edit`
- `patch`
- `delete`
- `write_file`
- `remove_file`

核心约束：

- skill name max 64；
- description max 1024；
- `SKILL.md` max 100000 chars；
- supporting file max 1 MiB；
- supporting file 只能写到 `references/`、`templates/`、`scripts/`、`assets/`；
- external dirs read-only；
- patch 用 fuzzy matching；
- 写入失败/安全扫描失败会 rollback。

证据入口：

- [`tools/skill_manager_tool.py` L3-L20](/Users/lysander/projects/ref/hermes-agent/tools/skill_manager_tool.py:3)
- [`tools/skill_manager_tool.py` L111-L128](/Users/lysander/projects/ref/hermes-agent/tools/skill_manager_tool.py:111)
- [`tools/skill_manager_tool.py` L328-L382](/Users/lysander/projects/ref/hermes-agent/tools/skill_manager_tool.py:328)
- [`tools/skill_manager_tool.py` L421-L515](/Users/lysander/projects/ref/hermes-agent/tools/skill_manager_tool.py:421)
- [`tools/skill_manager_tool.py` L541-L593](/Users/lysander/projects/ref/hermes-agent/tools/skill_manager_tool.py:541)
- [`tools/skill_manager_tool.py` L711-L730](/Users/lysander/projects/ref/hermes-agent/tools/skill_manager_tool.py:711)

`skill_manage` 的 schema 直接写了创建条件：

- complex task succeeded (`5+` calls)；
- errors overcome；
- user-corrected approach worked；
- non-trivial workflow discovered；
- user asks to remember a procedure。

这解释了铲屎官之前质疑的点：**这些条件是 prompt/schema 级标准，不是可验证算法标准。** 模型负责判断“non-trivial workflow”，代码只提供写盘工具。

## 六、自动沉淀：比“一句 prompt”厚，但仍是 LLM 审查

Hermes 有两层沉淀触发。

### 6.1 主 system prompt 的软提醒

`SKILLS_GUIDANCE` 要求：

- 复杂任务、tricky error、non-trivial workflow 后保存 skill；
- 使用 skill 时发现 outdated/incomplete/wrong 就 patch。

证据入口：

- [`agent/prompt_builder.py` L176-L183](/Users/lysander/projects/ref/hermes-agent/agent/prompt_builder.py:176)

### 6.2 Background review agent

更关键的是 `run_agent.py` 的 background review：

- `_skill_nudge_interval` 默认 `10`；
- 每次 tool-calling iteration 后 `_iters_since_skill += 1`；
- 如果达到阈值，最终响应后触发 `_spawn_background_review(review_skills=True)`；
- review agent 继承当前 provider/model/credential/runtime；
- 只启用 `["memory", "skills"]`；
- prompt 要求先 survey existing skills，再 class-first，优先 patch，只有没有覆盖才 create。

证据入口：

- [`run_agent.py` L1750-L1755](/Users/lysander/projects/ref/hermes-agent/run_agent.py:1750)
- [`run_agent.py` L3232-L3255](/Users/lysander/projects/ref/hermes-agent/run_agent.py:3232)
- [`run_agent.py` L3341-L3419](/Users/lysander/projects/ref/hermes-agent/run_agent.py:3341)
- [`run_agent.py` L10344-L10348](/Users/lysander/projects/ref/hermes-agent/run_agent.py:10344)
- [`run_agent.py` L13319-L13344](/Users/lysander/projects/ref/hermes-agent/run_agent.py:13319)

测试覆盖也说明它踩过后台线程风险：

- background review 要先 shutdown memory provider 再 close；
- background review 安装 auto-deny approval callback，避免 daemon thread 触发 dangerous-command prompt 后死锁。

证据入口：

- [`tests/run_agent/test_background_review.py` L40-L73](/Users/lysander/projects/ref/hermes-agent/tests/run_agent/test_background_review.py:40)
- [`tests/run_agent/test_background_review.py` L76-L129](/Users/lysander/projects/ref/hermes-agent/tests/run_agent/test_background_review.py:76)

判断：

- 这比“模型在主任务里顺手记”强，因为它不和用户任务抢注意力。
- 但 background review 本质仍是同模型 fork 自评，不是 peer review / CVO review / eval ledger。
- 它会直接写 shared skill store；没有看到 candidate queue、review 后 active、diff approval。

## 七、Hub 与安全：强在 supply-chain 工程，不强在质量判断

### 7.1 多源 marketplace

`skills_hub.py` 定义 `SkillSource` 抽象，并提供多源 router：

- official optional skills；
- Hermes centralized index；
- skills.sh；
- well-known source；
- direct URL；
- GitHub taps；
- ClawHub；
- Claude Marketplace；
- LobeHub。

证据入口：

- [`tools/skills_hub.py` L252-L277](/Users/lysander/projects/ref/hermes-agent/tools/skills_hub.py:252)
- [`tools/skills_hub.py` L3088-L3111](/Users/lysander/projects/ref/hermes-agent/tools/skills_hub.py:3088)

搜索层有并行 source search、dedupe、trust rank。这是 marketplace 工程，不是 runtime skill 质量闭环。

证据入口：

- [`tools/skills_hub.py` L3125-L3225](/Users/lysander/projects/ref/hermes-agent/tools/skills_hub.py:3125)

### 7.2 Quarantine + scan + lock/audit

Hub 安装流程会：

1. bundle 写入 quarantine；
2. security scan；
3. 移入 `~/.hermes/skills`；
4. lock 记录 source/trust/verdict/content_hash/files/metadata；
5. audit log 追加 `INSTALL`。

证据入口：

- [`tools/skills_hub.py` L2693-L2778](/Users/lysander/projects/ref/hermes-agent/tools/skills_hub.py:2693)

### 7.3 Trust policy

`skills_guard.py` 的 hardcoded policy：

- builtin：safe/caution/dangerous 都 allow；
- trusted：dangerous block；
- community：caution/dangerous block；
- agent-created：dangerous ask，但只有 `skills.guard_agent_created` 开启才跑。

扫描包括结构检查、regex pattern、不可见 unicode。

证据入口：

- [`tools/skills_guard.py` L3-L15](/Users/lysander/projects/ref/hermes-agent/tools/skills_guard.py:3)
- [`tools/skills_guard.py` L39-L53](/Users/lysander/projects/ref/hermes-agent/tools/skills_guard.py:39)
- [`tools/skills_guard.py` L599-L680](/Users/lysander/projects/ref/hermes-agent/tools/skills_guard.py:599)

判断：

- 这是我们未来开放外部 skill hub 时最值得学的一段。
- 但它只解决“能不能安全安装”，不解决“这个 skill 是否高质量、是否适用于当前任务、是否已经过时”。

## 八、更新、统计与淘汰：三者没有闭环

### 8.1 Hub update 是 content hash

`check_for_updates` 类逻辑对比当前 lock 里的 `content_hash` 和上游 bundle hash，返回：

- `up_to_date`
- `update_available`
- `unavailable`

证据入口：

- [`tools/skills_hub.py` L2848-L2864](/Users/lysander/projects/ref/hermes-agent/tools/skills_hub.py:2848)

这是 package update，不是知识 stale。

### 8.2 Insights 有 usage，但只读

`agent/insights.py` 从历史 tool calls 提取：

- `skill_view` count；
- `skill_manage` count；
- `last_used_at`；
- top skills 排序。

证据入口：

- [`agent/insights.py` L299-L373](/Users/lysander/projects/ref/hermes-agent/agent/insights.py:299)
- [`agent/insights.py` L566-L604](/Users/lysander/projects/ref/hermes-agent/agent/insights.py:566)
- [`agent/insights.py` L801-L820](/Users/lysander/projects/ref/hermes-agent/agent/insights.py:801)

但没有发现这些统计回流到：

- `skills_list` 排序；
- skill disable；
- skill stale candidate；
- background review prompt；
- Hub update；
- Atropos reward。

### 8.3 Disable 是手动配置

`agent/skill_utils.py` 从 config 读取 `skills.disabled` / `skills.platform_disabled`。这是用户配置，不是算法淘汰。

证据入口：

- [`agent/skill_utils.py` L121-L160](/Users/lysander/projects/ref/hermes-agent/agent/skill_utils.py:121)

## 九、算法/启发式清单

| 机制 | 输入 | 输出 | 类型 | 能否证明 skill 更好 |
|------|------|------|------|---------------------|
| `_skill_nudge_interval` | tool iteration count | 是否触发 background review | 阈值规则 | 不能 |
| `_SKILL_REVIEW_PROMPT` | conversation history + existing skills | LLM 决定 patch/create/nothing | LLM 判断 | 不能，只是提议/写盘 |
| `skill_manage` validation | name/content/frontmatter/path/size | allow/error/rollback | 规则校验 | 不能 |
| `skills_list` sort | category/name | ordered metadata | 字母序 | 不能 |
| prompt snapshot cache | mtime/size manifest | reused skill index | 缓存算法 | 不能 |
| bundled sync | origin hash/user hash/bundled hash | copy/update/skip | hash diff | 不能 |
| Hub update | lock content_hash/latest bundle hash | update_available | hash diff | 不能 |
| Hub search | source-specific text match/score/trust dedupe | search results | 启发式检索 | 不能 |
| Security guard | regex/structure/unicode/trust | safe/caution/dangerous | 静态扫描 | 只证明部分安全风险 |
| insights | historical tool calls | usage report | 统计排序 | 不能，且不回流 |
| Atropos reward | rollout output/test result | reward | eval/training signal | 不回流 skill 系统 |

所以，如果 PPT 说“有算法标记过期 / skill 会成长”，需要追问：**哪个算法？输入是什么？输出写到哪里？如何改变下一次 skill discovery 或 activation？** 到目前源码证据看，Hermes 主要是“启发式 + LLM background review + hash/update + 安全扫描”。

## 十、和我们家的对比

| 维度 | Hermes | Cat Cafe |
|------|--------|----------|
| 即时沉淀 UX | background review 自动触发，较顺 | 互动中猫/铲屎官双向发起，较重但可信 |
| Skill 写入 | 直接写 `~/.hermes/skills` | 倾向 candidate / docs / review 后固化 |
| Skill discovery | metadata index + skill_view | 依赖 host/harness，Cat Cafe runtime 层待补 |
| Skill 质量判断 | 同模型 fork + prompt | 多主体 review + CVO + truth source |
| 外部 skill hub | 多源聚合较强 | 暂无同级 marketplace |
| 安全扫描 | regex + trust policy 较完整 | 外部 skill intake 还没成体系 |
| Stale/retire | 手动禁用 + hash update，不是质量 stale | 我们也缺显式 stale workflow，但 F163/F102/F152 可接 |
| Eval/RL | Atropos 有 eval/training，但不回流 skills | 我们有 CI/quality gate，未做训练环境 |

我的判断：

- **Hermes 赢在产品化闭环**：做完任务后，后台 review agent 自动考虑沉淀；Hub 安装链成熟；skill commands 可直接用。
- **我们赢在治理模型**：经验从互动、review、docs 真相源中长出来，不让同一模型自评自改直达 active。
- **我们应该学“入口顺滑”和“外部 intake 安全链”**，不学“直接 active 的自我膨胀”。

## 十一、给 Cat Cafe 的可落地启发

### 11.1 可以学

1. **Background review UX，但写入 candidate queue**
   - 任务结束后异步生成 skill draft；
   - 不直接 active；
   - 进 Knowledge Feed / review queue；
   - CVO/对口猫通过后才入 active。

2. **Skill Hub intake 安全链**
   - source trust；
   - quarantine；
   - static scan；
   - audit log；
   - content hash；
   - update_available 只表示上游更新，不表示 stale。

3. **Dynamic context preprocessing 的保守子集**
   - 模板变量可用；
   - inline shell 默认禁用；
   - 如启用，必须预算、白名单、审计。

4. **Usage insights 先做只读报表**
   - `last_used_at`、load count、edit count 有价值；
   - 但第一版不要自动删除，先推 stale candidate。

### 11.2 不该学

1. **不让模型自己决定“这次比上次好”后直接 patch active skill。**
2. **不把 `non-trivial workflow` 当作充分标准。**
3. **不把 hash update 包装成知识过期算法。**
4. **不把 Atropos reward 当成 skill self-improvement 证据，除非证明 reward 回流 skill state。**
5. **不让 inline shell 进入默认 skill 加载路径。**

## 十二、拆解明星开源项目 skill 的方法论候选

这轮给最终 `open-source-project-teardown-skill-draft.md` 增加四个检查项：

1. **状态突变点追踪法**：找到项目里哪些函数真的写入 runtime state。Hermes 是 `skill_manage`、Hub install、sync；不是 Atropos。
2. **反馈链闭环验证法**：宣传 self-improving 时必须画 `signal -> decision -> state mutation -> future behavior`。断一环就不能叫闭环。
3. **算法剥皮表**：把“算法、启发式、prompt、手动配置、外部服务”分栏，不允许混写。
4. **只读 telemetry 识别法**：有 `last_used_at` / usage dashboard 不等于生命周期治理；必须看它是否被 discovery、ranking、stale、promotion 消费。

## 本文结论

Hermes 的 skill 系统不是空心营销：它确实做了 progressive disclosure、background review、agent-managed CRUD、Hub、安全扫描、usage insights。

但“skills 会成长”的真实边界是：**它能更顺手地创建/修改 skill，却不能证明修改后的 skill 更好，也没有自动淘汰与晋升门禁。**

对我们来说，最正确的学习路径不是照搬，而是：

```text
Hermes 的 UX 顺滑度
  + 我们家的互动沉淀/多主体 review/CVO 质量门禁
  + F102/F152/F163 的 provenance/stale/eval 体系
  = Cat Cafe 版 skill lifecycle
```

