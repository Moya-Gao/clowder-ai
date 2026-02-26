---
feature_ids: []
topics: [gpt, pro, architecture]
doc_kind: research
created: 2026-02-13
---

# gpt-pro 
下面我用“外部架构顾问”的口吻来审你们的 A-F 方案，并把每个问题都落到可执行的建议上（偏硬核，少客套）。我会把你们现在的 `services/` 想象成一张被猫爪踩过的地图：不是不能走，是每次找路都要靠“主开发的脑内 GPS”，而你们要做的是把路标、街区、出入口都补齐。🐾

---

## 1) 方案盲点：A-F 之外我会补哪些“防腐化”手段？

你们的 A-F 很像“硬边界 + 流程边界 + 过渡层 + 依赖边界”，方向是对的。盲点主要在这几类：

### 1.1 “目录限额”可能带来反效果：被迫造很多空子目录

单目录 15 个文件的硬上限，如果没有配套的“目录语义规则”，容易出现：

* 为了过线，拆出一堆 `misc/`, `helpers/`, `more/`, `stuff/` 这种“猫砂盆目录”
* 目录层级变深，导航成本反而增加（从 70 文件平铺，变成 20 个子目录每个 6 文件，且语义不清）

**补救：给“允许拆目录”的理由清单**（写进规范和 review checklist），例如只有满足下列任一条件才新建子目录：

* **职责明显不同**（持久化 vs 业务编排 vs 外部 provider）
* **依赖方向不同**（例如 `ports/` 只能被实现层引用）
* **生命周期不同**（实验性、迁移期、废弃期）

### 1.2 缺少“例外机制”会让规则在 2 个月后被破窗

任何硬规则都需要“合法逃生门”，否则最后会出现“大家偷偷关 lint”的剧情。

建议加一条：

* **例外必须显式登记**：例如 `dir-lint` 允许 `// dirlint-disable-next-line reason=... expires=2026-03-01` 或者 `docs/adr/` 里记录一个“临时豁免 ADR”
* **例外必须有到期日**：过期自动报错，不允许永久豁免

### 1.3 缺少“所有权”会让目录再次变成公共堆放区

你们是 3 人团队，其中 2 个是 AI，这反而更需要“谁对这片目录负责”的明示。

建议加：

* `CODEOWNERS`（或同等机制）让关键目录有明确 owner
* 每个模块目录内放一个 `README.md`（50 行以内）写清楚：

  * 这目录是什么
  * 不是什么
  * 对外暴露入口（`index.ts` 或 plugin）在哪里
  * 依赖规则（比如只能 import 哪些层）

### 1.4 缺少“架构决策记录”会让结构反复摇摆

你们已经有大量 docs，但缺的是“结构型决策”的单点记录。建议引入 ADR（Architecture Decision Record）并固定位置，例如 `docs/adr/`。ADR 的核心是记录决策、背景、替代方案、后果。([GitHub][1])
这会显著降低“下一轮重构时又忘了当初为什么这么拆”的概率。

### 1.5 过渡层（re-export）要加“毒性控制”

F 很实用，但也最容易变成长期存在的“幽灵兼容层”，导致真实依赖关系被掩盖。

补充两条控制：

* 兼容导出只能存在于 **`compat/` 或 `legacy/`** 目录里，禁止散落在各处
* 兼容层 **不得引入新逻辑**，只能 re-export
* 兼容层必须被依赖边界工具标记成“只能被旧路径使用”，否则会出现新代码也继续 import compat 的情况

---

## 2) 目录拆分建议：70 个文件按 6 类职责怎么组织？

这里我给两个方案：一个“低风险快速落地”，一个“更符合 DDD/Clean Architecture 的长远形态”。

### 方案 A：就地整理（最低风险，改动面小）

目标：不大搬家，只把 `services/` 从“平铺集市”变成“分区街道”。

建议结构：

