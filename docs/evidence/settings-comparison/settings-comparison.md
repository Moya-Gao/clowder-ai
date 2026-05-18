# Settings 页面对比：Cat Cafe vs Open-Source (Clowder AI)

> 截图时间：2026-05-18 | 视口：1440x900
> Cat Cafe runtime: localhost:3001 | Open-source: localhost:3003
> 注意：Cat Cafe runtime 尚未包含 PR #1758 的 token 迁移（截图时未重启）

## 截图索引

| # | 页面 | Cat Cafe | Open-Source |
|---|------|----------|-------------|
| 01 | 成员管理 | [ours-01-members.png](ours-01-members.png) | [opensource-01-members.png](opensource-01-members.png) |
| 02 | 账户与密钥 | [ours-02-accounts.png](ours-02-accounts.png) | [opensource-02-accounts.png](opensource-02-accounts.png) |
| 03 | IM 对接 | [ours-03-im.png](ours-03-im.png) | [opensource-03-im.png](opensource-03-im.png) |
| 04 | Skill 管理 | [ours-04-skills.png](ours-04-skills.png) | [opensource-04-skills.png](opensource-04-skills.png) |
| 05 | MCP 管理 | [ours-05-mcp.png](ours-05-mcp.png) | [opensource-05-mcp.png](opensource-05-mcp.png) |
| 06 | 插件/集成 | [ours-06-plugins.png](ours-06-plugins.png) | [opensource-06-plugins.png](opensource-06-plugins.png) |
| 07 | 能力市场 | [ours-07-marketplace.png](ours-07-marketplace.png) | [opensource-07-marketplace.png](opensource-07-marketplace.png) |
| 08 | 语音管理 | [ours-08-voice.png](ours-08-voice.png) | [opensource-08-voice.png](opensource-08-voice.png) |
| 09 | 系统配置 | [ours-09-system.png](ours-09-system.png) | [opensource-09-system.png](opensource-09-system.png) |
| 10 | 规则与 SOP | [ours-10-rules.png](ours-10-rules.png) | [opensource-10-rules.png](opensource-10-rules.png) |
| 11 | 通知 | [ours-11-notify.png](ours-11-notify.png) | [opensource-11-notify.png](opensource-11-notify.png) |
| 12 | 运维监控 | [ours-12-ops.png](ours-12-ops.png) | [opensource-12-ops.png](opensource-12-ops.png) |

---

## 逐页对比

### 01 成员管理

| 维度 | Cat Cafe | Open-Source |
|------|----------|-------------|
| 筛选栏 | 有「全部/已启用/已停用/CLI(OAuth)/CLI(配置)」筛选 tabs | 无筛选 |
| Owner 卡片 | 粉色高亮背景，显示别名列表 | 普通灰底卡片 |
| 成员卡片 | 显示模型/账号/@ 句柄/Session Chain 状态，带「已启用/停用成员」按钮 | 仅显示名称+角色 |
| 默认猫选择器 | 有「全局默认猫」下拉 | 有，但显示"当前默认猫不可用" |
| 信息密度 | 高（每张卡片 3-4 行信息） | 低（每张卡片 1-2 行） |

**定制原因**：多猫协作需要精细的成员状态管理（启用/停用、Session Chain、@ 路由）。

---

### 02 账户与密钥

| 维度 | Cat Cafe | Open-Source |
|------|----------|-------------|
| 卡片展开 | 默认展开，显示可用模型 chips | 折叠列表，仅名称+类型 |
| 模型 chips | 每个账户下方有彩色模型标签（可增删） | 无 |
| 拖拽排序 | 有（⠿ 手柄） | 有（⠿ 手柄） |
| 面包屑 | 有「系统配置 > 账号配置」链接 | 无，显示存储路径 |
| 类型标签 | 橙色 `oauth` badge | 无彩色 badge |

**定制原因**：多供应商多模型管理（Claude/Codex/Gemini/Dare 各有不同模型池）需要在账户层可视化模型绑定。

---

### 03 IM 对接

两侧布局基本一致（企微/飞书/Slack/Discord/Telegram 渠道卡片）。

| 维度 | Cat Cafe | Open-Source |
|------|----------|-------------|
| 渠道数量 | 相同 | 相同 |
| 画风 | 一致 | 一致 |

**差异极小**，IM 对接是功能性页面，未做定制化。

---

### 04 Skill 管理

| 维度 | Cat Cafe | Open-Source |
|------|----------|-------------|
| 状态栏 | 绿色「挂载正常 · 注册一致」状态条 | 无状态条 |
| 分类 tabs | 「全部/开发流程链」分组 | 无分组 |
| 搜索 | 有搜索框 | 无 |
| 字母 badge | 每个 skill 左侧有彩色首字母圆形 | 无 |
| 全部挂载按钮 | 每行有「全部挂载」快捷操作 | 无 |
| 描述信息 | 显示触发关键词 + 分类标签 | 显示完整 skill 描述 |

