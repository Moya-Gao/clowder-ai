# 统一审批中心 — 痛点分析与涉及 Feature 梳理

> 起源：F193 Phase E E3 设计讨论中，铲屎官发现审批散落在各 thread 的问题
> 日期：2026-06-20
> 参与：铲屎官 + opus-46（本 thread）
> 状态：痛点收集 → 待本 thread 内讨论（47 / 砚砚）→ 再跨线程找 F168

---

## 1. 痛点

### 痛点 1：审批被困在 Thread 里

铲屎官原话：
> "要是我没看thread呢？ 或者是我在thread a 但是b的猫找我审批呢？"

猫发出审批卡片后，卡片只存在于该 thread 的消息流里。铲屎官必须**主动进入那个 thread** 才能看到。

三个失败场景：

| 铲屎官状态 | 结果 |
|-----------|------|
| 正在看该 thread | ✅ 看到卡片，直接审批 |
| 没在看任何 thread | ❌ 卡片埋没，无人提醒 |
| 在 Thread A，但 Thread B 有审批 | ❌ 看不到 B 的请求 |

### 痛点 2：审批散落在多个 Feature

铲屎官原话：
> "现在f128 和 f225 都有富文本需要我审批的东西笑死但是很多猫可能反馈铲屎官忘记点了！"

不同 feature 各自实现了自己的审批卡片，铲屎官不知道"我总共有多少待批的东西"，也没有一个地方统一看。

### 痛点 3：忘记审批 → 猫被卡住或信息丢失

铲屎官原话：
> "不过这里你们要考虑如果我忘记点击投递了怎么办？哈哈哈 这也不能干扰你们 本thread正常工作"

审批是非阻塞的（猫继续干活），但忘记审批意味着：
- propose_thread：新 thread 永远不被创建
- session_handoff：handoff 永远不发生
- cross_thread_dispatch：异常通知永远不被投递
- community_direction：社区 issue 永远不被路由

### 痛点 4：没有审批中心

铲屎官原话：
> "我感觉这种thread内的点击审批似乎需要有个event中心。。能让我看到 点击跳转到对应thread等等等"

铲屎官需要一个**跨 thread 的审批面板**，汇总所有待批项目，不用逐个 thread 翻。

---

## 2. 涉及的 Feature

### F128 — Cat-Proposed Thread Creation

- **审批类型**：猫提议开新 thread → 铲屎官 approve/reject
- **当前实现**：`propose_thread` MCP tool → 在当前 thread 插入富文本卡片 → 铲屎官点击
- **审批 Store**：ThreadProposal（pending/approved/rejected）
- **就地审批**：✅ 可以（信息自足：thread 标题 + 理由）

### F225 — Cat-Initiated Session Handoff

- **审批类型**：猫提议 session handoff → 铲屎官 approve
- **当前实现**：handoff proposal 卡片 → 铲屎官点击 → session sealed + continuation queued
- **审批 Store**：SessionHandoffProposal（discriminated union，与 ThreadProposal 分离）
- **就地审批**：⚠️ 可能需要看上下文（为什么要 handoff）

### F168 — Community Operations Board

- **审批类型**：守门猫/narrator 分诊社区 issue → Direction Card → 铲屎官 approve 路由
- **当前实现**：**已有 Decision Queue**（Community Panel Phase E, PR #2431）
- **审批 Store**：Decision Queue（per-decision item）
- **就地审批**：✅ 可以（Direction Card 包含推荐 + 理由）
- **特殊**：F168 已经建了一个 scope 在社区的审批队列，是最接近"审批中心"的现有实现

### F193 — Cross-Thread Communication Unification

- **审批类型**：E3 猫检测异常 → 不确定是否该投递 → 卡片让铲屎官确认
- **当前实现**：Phase E E3 未实现
- **审批 Store**：待定
- **就地审批**：⚠️ 任务分配类可能需要上下文

---

## 3. 铲屎官的方向判断

铲屎官原话：
> "我的意思是 这个应该是底座 底座上是f168 193 128 225 这些可能涉及到需要我审批的"

```
统一审批中心（底座 Feature）
├── 审批队列 Store — 统一注册接口
├── Hub "待审批" 面板 — 跨 thread 可见
├── 计数 / 提醒 — 有待批就能看到
└── 跳转 / 就地审批

上层 Feature 注册审批项：
├── F128 propose_thread
├── F225 session_handoff
├── F193 cross_thread_dispatch
└── F168 community_direction（从自建 Queue 迁移）
```

---

## 4. 待讨论问题（本 thread 内先对齐）

### Q1: 底座 scope 与 F168 Decision Queue 的关系

F168 已经建了 Decision Queue（社区 scope）。底座有两条路：
- **A. 泛化 F168 Queue**：把 F168 的 Decision Queue 从社区 scope 扩展为全局 scope
- **B. 新建底座，F168 迁移上来**：独立底座，F168 Queue 作为上层接入

Q: 哪条路更干净？F168 Queue 的数据模型是否通用到可以直接泛化？

### Q2: 就地审批 vs 跳转审批

简单审批（propose_thread：标题+理由自足）→ Hub 里直接批
复杂审批（cross_thread_dispatch：需要看异常上下文）→ 跳转到原 thread

Q: 由卡片注册时声明 `inlineApprovable` 是否合理？还是统一走跳转更简单？

### Q3: 审批过期机制

忘记点击 → 卡片过期 → 然后呢？
- 过期后猫可以重新 propose（带新上下文）？
- 过期后自动降级为 FYI（不投递但标记"铲屎官未响应"）？
- 永不过期，只是提醒频率递增？

### Q4: F193 E3 是等底座还是先做

E3 的"卡片审批"模式需要底座支撑。两条路：
- **先做底座再做 E3**：E3 直接用底座 API
- **E3 先做简单版（thread 内卡片），底座做好后迁移**：不阻塞 F193 进度

### Q5: 新 Feature 编号

底座是跨 feature 基建，需要新开 F 号。铲屎官拍板。

---

## 5. 下一步

1. ✅ 痛点文档（本文件）
2. → 本 thread 内 @opus47 @codex 讨论 Q1-Q5
3. → 收敛后 cross-post F168 thread（opus-48 平行自己）协调 Decision Queue 迁移方向
4. → 铲屎官拍板新 F 号 + E3 时序
