# Cat Cafe 全员 LSP 化：OpenCode / LSP-as-MCP / Codex CLI skills 调研简报

日期：2026-02-16（America/Los_Angeles）  
作者：砚砚（缅因猫🐾）

## TL;DR（结论先行）

- **OpenCode（opencode）是“内置 LSP 客户端 + 内置 LSP server 管理”的路线**：按文件类型自动选择/启动 LSP server，并把 diagnostics 等语义信号喂给 agent；这不是靠 MCP 插件实现的。
- **“LSP-as-MCP-server” 有现成轮子，而且不止一个**：把任意 stdio 的 language server（例如 `typescript-language-server`）包一层 MCP server，然后任何支持 MCP 的 agent（包括 Codex CLI）都能拿到 definition/references/diagnostics/rename 等语义能力。
- 现成轮子里我建议优先看两类：
  1) **通用代理型**（跑任意 LSP）：`isaacphi/mcp-language-server`（Go，功能覆盖 definition/references/diagnostics/hover/rename/edit_file，含 TypeScript 配置示例）
  2) **“大而全”的 LSP bridge**：`axivo/mcp-lsp`（Node/TS，工具覆盖面非常广，含 diagnostics / code actions / formatting / rename 预览等，支持多语言 & 多 project 配置）
- **Codex CLI 的 skills 机制可以用来“引导 + 自动化配置 + 约束工作流”，但不等于内置 LSP 客户端**：真正的 LSP 语义能力建议通过 **MCP 连接 LSP-MCP server** 注入；skill 负责让 agent 稳定、系统地用这些工具。

---

## 1) OpenCode 的 LSP 集成方案：怎么做的？能给 Codex 借鉴吗？

### OpenCode 是内置还是插件/MCP？

- OpenCode 文档明确写了 **“Built-in LSP support”**：
  - 自动按语言/文件扩展名使用合适的 language server；缺失时会回退到 text-based 工具。
  - LSP server 列表（TS/JS、Python、Go、Rust、C/C++ 等）直接在官方 docs 里维护。
- 同时它还有一个 **experimental 的 `lsp` tool**，把部分 LSP 能力显式暴露为“可调用工具”（除了默认会用 diagnostics 反馈给 agent）。

一句话：**OpenCode 的 LSP 是“核心能力”，不是靠 MCP 插件补出来的**。

### OpenCode 具体做法（抽象层面）

从文档/实现描述来看，它基本做了 IDE 客户端会做的一整套：

- 识别 workspace 与文件类型，选择/启动对应 LSP server
- 与 LSP server 走 JSON-RPC（通常 stdio）
- 维护文档同步（didOpen/didChange/didSave）
- 读取并利用 `publishDiagnostics`，以及在需要时调用 definition/references/hover 等语义查询

### 能给 Codex CLI 借鉴吗？

- **能借鉴架构与体验，但需要“在 Codex CLI 内实现 LSP 客户端/管理器”** 才能做到 OpenCode 那种无缝。
- 现实一点的路线：Codex CLI 当前没有内置 LSP 客户端，但它支持 MCP，所以更像是：
  - **用 LSP-as-MCP-server 先把能力补齐**
  - 再用 skill 去逼近“像内置一样好用”的体验（自动检测/自动跑 diagnostics/强制在改代码前问 definition 等）

> 旁证：openai/codex 里已经有人提了 “Built-in LSP integration (auto-detect + auto-install)” 的 feature request（2026-01-05）。这也说明目前 CLI 侧确实还没做到内置。  

---

## 2) 有没有通用的 “LSP-as-MCP-server” 方案？（包装 typescript-language-server）

有，而且思路很统一：

### 通用方案的标准形态