```
domains/cats/
  services/
    agents/
      providers/           # ClaudeAgentService, CodexAgentService, GeminiAgentService...
      routing/             # AgentRouter, route-strategies
      invocation/          # invoke-single-cat, stream-merge, InvocationTracker
    stores/
      ports/               # Store interfaces (MessageStore, ThreadStore...)
      memory/              # In-memory implementations
      redis/
        impl/              # Redis*Store
        keys/              # message-keys, thread-keys...
      factories/           # *StoreFactory
    auth/
      AuthorizationManager
      AuthorizationRuleStore/.. (如果你们把它归 stores 也行，但 auth 子域更清晰)
    context/
      ContextAssembler
      SystemPromptBuilder
      McpPromptInjector
      IntentParser
    session/
      SessionManager
    summarization/
      AutoSummarizer
      SummaryStore/.. (如果 SummaryStore 是通用 store，也可以留在 stores)
    orchestration/
      ModeOrchestrator
      DegradationPolicy
      HindsightClient
      EventAuditLog
      CliRawArchive
    modes/                 # 你们已有 modes/ 子目录，可并入 orchestration 或单独保留
    index.ts               # 可选：只导出“对外 API”，不要全量 barrel
```

要点：

* **把“Store 接口”从实现中剥离出来**，用 `stores/ports` 明确“这是接口层”
* Redis keys 跟 Redis 实现放一起（同一变更域），避免 keys 在顶层飘着
* Agent 相关再细分为 provider/routing/invocation，避免 `agents/` 再次膨胀

### 方案 B：结构升级（更正宗，但更像一次“小手术”）

如果你们愿意顺手把“层次”也理顺，我会建议把“接口/业务/基础设施”明确分层，这样依赖边界工具更好写，也更不容易复发：

```
domains/cats/
  application/            # 用例编排: ModeOrchestrator, SessionManager, ContextAssembler...
  domain/                 # 纯业务规则/实体/策略(如果你们有)
  ports/                  # 依赖倒置接口: MessageStore, AgentProvider, AuthorizationStore...
  infrastructure/
    persistence/
      memory/
      redis/
        keys/
    agents/
      providers/
  presentation/
    routes/               # cats 相关 fastify routes (可选：从顶层 routes 下沉)
```

Fastify 本身鼓励用 plugin 做模块化封装和隔离作用域，形成 DAG，减少交叉依赖。([Fastify][2])
所以把 `presentation/routes` 作为 cats 模块的一个 plugin 会更贴合 Fastify 心智模型。

如果你们短期不想动 routes，就先用方案 A，等下次“路由级重构”再下沉。

---

## 3) 阈值合理性：15 文件/目录是严还是松？

在你们已有“文件 < 200 行”约束下，**15 作为“硬错误阈值”偏严**，但可以做成“软硬两级”就非常好用。

我建议这样设：

* **Warn 阈值：15**

  * 触发后要求：PR 描述里写一句“为什么不拆/怎么拆”
* **Error 阈值：25（或 30）**

  * 超过就必须拆，除非走例外机制（带到期日）

原因：

* 15 以内一般还能保持可扫描性
* 15 一刀切做 error 很容易把团队推向“为了过线而过线”，目录层级会变深
* 25 或 30 更像“已经明显不可读”的红线

另外两个细节建议：

* **不要把 `index.ts` 算进阈值**（否则大家会讨厌 index.ts，反而不利于对外 API 收敛）
* 阈值最好只统计 `*.ts` 源文件，不统计 `*.d.ts`, `*.generated.ts`（如果你们有）

---

## 4) 依赖边界工具：dependency-cruiser vs eslint-plugin-boundaries，选哪个更适合？

先说结论：
**日常 IDE 即时反馈优先选 JS Boundaries（eslint-plugin-boundaries / @boundaries/eslint-plugin）。深度依赖图与循环检测优先选 dependency-cruiser。最稳的是两者组合，各做各擅长的那一半。**

### eslint-plugin-boundaries（JS Boundaries）适合你们的点

* 它就是 ESLint 插件形态，主打“IDE 和 CI 都能即时提示边界违规”，适合小团队持续执行。([JS Boundaries][3])
* 近期版本仍在更新（站点直接挂出 5.4.0）。([JS Boundaries][3])
* 它已经在推进 scoped 包发布（@boundaries/eslint-plugin），并同时发布到旧包名，说明维护者在做生态迁移规划。([GitHub][4])

适用场景：

* “domain 不能 import infrastructure”
* “agents/provider 不能 import routes”
* “stores/ports 只能被 impl 引用，不能反向”

