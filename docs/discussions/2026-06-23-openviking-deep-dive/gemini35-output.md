---
doc_kind: research-note
topics: [openviking, l0-l1-index, gemini35-output]
created: 2026-06-24
executor: "@gemini35"
---

# OpenViking L0/L1 Index Precision Blind Output

Blind statement: 未读 F243 aggregate/samples/evaluations/verdict；未读本实验评测答案。

## F008

Source: `docs/features/F008-token-budget-observability.md`

```json
{
  "semantic_title": "Token 预算与深度可观测性",
  "abstract": "本篇文档是一篇约300字的特性笔记，介绍了Cat Café系统中Token预算可观测性的完成状态，包括char到token的迁移、CLI使用与成本捕获以及前端面板展示等内容范围。",
  "overview": "- What it is: 完成状态的特性笔记（Feature Note）。\n- What it covers: Token预算捕获、char-token迁移、RightStatusPanel面板展示、ParallelStatusBar聚合和ContextAssembler截断机制。\n- When to use: 需要了解或调试Cat Café系统中Token用量捕获、成本监控与前端状态栏展示逻辑时参考。\n- How to use: 通过引用F008特性ID，查看关联的66a59e4等commits，并对照ContextAssembler截断机制进行引用。\n- What it's for: 解决系统运行过程中的Token用量黑盒与计费可观测性问题，防止关键信息因截断丢失。\n- Content outline or synopsis: 文档包含Why背景调研，What部分的任务完成清单（涉及16个文件的迁移与commits），验收条件AC-A1，关联的截断Bug Report链接，以及依赖项（F025）、风险评估（历史口径漂移与审计脚本复跑）和Timeline历史归档记录。"
}
```

## F038

Source: `docs/features/F038-skills-discovery.md`

```json
{
  "semantic_title": "Skills 按需发现机制",
  "abstract": "本篇文档是一篇约250字的特性笔记，记录了Cat Café中Skills按需发现机制的归档状态，内容涵盖了方向A的分类标记与.claude/skills/软链接修复，以及未来方向B使用BM25词频检索做延迟加载的规划。",
  "overview": "- What it is: 处于挂起（parked）状态的特性笔记（Feature Note）。\n- What it covers: Skills分类标记与软链接修复（方向A）、BM25词频延迟加载检索（方向B）及按需构建的决策。\n- When to use: 需要扩展Skills数量或需要了解Skills按需加载与检索过滤机制的设计决策时参考。\n- How to use: 引用F038特性ID，结合Key Decisions（simple is better）和关联commit 5257e1c进行引用。\n- What it's for: 解决Skills数量增加时的加载性能问题，并在不引入向量数据库的轻量化架构下实现自动按需发现。\n- Content outline or synopsis: 文档涵盖了Why背景调研，What部分已落地的方向A成果与待触发的方向B设想，验收条件AC-A1，核心决策，以及依赖（F038/F100）、版本漂移风险缓解（F094审计脚本）和Timeline归档恢复记录。"
}
```

## F155

Source: `docs/features/F155-scene-guidance-engine.md`

```json
{
  "semantic_title": "场景式交互引导引擎",
  "abstract": "本篇文档是一篇约1500字的核心特性设计规约，详细定义了Cat Café系统中基于场景的交互式引导引擎（Scene-Based Guidance Engine）的架构重构、状态机、多层状态权威级和社区吸纳状态。",
  "overview": "- What it is: 已完成并关闭的系统特性设计规约（Feature Spec）。\n- What it covers: YAML驱动的引导流程定义、四态引导状态机、前端Overlay与Passthrough无障碍支持、Zundstand-Redis三层状态权威层级、Socket.io事件同步、以及路由和系统提示词生成的解耦重构。\n- When to use: 编写新的引导流、调试用户引导流程、修改底层路由拦截器（GuideRoutingInterceptor）或调整引导状态同步机制时需要查阅。\n- How to use: 引用F155特性，遵循State Authority层级（Redis为单一真相源），以及KD-16 ephemeral session决策，通过相关MCP工具或YAML进行扩展。\n- What it's for: 解决用户在复杂功能操作中缺乏步骤级上下文引导的问题，保证多用户在共享默认线程上的状态隔离与安全。\n- Content outline or synopsis: 文档包括Why需求背景，What部分Phase A（10项）与Phase B（架构重构与产品扩展）的详细实现，核心的State Authority三层权威架构定义（重点提及默认线程的共享限制），社区Key Decisions（KD-9至KD-16），待办AC，Intake五问与Merge Gate安全审计评估，以及Upstream社区Issue/PR链接。"
}
```

## F161

Source: `docs/features/F161-acp-carrier-generalization.md`

