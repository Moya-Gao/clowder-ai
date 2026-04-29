---
doc_kind: research-note
topics: [hermes-agent, architecture, agent-runtime]
created: 2026-04-28
status: draft
source_repo: /Users/lysander/projects/ref/hermes-agent
source_commit: adef1f33
---

# Hermes Agent 架构地图

本文件只记录第一轮架构更新，不下最终评价。最终评价应回到 `README.md` 和后续专题文档。

## 顶层模块

```text
hermes-agent/
├── run_agent.py          # AIAgent: 对话主循环、background review、tool loop
├── cli.py                # HermesCLI: 交互 CLI、slash commands、配置加载
├── model_tools.py        # tool discovery / dispatch glue
├── toolsets.py           # built-in toolset definitions
├── hermes_state.py       # SQLite session store / FTS5 search
├── agent/                # provider adapters, memory, context compression, skill utils
├── hermes_cli/           # CLI subcommands, setup, provider/model/profile/plugin management
├── tools/                # tool implementations and skill tools
├── skills/               # bundled skills, current count: 83 SKILL.md
├── optional-skills/      # official optional skills, current count: 58 SKILL.md
├── gateway/              # multi-platform messaging gateway
├── plugins/              # memory/context/dashboard/google-meet/langfuse/etc.
├── acp_adapter/          # editor integration
├── cron/                 # scheduler
├── environments/         # Atropos RL/eval environments
├── tinker-atropos/       # Tinker/Atropos related integration material
├── ui-tui/               # Ink terminal UI
├── web/                  # web dashboard
└── website/              # Docusaurus docs
```

## 关键数据流

### 1. 普通对话 / tool loop

```text
CLI / Gateway / API
  -> AIAgent.run_conversation()
  -> provider transport
  -> model response
  -> tool_calls?
      yes -> model_tools.handle_function_call()
             -> tools/registry dispatch
             -> append tool result
             -> next model call
      no  -> final_response
```

需要继续验证：

- provider fallback 在何处选择；
- context compression 何时触发；
- credential pool 与 platform session 的边界。

### 2. Skill 使用

```text
skills_list()
  -> scan ~/.hermes/skills + external_dirs + plugin skills
  -> return metadata list

skill_view(name)
  -> load SKILL.md
  -> optional preprocess:
       ${HERMES_SKILL_DIR}
       ${HERMES_SESSION_ID}
       !`inline shell` when config enables it
  -> return full instructions + linked files list

skill_view(name, path)
  -> return selected reference/template/script/asset file
```

真实价值：

- token progressive disclosure；
- external skill dirs；
- plugin qualified skills；
- conditional activation by tool/toolset availability；
- dynamic context preprocessing。

风险：

- inline shell 默认关闭，但一旦启用就是动态执行能力，需要我们单独评估安全边界；
- list 仍然是扫描元数据，不是质量排序；
- metadata 多了仍会有上下文预算压力。

### 3. Agent-managed skill 生成/修改

```text
tool iterations accumulate _iters_since_skill
  -> threshold: _skill_nudge_interval default 10
  -> after final_response
  -> _spawn_background_review(review_skills=True)
  -> review agent with toolsets ["memory", "skills"]
  -> prompt:
       survey existing skills
       think class-first
       prefer patching existing skill
       create only if no existing class covers it
  -> skill_manage(create/edit/patch/delete/write_file/remove_file)
```

当前判断：

- 它比“只靠主模型想起要存”更强，因为有后台 review agent 和专门 prompt。
- 它仍然不是严格算法，因为没有发现自动 reward、A/B、版本回滚、成功率晋升。
- 这条 UX 我们可以学，但落地时应该变成 candidate queue，而不是直接 active。

### 4. Skill Hub 安装/更新

```text
source router
  -> search/inspect/install
  -> download bundle
  -> quarantine
  -> skills_guard scan
  -> install into ~/.hermes/skills
  -> lock/audit/content_hash
  -> check update via hash comparison
```

当前判断：

- 多源聚合和安全安装链路值得学。
- `update_available` 是上游内容 hash 不一致，不是 skill 失效判断。

### 5. Atropos RL/eval environments

```text
Atropos BaseEnv
  -> HermesAgentBaseEnv
  -> concrete env
       TerminalTestEnv
       HermesSweEnv
       TerminalBench2EvalEnv
  -> HermesAgentLoop
  -> ToolContext
  -> reward function / verifier
```

核心价值：

- 把 agent tool-calling loop 放进可评分 rollout；
- reward function 能访问同一 task sandbox；
- Phase 2 用 VLLM ManagedServer 拿 token IDs/logprobs；
- tool call parser 适配不同模型格式。

需要继续验证：

- `tinker-atropos/` 和 `environments/` 的边界；
- RL 数据是否反馈到 shipped model / skill / prompt；
- 是否有公开可复现实验。

## 明星特性与证据入口

| 特性 | 证据入口 | 第一轮判断 |
|------|----------|------------|
| self-improving skills | `run_agent.py`, `tests/run_agent/test_background_review.py` | 有后台 review 机制，但质量闭环仍薄 |
| skills progressive disclosure | `tools/skills_tool.py` | 真机制，值得学 |
| skill manager | `tools/skill_manager_tool.py` | CRUD + size limit + optional security scan |
| skill hub | `tools/skills_hub.py`, `tools/skills_guard.py` | 多源生态 + trust/quarantine/audit |
| Tinker/Atropos RL | `environments/README.md`, `environments/`, `tinker-atropos/` | 真 RL/eval 环境，不等于 skill 自动变好 |
| messaging gateway | `gateway/platforms/` | 广覆盖，需要深挖会话和权限 |
| plugins | `plugins/` | 增长快，需判断是否稳定扩展点 |
| TUI/web dashboard | `ui-tui/`, `web/` | 产品化强，但未必是核心算法 |

## 待验证问题

1. `skill_preprocessing.py` 的 inline shell 动态上下文是否有足够安全边界？
2. background review agent 生成 skill 后是否有用户确认/可见 audit？
3. skill 修改是否有版本历史、diff、rollback？
4. `insights` / telemetry 是否反馈到 skill 排序、禁用或晋升？
5. Atropos rollout 是否真的训练/优化 Hermes 自身，还是主要作为外部 eval/training harness？
6. Skills Hub 的 trust model 是否能抵抗 prompt injection / supply-chain 风险？
7. Gateway session 与 skill/memory 写入是否存在跨平台隔离问题？