### dependency-cruiser 适合你们的点

* 它更像“架构扫描器”：校验并可视化依赖图，适合做 CI 的 architecture gate。([GitHub][5])
* 更新也很活跃，2026-02 还有 v17.3.8。([GitHub][6])
* 它对“循环依赖、孤儿模块、特定路径模式违规”这类宏观检查很强。

适用场景：

* “禁止任何循环依赖”
* “禁止跨 package 的某些依赖方向”
* “生成依赖图给架构卫生检查用”

### 我会怎么选（结合你们现状）

* **如果你们只能上一个**：先上 **JS Boundaries**，因为它更贴近开发流，AI 也更容易在写代码时被即时纠正。([JS Boundaries][3])
* **如果你们愿意两者都上**：

  * JS Boundaries 做“开发时红绿灯”
  * dependency-cruiser 做“CI 终检 + 依赖图快照”

---

## 5) docs 归档策略：270 个文件怎么收拾最合理？

你们 docs 的“腐化模式”跟 services 一样：缺少生命周期管理。

我建议把 docs 按“用途 + 状态”分层，而不是只按类型分层。可以用下面这个骨架：

```
docs/
  _index.md                  # docs 总入口，告诉新人去哪里找什么
  active/
    plans/
    bugs/
    discussions/
    mailbox/
    research/
  adr/                        # 架构决策记录（强烈建议单独出来）
  archive/
    2026/
      02/
        mailbox/
        bugs/
        discussions/
        plans/
    by-phase/                 # 可选：如果你们 Phase 是核心组织方式
      phase-05/
      phase-06/
```

具体策略：