```json
{
  "semantic_title": "通用 ACP 传输与环境变量映射",
  "abstract": "本篇文档是一篇约1300字的特性设计规约，详述了ACP协议从Gemini绑定中解耦并通用化为独立Transport传输协议的重构设计，以及模板环境变量映射与OpenCode ACP接入的验证。",
  "overview": "- What it is: 已实现的系统核心特性设计规约（Feature Spec）。\n- What it covers: ACP传输与clientId解耦、AcpAgentService重構、BUILTIN_ENV_MAPS模板替换机制、OpenCode/Kimi ACP接入验证与思考缓冲区（thinking buffer）处理机制。\n- When to use: 新增或修改外部Agent客户端连接、修改环境变量注入机制（env-map.ts）或优化ACP长对话session复用逻辑时参考。\n- How to use: 引用F161特性，在配置账号时使用`${api_key}`/`${base_url}`模板，遵循KD-9 sessionId复用及KD-12 compaction loop的上下文配置建议。\n- What it's for: 解决ACP传输硬编码绑定、新增Client需修改路由以及长对话思考缓存丢失/压缩死循环问题，提供零代码快速接入新Client的能力。\n- Content outline or synopsis: 文档包括Why背景与痛点，Current State现状对照，What部分的Phase A（通用传输与环境变量模板映射）和Phase B（多Client端到端验证）的详细内容，AC验收标准覆盖，相关特性依赖，风险评估，13项关键决策（KD-1至KD-13），Timeline历史变更，以及4个Followup遗留改进方向。"
}
```

## F170

Source: `docs/features/F170-web-chinese-chess.md`

```json
{
  "semantic_title": "网页端中国象棋游戏",
  "abstract": "本篇文档是一篇约800字的特性开发规约，记录了用于演示Feature lifecycle全流程的网页中国象棋Demo的交付状态，包括核心棋盘规则与对局交互的实现。",
  "overview": "- What it is: 已归档的演示用特性开发规约（Feature Spec）。\n- What it covers: 9×10象棋棋盘绘制、7种棋子走子规则校验（含蹩马腿等送将检测）、回合对局逻辑、悔棋与重置功能，以及分支PR Demo的交付状态。\n- When to use: 演示Cat Café平台的多猫协同开发流程、Review门禁或演示Feat lifecycle完整周期时作为示范样本参考。\n- How to use: 作为Demo归档引用（代码在feat/f170-chinese-chess分支），不应合入main主线或作为活跃产品功能，参考KD-2进行归档。\n- What it's for: 验证多猫协作在独立前端项目上的效率，展示立项、开发、测试、Review到愿景守护的全流程。\n- Content outline or synopsis: 文档包括Why演示背景，What部分的Phase A（棋盘与规则引擎）、Phase B（对局交互）与Phase C（可选体验）任务清单，已完成的AC验收标准，依赖项（F093世界引擎），风险缓解与未定问题（OQ），核心归档决策（KD-1/KD-2），Timeline里程碑，以及Review Gate审查规约。"
}
```

## F189

Source: `docs/features/F189-operation-context-unification.md`

```json
{
  "semantic_title": "操作上下文单点化设计",
  "abstract": "本篇文档是一篇约700字的特性设计规约，探讨了如何构建统一的OperationContext Builder以解决HTTP/MCP/CLI/A2A等多载体下权限与上下文不一致导致的安全边界和API参数同步问题。",
  "overview": "- What it is: 处于设计讨论（spec）阶段的系统特性规约（Feature Spec）。\n- What it covers: 统一的OperationContext接口设计（包含caller/thread/permissions等）、各入口（HTTP/MCP/A2A）的Builder构建方案，以及对evidence search和工具处理器的消费迁移规划。\n- When to use: 遇到多入口参数不一致、回调鉴权漏洞或系统需要统一调用方身份标识与Trust Boundary校验机制时查阅。\n- How to use: 根据KD-2决策，在下一次触发条件满足时（如新功能需统一身份或出Parity bug）启动该特性的Phase A构建，引用并保持Deferred/Non-goals中的渐进迁移建议。\n- What it's for: 解决因各载体单独提取上下文而导致的Parity bug和Trust boundary不一致的安全隐患。\n- Content outline or synopsis: 文档包含Why背景痛点（GBrain Teardown教训），What部分的Phase A（Schema与Builder）及Phase B（消费迁移）设计，预设的AC验收标准，明确暂不实施的Non-goals及触发条件，依赖项（F161/F156/F178），风险控制与两个未定问题，核心启动决策（KD-1/KD-2），Timeline立项记录，以及GBrain等讨论链接。"
}
```

## F009

Source: `docs/features/F009-tool-use-tool-result.md`

