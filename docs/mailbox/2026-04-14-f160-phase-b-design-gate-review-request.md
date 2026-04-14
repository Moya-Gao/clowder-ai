# Review Request: F160 Phase B — Task Board UX / Design Gate

Review-Target-ID: f160-phase-b-design-gate
Branch: main

## What

新增 F160 Phase B 的 Pencil 设计稿：

- `designs/F160-task-board-phase-b-ux.pen`

设计稿包含 4 个画面：

1. 主视图：Workspace 右栏中的毛线球任务板
2. 新建展开：inline composer 创建新任务
3. 空状态：解释何时该用毛线球
4. Design Gate 注释板：记录本轮 UX 决策

## Why

Phase A 已经证明毛线球能被猫主动使用，但 UI 仍然埋在 ThreadSidebar 底部，存在感太低，也没有把“谁能创建、什么时候该用、和猫猫祟祟怎么分工”说清楚。Phase B 先做 Design Gate，把这些关键认知直接固化进界面，再进入实现。

## Original Requirements

> "为什么一个东西有两个展示的地方？"
> "我都忘记我们毛线球是不是 ux 画好了？得先画一下 ux？"
> "我看了一下你的设计 你是希望 我可以创建毛线球 然后你们也可以？"

- 来源：F160 thread 中铲屎官 2026-04-11 ~ 2026-04-14 连续反馈
- Feature spec: `docs/features/F160-task-board-upgrade.md`

## Tradeoff

- 选择把 `任务` 放在 Workspace 的 mode pill 层，和 `开发 / 记忆 / 调度` 同级，而不是塞进 Files/Changes/Git 这类开发 tabs 里。
- 主视图默认展开 `doing / blocked`，把 `todo / done` 折叠，优先回答“现在卡在哪”，代价是一次看不到全部列表。
- 创建入口选择 inline composer，不开 modal。优点是上下文连续，代价是右栏高度会被表单暂时占用。

## Open Questions

1. 毛线球 tab 的最终 SVG 图标还没精修，目前只是 UX 占位。
2. `todo / done` 的默认折叠是否要记忆用户偏好，还是保持固定默认值。

## Next Action

请从 Design Gate 角度判断这版是否可以直接进入前端实现。

重点看三件事：

1. 信息架构是否清楚区分了毛线球 / 猫猫祟祟 / Mission Hub
2. “铲屎官和猫猫都可创建”这层定位是否已经被 UI 文案说清
3. Workspace 右栏的接入层级是否合理

## 设计结论（本轮拟定）

1. `任务` 放在 Workspace mode pill 层，作为 thread 级持久面板
2. `doing / blocked` 默认展开，`todo / done` 默认折叠
3. 铲屎官可手动创建，猫猫也可在需要长期跟踪时创建
4. 临时执行步骤继续留在猫猫祟祟，不混到毛线球里

## 交付物

- Design file: `designs/F160-task-board-phase-b-ux.pen`
- 当前画面：主视图 / 新建展开 / 空状态 / 注释板