* **mailbox/**

  * `active/mailbox/` 只保留最近 N 天或最近 N 个线程
  * 其他自动归档到 `archive/YYYY/MM/mailbox/`
* **bug-report/**

  * 改名更直观：`bugs/open`、`bugs/closed`
  * closed 按月份或按 phase 归档都行，关键是“open 必须稀疏”
* **plans/**

  * `plans/active` vs `plans/completed`
  * 完成的 plan 要么归档，要么提炼一份“实现总结”然后归档原始计划
* **discussions/**

  * 讨论如果产生结论，收敛成 ADR
  * 原始讨论进 archive，避免 discussions 变成永不清理的聊天记录池
* **phases/**

  * phases 本身可以作为索引目录，链接到 active/ 下对应的计划、ADR、总结

最关键的一点：
**归档不是搬文件，是减少“活跃目录的噪声密度”。**
让 `docs/active` 永远像菜单，让 `docs/archive` 像酒窖。

---

## 6) 测试文件组织：后端 test/ 分离 vs 前端 **tests** 同级，重构后怎么跟？

你们现在是两种风格并存，这不一定错，但会增加团队切换成本。我的建议是“按测试类型统一，而不是按技术栈统一”。

### 后端（Fastify API）

推荐双轨：

* **单元测试**：尽量靠近源码（便于定位和短路径 import）

  * `src/**/__tests__/*.test.ts` 或 `src/**/*.test.ts`
* **集成测试**：保留集中目录（你们已有 `test/integration` 很合理）

  * `test/integration/**`
  * `test/helpers/**`

这样做的好处：

* 单元测试跟着模块拆分自然搬迁
* 集成测试保持“面向行为”的组织，不会被目录重构拖着跑

### 前端（Next.js）

Next.js 官方文档示例提到遵循 Jest 约定，在项目根目录放 `__tests__`。([nextjs.org][7])
但前端社区也常用“测试贴着组件放”，CRA 文档甚至推荐把测试文件或 `__tests__` 放在被测代码旁边，以缩短相对路径并更快找到测试。([create-react-app.dev][8])

结合你们结构（有 `app/` 路由目录），我会建议：

* **components/hooks/stores/utils 的测试继续贴着放**（现在就挺好）
* **避免把测试文件放进会被 Next 当作路由入口的目录规则里**（尤其是 `app/` 的 segment 下面）

  * 如果你们确实想把 route 的测试贴着放，就要确保 Next 构建不会把它当页面（需要明确的命名约束或构建忽略规则）

一句话：
前端可以“贴着组件”，但别让测试混进路由编译路径里。

---

## 7) 长期有效性：半年后还会有人遵守吗？怎么强化？

现实一点说：**只靠文档和口头约定，半年后大概率会松。**
但你们已经有优势：900+ 测试 + AI 协作，这两样都是“自动化守门”的好燃料。

我会加这些强化手段：

### 7.1 把规则变成“默认行为”

* `dir-lint` 做成 pre-commit + CI 必跑
* PR 模板里自动勾选项
* 新建文件脚手架（哪怕是一个简单的生成器）让 AI/人类都从正确目录开始

### 7.2 把“结构变更”变成显式事件

* 任何触发阈值的 PR，必须在描述里加一段：

  * “新增文件属于哪个子域/职责”
  * “为何不新建子目录 / 为何需要新建”
* 架构级变更写 ADR，一页纸就够，别写论文([GitHub][1])

### 7.3 让违规更“痛”，但只痛在该痛的地方

* **Warn 一周再 block**这个节奏很好
* 但 block 的规则要聚焦高价值：

  * 目录爆炸（>25）
  * 依赖方向错（domain 引了 infra）
  * 循环依赖出现

### 7.4 针对“2 只 AI”的特别建议

AI 写代码很快，结构腐化也会很快。你们可以给 AI 加“强制输出约束”：

* AI 新增文件时必须同时：

  1. 更新相应目录的 `README.md`（如果新增了新的职责）
  2. 更新边界 lint 配置（如果新增了新 element 类型或新目录）
  3. 若触发阈值，自动提出目录重组 patch

这会让 AI 变成“结构保洁员”，而不是“文件投放机”。

---

## 附：你这个 prompt 已经很强了，还可以再补 6 个信息让外部顾问更快下判断

如果你确实要把它发给另一个模型/顾问，我建议在 prompt 末尾补一小段“环境事实”，不需要展开：

1. Node 版本、TS 版本、模块制式（ESM/CJS）
2. monorepo 工具（pnpm / yarn / npm workspaces，是否 Nx/Turborepo）
3. 测试框架（Jest/Vitest/Tap），是否 ts-jest，是否路径别名
4. 你们现在的 import 习惯（相对路径 vs tsconfig paths）
5. Fastify 的组织方式（是否每个 domain 都是一个 plugin 注册）([Fastify][2])
6. 是否已经有 ESLint 全仓统一配置（这影响 boundaries 落地成本）([ESLint][9])

---

如果你愿意，我也可以顺手给你们：

* 一个“目录语义规范”的最小模板（每个目录一页）
* 一份 JS Boundaries 的 element/rules 样例（按你们 cats 模块的层次）
* 一份 dependency-cruiser 的高价值规则集（先抓循环依赖 + 跨层依赖 + 跨 package 禁令）

你们现在最该做的不是“把 70 个文件挪家”，而是**先画好街区边界，再搬家具**。这样下一轮 feature 来的时候，目录不会又变回猫抓板。🐈‍⬛

[1]: https://github.com/joelparkerhenderson/architecture-decision-record?utm_source=chatgpt.com "Architecture decision record (ADR) examples for software ..."
[2]: https://fastify.io/docs/latest/Reference/Plugins/?utm_source=chatgpt.com "Plugins"
[3]: https://www.jsboundaries.dev/ "Build Quality Software | JS Boundaries"
[4]: https://github.com/javierbrea/eslint-plugin-boundaries/releases "Releases · javierbrea/eslint-plugin-boundaries · GitHub"
[5]: https://github.com/sverweij/dependency-cruiser/releases?utm_source=chatgpt.com "Releases · sverweij/dependency-cruiser"
[6]: https://github.com/sverweij/dependency-cruiser/releases "Releases · sverweij/dependency-cruiser · GitHub"
[7]: https://nextjs.org/docs/13/pages/building-your-application/optimizing/testing?utm_source=chatgpt.com "Optimizing: Testing"
[8]: https://create-react-app.dev/docs/running-tests/?utm_source=chatgpt.com "Running Tests"
[9]: https://eslint.org/blog/2026/01/eslint-2025-year-review/?utm_source=chatgpt.com "ESLint's 2025 year in review"
