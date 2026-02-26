---
feature_ids: [F032]
topics: [agent, plugin, architecture]
doc_kind: discussion
created: 2026-02-18
---

# F32: Agent Plugin Architecture — 讨论纪要

> 日期：2026-02-18
> 参与者：铲屎官、布偶猫（Opus）、缅因猫（Codex）
> 记录者：布偶猫
> 起因：铲屎官问"开源后别人能不能接入自己的 agent？"

---

## 议题

Cat Cafe 当前架构能否支持外部 agent 接入？如果不能，需要做哪些改造？

铲屎官的具体场景：
1. 接入 opencode（外部 CLI agent）
2. 允许其他人接入自己的 agent
3. 允许同一 provider 的多实例（比如两只布偶猫）

## 讨论过程

### 第一轮：布偶猫独立审计

布偶猫对整个 agent 接入架构做了代码审计，核心发现：

**好消息 — AgentService 接口通用：**
```typescript
interface AgentService {
  invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage>;
}
```
任何能产出文本流的 agent 都能实现此接口。

**坏消息 — CatId 编译时焊死：**
```typescript
type CatId = Brand<'opus' | 'codex' | 'gemini', 'CatId'>;
```

"三只猫"假设散落在 20+ 个文件中：

| 硬编码类别 | 涉及文件数 | 举例 |
|---|---|---|
| CatId 类型 + 校验 | 2 | `ids.ts`, `cat.ts` |
| 路由 schema `z.enum` | 6+ | messages, tasks, memory, modes, summaries |
| 配置层 | 3 | cat-budgets, cat-models, seal-thresholds |
| AgentRouter 构造 | 1 | 写死三个命名参数 |
| SystemPromptBuilder | 1 | `WORKFLOW_TRIGGERS` 按猫名写死 |
| Provider 实现 | 3 | 每个 hardcode 自己的 CAT_ID |
| 主入口 | 1 | `index.ts` 写死三个 `new XxxAgentService()` |
| 前端 | 若干 | 猫名、头像、颜色、命令解析 |

**结论：加一只猫 = 跨切面改 ~15 个文件 + rebuild shared 包。**

布偶猫建议分两层：
- **F32-a**：CatId 松绑（`Brand<string>`）+ AgentRegistry（运行时注册）
- **F32-b**：配置驱动 + 接入手册（开源友好，等实际接入经验再做）

### 第二轮：缅因猫独立审计

缅因猫独立验证了布偶猫的发现，并补充了更多硬编码点：

**额外发现：**
- `capabilities.ts` 返回三个固定 key
- 前端命令解析（`useChatCommands.ts`）硬编码三猫
- `invoke-single-cat.ts` 有手动 catId→name 三元链

**缅因猫评估：** 布偶猫之前说"改 12 个文件"偏乐观，真实影响面更大（后端 + 前端 + schema + 配置链路全部涉及）。

**缅因猫独有建议：**
- 安全门：自定义 agent CLI 命令白名单与参数校验（开源场景必备）
- 加 1 个 mock agent 集成测试验收架构可扩展性
- F32-a 是否包含前端最小动态兼容需要对齐

**缅因猫三方案评估：**

| 方案 | 描述 | 缅因猫立场 |
|---|---|---|
| A: 一步到位 F32A+B+真实接入 | 代价最大、风险最高 | 不推荐 |
| B: 只做 F32-a + mock 验收 | 投入可控、风险提前清除 | **推荐** |
| C: 完全等到未来再改 | 短期省事、后续膨胀 | 不推荐 |

### 第三轮：铲屎官提问 + 拍板

铲屎官问了一个关键问题：**"现在不做松绑，未来难松绑吗？"**

布偶猫回答：不会。松绑难度不随时间增加，只随硬编码点数量增加。只要新功能不再硬编码猫名，工作量不会膨胀。

缅因猫回答：不是"不能做"，而是"会更痛、更贵、更容易出回归"。建议现在做 F32-a 把硬编码耦合拆掉。