- **MCP server 进程**（stdio 或 HTTP/SSE）
- **内部 spawn/管理一个或多个 LSP server**（基本要求：LSP 走 stdio，或者 wrapper 能适配）
- **把关键 LSP 方法映射成 MCP tools**，常见 mapping：
  - diagnostics：收 `textDocument/publishDiagnostics`，并提供 `get_diagnostics` 类工具
  - go-to-definition：`textDocument/definition`
  - find-references：`textDocument/references`
  - hover / signatureHelp / completion
  - rename-symbol：`textDocument/rename`（返回 WorkspaceEdit），再由 MCP server 或客户端应用 edit
  - code actions：`textDocument/codeAction`（可选）

### 对 Codex 侧的好处

- Codex 不用内置 LSP 客户端，也不用理解 LSP JSON-RPC 的细节
- Codex 只要会 MCP：工具列表 + 结构化输入输出
- 同一套 LSP-MCP server 可以同时服务 Claude Code / Codex / Gemini CLI 等

---

## 3) 有没有现成的 LSP MCP server 项目（GitHub 轮子盘点）

下面按“可直接上车程度”排序。

### A. 通用代理型（推荐优先试）

#### 1) isaacphi/mcp-language-server（Go）

- 定位：**“proxy any stdio-based LSP”**，把 LSP 语义能力暴露成 MCP tools。
- 工具覆盖：`definition` / `references` / `diagnostics` / `hover` / `rename_symbol` / `edit_file`。
- README 里有 **TypeScript（typescript-language-server）配置示例**：
  - `--workspace <path>`
  - `--lsp typescript-language-server -- --stdio`
- 适合：
  - 想要“最短路径”让 Codex/Claude 拿到 definition/references/diagnostics/rename
  - 希望简单、单语言/单 workspace 一把梭

潜在限制：
- 主要目标是“代理 LSP”，工具面不算海量，但对我们关心的“全套导航+诊断+rename”已够用。

#### 2) axivo/mcp-lsp（Node/TypeScript）

- 定位：**“大而全”的 LSP bridge**，覆盖面远超最小集。
- README 列的工具非常多：
  - hover/definition/references/implementations/type definitions
  - completions/signature/inlay hints
  - diagnostics
  - formatting / range formatting
  - code actions
  - symbol rename（提供 rename 影响范围的 WorkspaceEdit 预览）
  - 还包含 server lifecycle / project 管理能力
- 配置方式：通过 `LSP_FILE_PATH` 指向一个 JSON（列出语言 server、extensions、projects 等）。
- 适合：
  - monorepo、多 project、多语言
  - 想让 agent 拥有接近 IDE 的全量工具箱

注意：它的“rename”在 README 里强调的是 **preview WorkspaceEdit**，实际应用 edits 的环节可能需要交给 Codex 自己的文件编辑能力或该 server 的额外工具。

### B. 其他通用/半通用项目（备用/补充）

#### 3) Tritlo/lsp-mcp（Node）

- 定位：通用 LSP-MCP server（README 写到 TypeScript LSP integration tests）。
- 看起来至少覆盖 hover、completions、diagnostics、code actions（从测试描述可见）。

#### 4) nzrsky/lsp-mcp-server（Zig）

- 定位：高性能 bridge（安装渠道非常全：brew/apt/npm/docker 等）。
- README 的 config 示例里默认开启的是 `hover` / `definition` / `completion`。
- 如果你追求“轻量、好装、稳定桥接”，它很香；但就目前 README 暗示的 tool 范围，**可能还没覆盖 rename/references/diagnostics**。

### C. TypeScript 专用（如果你只想先把 TS 跑通）

#### 5) jaenster/ts-lsp-mcp

- 定位：给 AI agent “TypeScript IDE 超能力”。
- 工具：getTypeAtPosition / getDefinition / getReferences / getHover / getCompletions / getDiagnostics 等。
- 支持 stdio；也支持 HTTP/SSE 模式（便于远端/调试）。

#### 6) jgauffin/ts-language-mcp

- 定位：直接把 TypeScript compiler intelligence 通过 MCP 暴露（强调减少 token、提高准确性）。
- 功能描述里包含 definition/references/rename/formatting/diagnostics 等方向。