**定制原因**：开发流程链 SOP 要求快速切换 skill 挂载状态；状态条是运维自检。

---

### 05 MCP 管理

| 维度 | Cat Cafe | Open-Source |
|------|----------|-------------|
| 状态指示器 | 绿色/红色连接状态圆点 | 类似 |
| 工具数量标签 | 显示「N tools」 | 类似 |
| 布局 | 基本一致 | 基本一致 |

**差异较小**，MCP 管理布局高度一致。

---

### 06 插件/集成

两侧布局基本一致（插件列表+开关）。

| 维度 | Cat Cafe | Open-Source |
|------|----------|-------------|
| 插件列表 | 相同结构 | 相同结构 |

**差异极小**。

---

### 07 能力市场

| 维度 | Cat Cafe | Open-Source |
|------|----------|-------------|
| 内容 | 市场能力列表/卡片 | 相同结构 |

**差异较小**，两侧都是市场展示。

---

### 08 语音管理

| 维度 | Cat Cafe | Open-Source |
|------|----------|-------------|
| 布局 | 语音引擎选择+参数配置 | 相同结构 |

**差异较小**。

---

### 09 系统配置

| 维度 | Cat Cafe | Open-Source |
|------|----------|-------------|
| 面包屑 | 有「系统配置 > 环境 & 文件」链接 | 无面包屑 |
| 分区标题 | 「环境变量」+绿色提示条 | 「运行时配置」 |
| 变量分类 | 「服务器 28」带数量 tab | 「服务器 28」带数量 tab |
| 状态圆点 | 绿/黄/红圆点标识变量状态 | 绿/黄圆点 |
| 输入框 | 右侧有内联编辑输入框 | 右侧有内联编辑输入框 |
| 只读提示 | 有「只读变量（认证类）/（仅启动时生效）」标注 | 无 |
| 配置文件区 | 有独立「配置文件」section（.env 编辑器等） | 无配置文件 section |

**定制原因**：多实例部署（runtime/alpha/worktree）需要精细的环境变量管控；只读/启动时标注防止误改。

---

### 10 规则与 SOP

| 维度 | Cat Cafe | Open-Source |
|------|----------|-------------|
| 布局结构 | 规则编辑器+SOP 面板 | 相同结构 |

**差异较小**。

---

### 11 通知

| 维度 | Cat Cafe | Open-Source |
|------|----------|-------------|
| 布局 | 通知渠道配置 | 相同结构 |

**差异较小**。

---

### 12 运维监控

| 维度 | Cat Cafe | Open-Source |
|------|----------|-------------|
| 布局 | 运维面板 | 相同结构 |

**差异较小**。

---

## 总结：为什么不统一？

### 高定制页面（差异显著）

| 页面 | 定制方向 | 根因 |
|------|---------|------|
| **成员管理** | 多猫状态/筛选/Session Chain/@ 路由 | 多猫协作是 Cat Cafe 核心差异化功能 |
| **账户与密钥** | 模型 chips 展开/类型 badge/面包屑 | 多供应商多模型精细管控 |
| **Skill 管理** | 状态条/分组/搜索/首字母 badge/全部挂载 | 开发 SOP 链需要快速切换 |
| **系统配置** | 面包屑/变量状态标注/配置文件编辑 | 多实例部署（runtime/alpha/worktree） |

### 低定制页面（基本一致）

IM 对接、MCP 管理、插件/集成、能力市场、语音管理、规则与 SOP、通知、运维监控 —— 这些页面是通用功能，无需特化。

### 画风不统一的根因

1. **增量定制**：高定制页面是按需求逐个改的，没有统一的设计规范约束
2. **按钮/卡片风格不一致**：成员管理用「已启用/停用成员」双按钮，账户用展开卡片+chips，Skill 用开关+全部挂载——三种不同的交互模式
3. **信息层级不统一**：有些页面有面包屑，有些没有；有些有状态条，有些没有
4. **色彩系统碎片化**：PR #1758 已将 hardcoded hex 迁移到 semantic tokens，但组件级的视觉语言（卡片形态、按钮样式、信息密度）仍需统一设计

### 建议方向

- 先定义 Settings 页面的**通用组件库**（Section Card / Status Bar / Filter Tabs / Action Buttons）
- 以 open-source 的简洁画风为基线，在此之上叠加 Cat Cafe 独有功能
- 避免"每个页面自己发明交互模式"