**铲屎官拍板：综合两猫判断，现在开始做 F32-a。**

## 共识结论

1. **当前状态**：AgentService 接口通用，但 CatId + 配置 + 路由 + 前端全面硬编码三猫，不具备插件化能力
2. **分阶段推进**：
   - **F32-a（现在做）**：CatId 松绑 + AgentRegistry + z.enum 动态化 + mock agent 验收
   - **F32-b（后续做）**：配置驱动 + 安全门 + 接入手册。触发条件：真正要接入第四只猫或开源时
3. **不接入真实新猫**：F32-a 用 mock agent 测试验收即可，不需要现在接入 opencode 等
4. **新功能规矩**：从现在起，新功能禁止新增硬编码猫名

## 开放问题（待 F32-a 设计时确认）

1. F32-a 是否包含前端最小动态兼容？（缅因猫提出）
2. CatId `Brand<string>` 后，编译时类型安全如何保证？（需要 registry.has() 运行时校验）
3. 安全门的最小范围是什么？（白名单 CLI 命令 vs 全面沙箱）

## 决策记录

| 决策 | 拍板人 | 理由 |
|---|---|---|
| F32-a 现在做 | 铲屎官 | 综合两猫判断，提前清除硬编码耦合 |
| F32-b 后续做 | 铲屎官 + 布偶猫 | 手册需要实战经验，不急 |
| 不接真实第四猫 | 三方共识 | mock agent 验收足够 |
| 新功能禁止硬编码猫名 | 布偶猫提议，铲屎官同意 | 控制硬编码点增长 |

---

## F32-a 设计文档 Review 过程

铲屎官拍板后，布偶猫编写了 [F32-a 设计文档](../../plans/2026-02-18-f32a-agent-registry-design.md)，缅因猫进行了 4 轮 Review，最终 R4 放行。

### R1: 缅因猫首轮 Review — 3P1 + 2P2

**P1（必须修复）：**

| # | 发现 | 问题本质 | 修复 |
|---|---|---|---|
| P1-1 | 设计文档写 `catConfig.cats`，但实际 cat-config.json 结构是 `{ breeds: [...] }` | 布偶猫凭记忆写错了数据结构 | 改用 `toFlatConfigs(loadCatConfig())` 做 breeds→flat 转换 |
| P1-2 | z.enum 动态化与模块加载时序冲突 | 路由模块在 `index.ts` 顶层 import 时求值，此时 registry 还没初始化。`z.enum([])` 会在模块加载时炸 | 改为 `z.string().refine(catRegistry.has)`，延迟到请求时校验 |
| P1-3 | `createCatId` 放弃集中校验会引入回归 | CatId 从三值 union 变 string 后，旧的编译时校验消失，需要新的运行时校验入口 | 新增 `assertKnownCatId()` 作为强校验入口，`createCatId` 保持轻量语法校验 |

**P2（建议修复）：**

| # | 发现 | 修复 |
|---|---|---|
| P2-1 | 前端边界描述自相矛盾（说"所有消费者"又说"前端待定"） | 明确 F32-a 不改前端，留给 F32-b |
| P2-2 | 全局 singleton 测试隔离未考虑 | 新增 `CatRegistry.reset()` + `AgentRegistry.reset()` 方法 |

**布偶猫反馈**：5 条全部接受。P1-1 是砚砚查了实际代码才发现的，我写设计时确实凭记忆写错了。P1-2 是个会导致启动即崩的严重问题。P1-3 我部分同意——`createCatId` 应保持轻量，但确实需要 `assertKnownCatId` 补位。

### R2: 缅因猫第二轮 Review — 2P1 + 1P2

R1 修复后砚砚继续深挖，发现更隐蔽的问题。

**P1（必须修复）：**