```json
{
  "semantic_title": "工具使用事件显示机制",
  "abstract": "本篇文档是一篇约200字的特性笔记，记录了Cat Café系统中tool_use与tool_result事件前端显示的完成状态，涉及useAgentMessages新增事件处理器与ChatMessage的'tool'变体。",
  "overview": "- What it is: 已完成的系统轻量级特性笔记（Feature Note）。\n- What it covers: useAgentMessages中的tool_use/tool_result处理器逻辑，以及前端ChatMessage的'tool'展示变体。\n- When to use: 当需要调试、修改或深入了解猫猫调用工具及其结果在前端聊天气泡中的事件映射和消息流显示逻辑时参考。\n- How to use: 引用F009特性ID，了解其修改了前端核心消息钩子以匹配5.0-pre版本事件展示，无需额外复杂配置。\n- What it's for: 解决猫猫调用工具和返回结果在UI上无法实时直观反馈给用户的问题，提供更好的工具链可观测性。\n- Content outline or synopsis: 文档包含简要的Why决策背景，What部分描述事件处理器和消息变体的实现细节，AC-A1模板结构验收，归档Links，依赖关系（无显式依赖），版本漂移风险的规避，以及Timeline归档恢复说明。"
}
```

## F012

Source: `docs/features/F012-feature-discoverability.md`

```json
{
  "semantic_title": "系统功能注册与可发现性",
  "abstract": "本篇文档是一篇约250字的特性笔记，记录了Cat Café Hub模态框及对应系统注册表、环境摘要和/hub命令的前端功能可发现性机制的完成状态。",
  "overview": "- What it is: 已完成的前端功能可发现性特性笔记（Feature Note）。\n- What it covers: Cat Café Hub模态框设计、功能注册表实现、环境摘要渲染以及命令行/hub命令接入。\n- When to use: 当需要修改Hub菜单展示、新增功能注册或者调整/hub命令的逻辑时作为背景和实现参考。\n- How to use: 引用F012特性，结合关联commit 43f88ca与7b03236，在/hub命令和组件实现上进行引用。\n- What it's for: 解决用户难以了解和快速打开系统内隐藏的各类高级功能的问题，提供一键可达的Hub入口。\n- Content outline or synopsis: 文档包括Why来源（2026-02-10 brainstorm），What部分实现的功能可发现性关键组件和提交，AC-A1标准，关联讨论Links，依赖项（F088），风险规避（历史口径漂移与审计脚本），以及Timeline归档恢复记录。"
}
```

## F013

Source: `docs/features/F013-audit-log-v2.md`

```json
{
  "semantic_title": "操作审计与日志归档系统",
  "abstract": "本篇文档是一篇约250字的特性笔记，记录了Cat Café系统审计日志v2版本的完成状态，包含操作审计追责与CLI原始日志归档调试功能。",
  "overview": "- What it is: 已完成的审计与日志特性笔记（Feature Note）。\n- What it covers: 用户操作审计（追责机制）和命令行工具（CLI）原始日志归档与调试功能的实现。\n- When to use: 需要调试系统操作日志记录、追溯用户指令历史，或者需要查阅CLI运行底层原始日志归档机制时参考。\n- How to use: 引用F013特性ID，根据Why部分的规划文档，并查看平台的操作记录归口机制。\n- What it's for: 解决平台操作无法追责的问题，并为猫猫与CLI的意外行为提供完备的原始日志归档以利于排查调试。\n- Content outline or synopsis: 文档由Why背景调研引出，What部分涵盖操作审计与日志归档功能完成状态及计划文档的关联，AC验收标准，讨论与计划文档Links，F013依赖，漂移风险说明，以及Timeline历史恢复归档说明。"
}
```

## F119

Source: `docs/features/F119-who-is-spy-game.md`

```json
{
  "semantic_title": "谁是卧底推理游戏引擎",
  "abstract": "本篇文档是一篇约900字的战术游戏特性设计规约，详述了谁是卧底（Who is Spy）游戏流程引擎、近义词组库、坏猫战术Prompt注入、身份隔离机制以及战绩排行榜对接的设计方案。",
  "overview": "- What it is: 处于设计讨论（spec）阶段的系统特性规约（Feature Spec）。\n- What it covers: 描述-讨论-投票-淘汰游戏流程引擎、近义词组设计库（WordPairBank）、卧底（伪装/嫁祸）与平民（验证/诱导）的坏猫战术Prompt设计、局内身份隔离（scoped event log）及Leaderboard战绩对接。\n- When to use: 扩展Cat Café游戏化场景、实现多猫Deception/Social Deduction博弈机制或优化多Agent战术策略时查阅。\n- How to use: 引用F119特性，遵循F101 GameEngine基座逻辑，确保实现满足局内身份隔离（AC-A1）和坏猫Prompt注入（AC-A4）。\n- What it's for: 丰富平台多猫社交博弈能力，与脑门贴词互补，测试猫猫在信息不对称情况下的伪装、跟风、诱导与推理分析能力。\n- Content outline or synopsis: 文档包括Why立项原话与背景，What部分详细的流程引擎设计（A1至A5）、核心战术描述与词组设计，AC-A1至AC-A7验收条件，带有验证方式的需求 Checklist（R1至R6）及覆盖检查，F101/F107/F075依赖，多猫局博弈失衡风险评估，2个未定问题（OQ），复用GameEngine决策（KD-1/KD-2），Timeline记录，以及相关脑门贴词Links。"
}
```

[烁烁/Gemini 3.5 Flash🐾]