### D. “借 VSCode 当 LSP 客户端”的路线（有时很好用）

#### 7) VSCode extension: CJL.lsp-mcp

- 定位：**把 VSCode 的 LSP 能力通过 MCP 暴露**。
- 适用场景：
  - 你已经在用 VSCode
  - 你希望利用 VSCode 已经跑起来/配置好的 language server（尤其复杂语言）

代价：
- 依赖 VSCode 常驻/插件生态；更像“外置 IDE 后端”。

---

## 4) Codex CLI 的 skills 机制：能用来集成 LSP 吗？

### 先讲清楚：skills ≠ 新增底层协议能力

Codex 的 **skills** 是“指令 + 资源 + 可选脚本”的包装，用来让 agent 更稳定地执行 workflow（按需加载 SKILL.md，减少上下文占用）。

它本身不会让 Codex 突然学会 LSP JSON-RPC。

### 但 skills 可以这样“把 LSP 用起来”

因为 Codex CLI **支持 MCP servers（stdio 与 streamable HTTP）**，而 LSP-as-MCP-server 正好是一类 MCP server。

所以最实用的组合是：

1) **MCP 层接入 LSP-MCP server**（例如 `mcp-language-server` / `mcp-lsp` / `ts-lsp-mcp`）
2) **skill 负责：**
   - 检测/提示 MCP server 是否已配置（比如教 agent 跑 `codex mcp list`）
   - 约束 workflow（每次改 TS 之前先 `definition` / 改完必跑 `diagnostics`）
   - 把 rename 流程标准化（先 `rename_symbol` 拿 WorkspaceEdit，再批量 apply）
   - 在 monorepo 场景里选择正确 project/tsconfig（如果用 `mcp-lsp` 这类支持 project 的 server）

### Codex 侧接入 MCP 的关键点（配置层面）

- Codex CLI 可用 `codex mcp add ...` 管理 MCP servers
- MCP 配置默认在 `~/.codex/config.toml`，也支持 project-scoped `.codex/config.toml`（受信任项目）

---

## 建议落地路径（Cat Cafe 实操版）

### 路线 1：最快跑通“全猫通用 LSP”（推荐起步）

1. 选 `mcp-language-server`（通用代理，rename/refs/diagnostics 都有）
2. 在 Codex 里配置成一个 MCP server
3. 写一个 repo skill：
   - 规定“每次编辑后跑 diagnostics”
   - 规定“跨文件改动要用 references/rename，不准 grep 手搓”

### 路线 2：想要“IDE 全家桶”工具（多语言/多 project）

- 选 `axivo/mcp-lsp`
- 配好 `lsp.json`（语言 servers + projects）
- 让 skill 负责“选择 project + 使用工具链”

### 路线 3：TS 优先，先把布偶猫打造成 TypeScript 猫王👑

- 直接上 `ts-lsp-mcp`
- 后续再用通用代理覆盖其他语言

---

## 附：参考项目（快速链接清单）

- OpenCode LSP docs：LSP Servers + Tools（Built-in + experimental tool）
- `isaacphi/mcp-language-server`（通用代理，含 TS 示例，rename/refs/diagnostics）
- `axivo/mcp-lsp`（工具覆盖面很广，含 diagnostics / code actions / formatting / rename preview）
- `Tritlo/lsp-mcp`（Node，带 TS LSP 集成测试）
- `nzrsky/lsp-mcp-server`（Zig bridge，安装渠道全）
- `jaenster/ts-lsp-mcp`、`jgauffin/ts-language-mcp`（TS 专用）
- VSCode extension `CJL.lsp-mcp`（借 VSCode 的 LSP 能力）


---

## 附：Codex CLI 侧的最小配置示例（config.toml）

> 说明：Codex MCP 默认读 `~/.codex/config.toml`，也可用项目内 `.codex/config.toml`。Codex 也提供 `codex mcp add ...` 命令来写入配置。

### 方案 A：mcp-language-server + typescript-language-server（最短路径）

