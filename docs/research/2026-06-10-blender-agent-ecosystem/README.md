---
title: "Blender × AI Agent 生态调研"
date: 2026-06-10
authors:
  - 烁烁/Gemini 3.5 Flash 🐾 (初始调研)
  - 砚砚/Codex 🐾 (云端深度调研)
tags: [research, blender, 3d-modeling, mcp, agent, ecosystem]
status: in-progress
---

# Blender × AI Agent 生态调研

> 调研目标：了解 Blender 生态中与 AI Agent 相关的 MCP / CLI / 插件方案，评估猫猫直接做 3D 建模的可行性。

## 目录

- [概览](#概览)
- [烁烁初始调研](#烁烁初始调研)
- [砚砚云端深度调研](#砚砚云端深度调研)
- [集成评估](#集成评估)
- [下一步](#下一步)

---

## 概览

Blender 的 AI Agent 生态已经从"概念验证"进入可用阶段。核心转变：

> **从** "AI 直接吐 3D mesh（三角面汤）" **→** "AI 像操作员一样调用 Blender 的 `bpy` 原生建模工具（干净拓扑）"

### 关键方案

| 方案 | 代表项目 | 成熟度 | 适用场景 |
|------|---------|--------|---------|
| MCP Server | ahujasid/blender-mcp | ⭐⭐⭐⭐ | 实时交互建模 |
| CLI 无头模式 | Blender `-b -P` | ⭐⭐⭐⭐⭐ | 批处理/渲染管线 |
| Agentic 建模 | 3D-Agent | ⭐⭐⭐ | 多模型协作建模 |
| Limb 节点集成 | 待开发 | 💡 概念 | Cat Café 原生集成 |

---

## 烁烁初始调研

> 调研时间：2026-06-10 | 调研猫：烁烁/Gemini 3.5 Flash 🐾

### MCP Server 方案

#### 主流项目

| 项目 | GitHub | 亮点 | 工具数 | 特色 |
|------|--------|------|--------|------|
| **blender-mcp** | `ahujasid/blender-mcp` | 最流行、社区最活跃 | ~20+ | Poly Haven / Sketchfab 资产集成 |
| **blender-open-mcp** | `dhakalnirajan/blender-open-mcp` | Ollama 本地模型 | — | 隐私优先，离线可用 |
| **sandraschi/blender-mcp** | `sandraschi/blender-mcp` | FastMCP 构建，工具最多 | **150+** | Grease Pencil / VRM 头像 / 无头渲染 |
| **dcc-mcp-blender** | `loonghao/dcc-mcp-blender` | 嵌入式 HTTP MCP | — | DCC 生态统一方案 |

#### ahujasid/blender-mcp 能力

- **物体操作** — 创建/修改/删除 3D 对象
- **材质控制** — 应用/修改材质、颜色、shader 节点
- **场景检查** — AI 可以"看到"视口截图
- **灯光与相机** — 调整光照、相机角度
- **任意 Python 执行** — 可跑自定义 `bpy` 脚本
- **外部资产** — Poly Haven / Sketchfab / Hunyuan3D / Hyper3D Rodin

#### 配置方式

```json
{
  "mcpServers": {
    "blender": {
      "command": "uvx",
      "args": ["blender-mcp"]
    }
  }
}
```

### CLI 无头模式

```bash
blender -b scene.blend -P build_model.py
blender -b -P script.py -- --shape cube --size 2.5
```

### Agentic 建模（3D-Agent）

Perceive → Reason → Act → Verify 循环：

- **视觉评审** — Gemini / VLM（暹罗猫）
- **推理规划** — Claude（布偶猫）
- **精确代码执行** — GPT / Code Model（缅因猫）

### 与 Cat Café 集成可能性

- **方案 A：MCP 直挂** — `blender-mcp` → Cat Café MCP Server 列表
- **方案 B：Limb 节点** — Blender 包装成 Limb 节点
- **方案 C：CLI 管线** — 生成 .py → `blender -b -P` 执行

---

## 砚砚云端深度调研

> 调研时间：2026-06-10 | 调研猫：砚砚/GPT-5.5 🐾（云端 ChatGPT 对话）

<!-- 砚砚调研报告开始 -->

知道，而且这条路现在很值得玩，喵 🐾 Blender 生态本来就是“开源 3D 创作套件 + Python 可编程引擎 + 插件/资产市场”的组合；MCP/agent 出现后，它又多了一层“让 AI 通过工具调用去操控 Blender”的神经接口。

核心先抓住一句话：**MCP 不是建模引擎，Blender 才是建模引擎；MCP 是让 agent 能安全地、结构化地调用 Blender 能力的插头。** MCP 官方定义里，server 可以把“工具”暴露给语言模型调用，用来操作外部系统、计算、查询 API 等；放到 Blender 里，这个外部系统就是 Blender 的 Python API、场景、材质、相机、灯光、文件导出这些东西。([Model Context Protocol][1])

Blender 自己的生态可以分成几层：第一层是创作本体，建模、雕刻、UV、材质、骨骼、动画、模拟、渲染、合成、Grease Pencil、Geometry Nodes。第二层是 `bpy` Python API，也就是 agent 真正能“下爪子”的地方，几乎所有建模、材质、场景组织、批处理都可以用脚本驱动。第三层是 Geometry Nodes 和 Asset Browser，适合做可复用、程序化、参数化资产。第四层是插件和资产生态，现在 Blender 官方也有 Extensions 平台，用来分发开源 add-ons 和 themes。([Blender 文档][2])

版本上，截至 2026 年 6 月 10 日，Blender 官网下载页显示 5.1 是当前主线下载方向；4.5 LTS 仍然很适合稳妥生产，它是 4 系列最后一个 LTS，官方支持到 2027 年 7 月。做 agent 建模我会偏向两种选择：想稳就 4.5 LTS，想跟新功能就 5.1。([blender.org][3])

agent/MCP 这一支，现在主要有三条路。

第一条是 **Blender 官方 Lab MCP Server**。Blender 官网 Lab 页面描述它是一个轻量 MCP server，提供面向 Blender Python API 的自然语言接口，帮助访问文档和理解复杂设置。它更像官方试验田里的“bpy 翻译猫”，适合关注正统、轻量、贴近 Blender API 的路线。([blender.org][4])

第二条是社区里很火的 **`ahujasid/blender-mcp`**。这个项目的 README 写得很清楚：它把 Blender 连接到 Claude AI/MCP，让 AI 能直接交互和控制 Blender，用于 prompt-assisted 3D 建模、场景创建和操作。它由两部分组成：Blender add-on 在 Blender 里开 socket server，MCP server 则实现协议并连接到这个 add-on。功能包括创建/修改/删除物体、材质控制、场景检查，以及通过 Claude 在 Blender 里执行 Python 代码。([GitHub][5])

它现在不只是“让 AI 加个 cube”那么简单。社区仓库显示当前版本 1.5.5 加了 Hunyuan3D、Blender viewport 截图、Sketchfab 搜索下载、Poly Haven API、Hyper3D Rodin 生成资产、远程 host 等功能。换句话说，它正在从“AI 调 bpy”扩展成“AI 调 bpy + 调资产库 + 调 3D 生成服务 + 看视口反馈”的小型 3D agent 工作台。([GitHub][5])

第三条是 **本地模型路线**，例如 `blender-open-mcp`。它把 MCP client，FastMCP server，Blender add-on，Ollama 串起来，让 Claude、Cursor 或其他 MCP client 能通过本地 Ollama 模型控制 Blender。它的架构说明里写的是：MCP Client/CLI 通过 HTTP 或 stdio 到 FastMCP Server，再通过 TCP socket 到 Blender add-on，同时可以调用 Ollama。这个适合你想把“猫猫工坊”尽量本地化，不想所有建模意图都经过云端模型。([GitHub][6])

如果你说的是“让我通过 CLI 去做建模”，现在最贴近的是 **Codex CLI + Blender MCP**。OpenAI 的 Codex 文档说明，Codex 可以通过 `codex mcp` 添加和管理 MCP servers，配置存在 `~/.codex/config.toml`，CLI 和 IDE extension 共享这套配置；也可以在 TUI 里用 `/mcp` 查看活跃 MCP server。([OpenAI 开发者][7])

一个大致配置会像这样：

```toml
[mcp_servers.blender]
command = "uvx"
args = ["blender-mcp"]

[mcp_servers.blender.env]
BLENDER_HOST = "localhost"
BLENDER_PORT = "9876"
```

这个配置形式也已经有人在 `blender-mcp` 的 GitHub discussion 里验证用于 Codex CLI：`command = "uvx"`，`args = ["blender-mcp"]`，再设置 `BLENDER_HOST` 和 `BLENDER_PORT`。([GitHub][8])

也可以走 Codex CLI 命令风格，大概是：

```bash
codex mcp add blender \
  --env BLENDER_HOST=localhost \
  --env BLENDER_PORT=9876 \
  -- uvx blender-mcp
```

然后启动 Blender，安装并启用 Blender MCP add-on，让它监听本地端口。之后 agent 的链路就是：

```text
你：做一个赛博猫咖低多边形场景
        ↓
Codex / Claude / Cursor / 其他 MCP client
        ↓
blender-mcp server, 通常 uvx 启动
        ↓
Blender add-on, localhost socket
        ↓
bpy / Blender Python API
        ↓
场景里长出墙、桌子、猫爬架、灯光、材质、相机
```

在普通 ChatGPT 对话里，我此刻没有连到你的本地 Blender，所以不能直接伸爪改你的视口。但如果你在 MCP-capable host 里把 Blender MCP 接好，agent 就能调用工具去建模。ChatGPT 这边也已经有 MCP 相关路线，OpenAI 文档提到可以用 MCP 构建 ChatGPT apps，让 ChatGPT 调用 approved tools；ChatGPT developer mode 也支持测试和部署带写入/修改动作的 MCP-powered apps，不过这个更偏 workspace/app 路线，本地 Blender 创作目前通常还是 Codex CLI、Claude Desktop、Cursor、VS Code/Roo Cline 这类本地 MCP host 更顺手。([OpenAI Help Center][9])

实际能做什么？很适合这些：程序化建模，blockout，建筑草模，低多边形道具，硬表面小物件，场景摆放，批量改名，材质分配，灯光/相机设置，简单动画，导出 glTF/FBX/OBJ/USD，生成 Blender Python 脚本，做 Geometry Nodes 原型。它不太擅长一次性做出高质量有机角色、干净生产级拓扑、复杂 UV、精雕级造型，那里还是需要艺术家检查和返工。换句话说，它是“会开挖掘机的猫”，不是“全自动米开朗基罗猫” 🐈‍⬛

最推荐的玩法不是让 agent 一口气“做个超复杂世界”，而是分层命令：

```text
1. 先创建场景结构：地面、墙体、主要家具，用清晰命名。
2. 给所有物体添加基础材质：木头、金属、玻璃、布料、霓虹。
3. 添加猫咖主题元素：猫爬架、吧台、菜单牌、窗边座位。
4. 设置相机和灯光，渲染一个预览。
5. 截图检查构图，修正比例和密度。
6. 保存 blend 文件，并导出 glTF。
```

给 agent 的 prompt 最好写得像施工图，而不是许愿瓶。例如：

```text
Use Blender MCP to create a low-poly isometric cat cafe scene.
Requirements:
- Name every object clearly.
- Use simple procedural geometry, not imported paid assets.
- Create separate collections: Architecture, Furniture, Cats, Lighting, Camera.
- Add 3 Maine Coon inspired cats as stylized low-poly shapes.
- Use warm wood materials, soft neon sign, and large windows.
- Set camera to orthographic isometric view.
- Save the file as cat_cafe_blockout.blend.
After each major step, inspect the scene and fix scale issues.
```

这类 prompt 对 agent 特别友好，因为它能把任务拆成可执行的 bpy 操作，不容易在 3D 草丛里迷路。

安全上要认真一点，猫砂盆要盖好。`blender-mcp` 明确支持在 Blender 里执行 arbitrary Python code，这很强，也意味着它有本地代码执行能力。MCP 生态在 2026 年也出现过关于 stdio/命令执行边界的安全讨论和披露，所以本地建模时建议只用可信 MCP server，只监听 localhost，不随便开 remote host，不把端口暴露到公网，安装前看仓库和源码，重要项目先备份，别让不可信网页或 prompt 改你的 MCP 配置。([GitHub][5])

我的判断是：**Blender + MCP 会成为 AI 3D 工作流里最实用的一条路线**。不是因为它能像文生 3D 模型那样一键吐出神奇雕像，而是因为它产出的东西是可编辑的：对象有名字，材质可改，脚本可复现，节点可调，文件能继续进传统管线。对共创来说，这比“一坨黑箱 mesh”更像真正的工作伙伴。

最顺滑的起步组合：**Blender 4.5 LTS 或 5.1 + `ahujasid/blender-mcp` + Codex CLI/Cursor/Claude Desktop + 一个小型资产库 + 逐步式 prompt**。这样就能让 agent 先当场景搭建猫，再慢慢进化成程序化建模猫、材质猫、灯光猫，最后成为猫咖宇宙的 3D 工程喵。

[1]: https://modelcontextprotocol.io/specification/2025-06-18/server/tools?utm_source=chatgpt.com "Tools"
[2]: https://docs.blender.org/api/current/index.html?utm_source=chatgpt.com "Blender Python API"
[3]: https://www.blender.org/download/?utm_source=chatgpt.com "Download — Blender"
[4]: https://www.blender.org/lab/mcp-server/?utm_source=chatgpt.com "MCP Server"
[5]: https://github.com/ahujasid/blender-mcp "GitHub - ahujasid/blender-mcp · GitHub"
[6]: https://github.com/dhakalnirajan/blender-open-mcp "GitHub - dhakalnirajan/blender-open-mcp: Open Models MCP for Blender Using Ollama · GitHub"
[7]: https://developers.openai.com/codex/mcp?utm_source=chatgpt.com "Model Context Protocol – Codex"
[8]: https://github.com/ahujasid/blender-mcp/discussions/158 "Works with Codex CLI from Chat GPT · ahujasid blender-mcp · Discussion #158 · GitHub"
[9]: https://help.openai.com/en/articles/11487775-connectors-in-chatgpt?utm_source=chatgpt.com "Apps in ChatGPT"

<!-- 砚砚调研报告结束 -->

---

## 集成评估

> 待砚砚报告补充后，综合评估最佳集成方案。

### 评估维度

- [ ] MCP Server 稳定性 & 维护活跃度
- [ ] 安全性（任意代码执行风险）
- [ ] 与 Cat Café 现有架构的契合度
- [ ] 多猫协作建模的可行性
- [ ] 产出质量（拓扑、可编辑性）

---

## 下一步

- [x] 粘贴砚砚云端调研报告
- [ ] 综合两份调研，确定推荐方案
- [ ] 如果决定集成：提 Feature 立项

---

*[烁烁/Gemini 3.5 Flash🐾]*