| # | 发现 | 问题本质 | 修复 |
|---|---|---|---|
| R2-P1-1 | 模块级常量 `MENTION_ALIASES`（AgentRouter.ts:46）在 import 时从 CAT_CONFIGS 计算 | 和 P1-2 同类但更隐蔽：不是启动崩，而是静默空结果（registry 还没初始化，读到空 map） | 所有依赖猫列表的模块级常量改为构造期计算，附排查清单 |
| R2-P1-2 | seal-thresholds / workflow-triggers 不在 CatConfig 和 cat-config.json 里 | 设计说"从 registry 读"但 registry 里根本没这些字段，落地会卡住 | 改为 provider-based fallback 策略，不扩展 CatConfig |

**P2（建议修复）：**

| # | 发现 | 修复 |
|---|---|---|
| R2-P2-1 | 验收标准写"z.enum 动态包含"但方案已改为 z.string().refine | 修正措辞 |

**分歧与共识**：布偶猫认为 `assertKnownCatId` 边界化方案足够，砚砚最终接受。布偶猫补充了完整边界清单 + 每条边界的失败测试要求。

### R3: 缅因猫第三轮 Review — 2P1 + 1P2

R2 修复后砚砚发现了逻辑自洽性和架构分层问题。

**P1（必须修复）：**

| # | 发现 | 问题本质 | 修复 |
|---|---|---|---|
| R3-P1-1 | `assertKnownCatId` 在 cat-config 加载阶段自锁 | cat-config 是注册源，在注册之前做"已注册"校验是逻辑矛盾（先有鸡还是先有蛋） | 边界清单拆分"已注册校验"和"注册源校验"两类。注册源只做语法+唯一性校验 |
| R3-P1-2 | `assertKnownCatId` 放在 `ids.ts` 会让基础类型层依赖运行时 registry singleton | ids.ts 应保持纯类型层，不应引入运行时 singleton 依赖，否则有循环依赖风险 | `assertKnownCatId` 从 ids.ts 移到 registry 模块 |

**P2（建议修复）：**

| # | 发现 | 修复 |
|---|---|---|
| R3-P2-1 | `CatRegistry.get()` 契约不一致：定义像"必有值"，示例像"可空 fallback" | 拆为 `getOrThrow()`（边界层用）+ `tryGet()`（配置层 fallback 用） |

**布偶猫反馈**：3 条全部接受。R3-P1-1 是砚砚抓到的逻辑自洽性错误——"注册源不能做已注册校验"，很精准。R3-P1-2 关于架构分层也完全正确。

### R4: 缅因猫放行 ✅

缅因猫确认 R1→R3 共 7P1 + 4P2 全部闭环，设计文档逻辑自洽、时序可落地、边界清晰。

> 砚砚原话摘要："7P1+4P2 全部闭环。设计文档逻辑自洽，时序可落地，边界分明。可以开工了。"

### Review 统计

| 轮次 | P1 | P2 | 总计 |
|---|---|---|---|
| R1 | 3 | 2 | 5 |
| R2 | 2 | 1 | 3 |
| R3 | 2 | 1 | 3 |
| R4 | 0 | 0 | 放行 |
| **合计** | **7** | **4** | **11 → 全部闭环** |

### Review 关键教训

1. **凭记忆写设计文档会出错**（R1-P1-1）：砚砚查了实际代码才发现 `cats` vs `breeds` 的结构差异
2. **模块加载时序是隐蔽杀手**（R1-P1-2 + R2-P1-1）：z.enum 会启动崩，模块级常量会静默空值，必须全面排查
3. **注册源 vs 已注册是不同校验边界**（R3-P1-1）：先有鸡还是先有蛋的逻辑问题
4. **基础类型层不能依赖运行时 singleton**（R3-P1-2）：分层纪律

---

## 关联文档

- [F32-a 设计文档](../../plans/2026-02-18-f32a-agent-registry-design.md)（含完整修订记录）
- [BACKLOG F32 条目](../../BACKLOG.md)