```toml
[mcp_servers.ts_lsp]
command = "mcp-language-server"
args = [
  "--workspace", "/ABS/PATH/TO/REPO",
  "--lsp", "typescript-language-server",
  "--", "--stdio",
]
# 如有需要可以补 env，比如 PATH
# env = { PATH = "/opt/homebrew/bin:/usr/local/bin:..." }
```

前置安装（示意）：
- `go install github.com/isaacphi/mcp-language-server@latest`
- `npm install -g typescript typescript-language-server`

### 方案 B：axivo/mcp-lsp（全家桶，多语言/多 project）

```toml
[mcp_servers.lsp]
command = "npx"
args = ["-y", "@axivo/mcp-lsp"]
env = { LSP_FILE_PATH = "/ABS/PATH/TO/lsp.json" }
```

`lsp.json`（简化示意，真实配置见项目提供的 sample）：

```json
{
  "servers": {
    "typescript": {
      "command": "typescript-language-server",
      "args": ["--stdio"],
      "extensions": [".ts", ".tsx", ".js", ".jsx"],
      "projects": [
        { "name": "repo", "path": "/ABS/PATH/TO/REPO" }
      ]
    }
  }
}
```

### 方案 C：ts-lsp-mcp（TS 专用，直接给 TypeScript 语义能力）

```toml
[mcp_servers.ts_lsp_mcp]
command = "npx"
args = ["-y", "ts-lsp-mcp", "serve", "--stdio"]
```

---

## 5) 布偶猫补充：三方对比 + JetBrains MCP + 落地决策

> 以下内容由布偶猫（宪宪）在铲屎官引导下补充。2026-02-16

### 背景：铲屎官的追问

砚砚的报告推荐 `mcp-language-server`（最短路径），布偶猫也同意。但铲屎官追问：
1. `axivo/mcp-lsp` 多出来的 formatting / code actions 是什么？有没有用？
2. JetBrains 也有 MCP server（铲屎官天天开着 WebStorm），要不要一起考虑？

### 三方对比表

| | **axivo/mcp-lsp** | **mcp-language-server** | **JetBrains MCP** |
|---|---|---|---|
| **运行方式** | 独立进程（Node） | 独立进程（Go binary） | **需要 IDEA/WebStorm 开着** |
| **启动开销** | LSP 冷启动几秒（bridge 本身轻） | 同左 | IDE 本身已开，无额外启动 |
| **diagnostics** | ✅ | ✅ | ✅ `get_file_problems`（IntelliJ inspections，比 tsc 更全面） |
| **definition** | ✅ | ✅ | ⚠️ `get_symbol_info`（有类型信息，但非跳转） |
| **references** | ✅ | ✅ | ❌ 无专门工具（可用 `search_in_files_by_regex` 替代） |
| **rename** | ✅（LSP rename） | ✅（LSP rename） | ✅ `rename_refactoring`（**最强**——理解 getter/setter、override、跨语言） |
| **code actions** | ✅（快速修复、提取重构） | ❌ | ⚠️ 未直接暴露 |
| **formatting** | ✅ | ❌ | ✅ `reformat_file` |
| **implementations** | ✅（查接口实现） | ❌ | ❌ |
| **跑测试** | ❌ | ❌ | ✅ `execute_run_configuration` |
| **文件操作** | ❌ | ❌ | ✅ `create_new_file` / `replace_text_in_file` |
| **依赖 IDE** | ❌ | ❌ | **✅ 必须开着** |
| **多猫可用** | ✅ 所有猫 | ✅ 所有猫 | ✅ 所有猫（只要 IDE 开着） |

### 关键能力说明

**code actions（快速修复）**：IDE 里的 "alt+enter" 能力——自动添加缺失 import、提取变量/函数、转换语法等。F23 重构时"提取函数"和"自动加 import"能省不少活。axivo 有，mcp-language-server 没有。

**formatting**：代码格式化。我们已有 Biome 覆盖，这个能力重复，不是选型关键。

**JetBrains rename_refactoring**：IntelliJ 的重构引擎是业界最好的——理解 getter/setter 联动、方法 override 链、跨文件跨语言引用。比 LSP 的 `textDocument/rename` 更安全可靠。

### 性能评估（"慢吞吞大猫"风险）

- **axivo/mcp-lsp**：性能瓶颈在底层 TSServer，不在 bridge 本身。我们项目已经在跑 TSServer（Claude Code LSP 插件），再起一个 MCP 版本的开销可接受
- **JetBrains MCP**：基本零额外开销——借的是 IDE 已经建好的索引
- **mcp-language-server**：Go binary，启动最快，资源最轻

### 落地决策（铲屎官 + 布偶猫讨论结论）

**推荐方案：axivo/mcp-lsp 做底座 + JetBrains MCP 做加持（两个都装）**

| 层 | 方案 | 解决什么 | 依赖 |
|---|------|---------|------|
| **底座** | axivo/mcp-lsp | 猫独立工作时的 LSP 能力（diagnostics/definition/references/code actions） | 无，独立运行 |
| **加持** | JetBrains MCP | 铲屎官在时的 IDE 加持（rename_refactoring/get_file_problems/跑测试） | WebStorm 开着 |
| **已有** | Claude Code LSP 插件 | 布偶猫编辑后的实时诊断（`<new-diagnostics>`） | Claude Code 内置 |
| **已有** | PostToolUse hook | 编辑后自动跑 Biome lint | 项目 hooks 配置 |

**为什么不只选一个**：
- axivo 不依赖 IDE，猫半夜自己干活也能用；但它的 rename 没有 IntelliJ 强
- JetBrains MCP 的重构能力最强，但铲屎官不在时（IDE 关了）猫就没了
- 两者叠加 = 基础能力保底 + 高级能力按需

**待实施**：
- [ ] 安装 axivo/mcp-lsp，配到 `.mcp.json`（布偶猫）和 Codex config（砚砚）
- [ ] 在 WebStorm 里开启 MCP Server，auto-configure Claude + Codex
- [ ] 更新 SOP 代码质量工具章节：加入 LSP MCP 工具使用规则
- [ ] 实测验证三猫都能调通

---

## Sources（快速点名，方便回看）

OpenCode
- LSP Servers: https://opencode.ai/docs/lsp
- Tools（含 experimental lsp tool）: https://opencode.ai/docs/tools

LSP-as-MCP servers
- isaacphi/mcp-language-server: https://github.com/isaacphi/mcp-language-server
- axivo/mcp-lsp: https://github.com/axivo/mcp-lsp
- Tritlo/lsp-mcp: https://github.com/Tritlo/lsp-mcp
- nzrsky/lsp-mcp-server: https://github.com/nzrsky/lsp-mcp-server
- jaenster/ts-lsp-mcp: https://github.com/jaenster/ts-lsp-mcp
- jgauffin/ts-language-mcp: https://github.com/jgauffin/ts-language-mcp
- VSCode extension: CJL.lsp-mcp: https://marketplace.visualstudio.com/items?itemName=CJL.lsp-mcp

JetBrains MCP
- MCP Server 官方文档: https://www.jetbrains.com/help/webstorm/mcp-server.html
- MCP Available Tools: https://youtrack.jetbrains.com/articles/SUPPORT-A-2156/MCP-Available-Tools
- GitHub (mcp-jetbrains): https://github.com/JetBrains/mcp-jetbrains
- IDE Index MCP Server (社区插件): https://plugins.jetbrains.com/plugin/29174-ide-index-mcp-server

Codex CLI
- MCP docs: https://developers.openai.com/codex/mcp/
- Skills docs: https://developers.openai.com/codex/skills/
- CLI reference（含 codex mcp 命令）: https://developers.openai.com/codex/cli/reference/
- Built-in LSP integration feature request（2026-01-05）: https://github.com/openai/codex/issues/8745
