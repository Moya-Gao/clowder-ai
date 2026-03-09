# Hub Terminal & tmux 集成方案咨询

> 委托人：铲屎官 + 布偶猫(Opus)
> 日期：2026-03-08
> 咨询对象：GPT Pro (云端)
> 关联功能：[F089](../features/F089-hub-terminal-tmux.md) Hub Terminal & tmux（已立项） | F063 Hub Workspace Explorer

---

## Part 1: 发给云端模型的提示词

> 直接复制以下内容发送给 GPT Pro

---

你好，我们是一个多 AI Agent 协作平台（内部叫 Cat Café），3-4 个不同厂商的 AI agent（Claude/GPT/Gemini）协同开发一个项目。我们有一个 Web UI Hub（Next.js 前端 + Fastify 后端），用来管理对话、查看文件、监控 agent 状态等。

现在我们想在 Hub 里加 **终端（Terminal）** 能力，并且在探索 **tmux 集成** 的可能性。请帮我们想想方案。

### 我们的现状

**架构概览：**

```
[浏览器 Hub UI]  ←WebSocket(socket.io)→  [Fastify API 服务器]
                                              │
                                         [Agent 服务]
                                              │
                                    ┌─────────┼─────────┐
                                    │         │         │
                              Claude CLI   OpenAI API   Gemini API
                              (子进程)      (HTTP)      (HTTP)
```

**Agent 启动方式（以 Claude 为例）：**
- 用 Node.js `child_process.spawn()` 启动 Claude CLI
- `stdio: ['ignore', 'pipe', 'pipe']`（stdin 关闭，stdout/stderr 管道）
- CLI 输出 NDJSON 流式事件，后端解析后通过 WebSocket 推给前端
- **不使用 PTY**，纯管道 I/O，每次调用是一个独立子进程
- Claude CLI 内部会再 spawn 子进程（Bash tool、subagent 等），形成进程树

**WebSocket 基础设施（已有）：**
- Fastify + `@fastify/websocket` + `socket.io`
- 支持 room（`thread:{threadId}`、`user:{userId}`）
- 已有事件：`agent_message`（流式输出）、`cancel_invocation`（取消）
- 前端 `socket.io-client` 连接

**Workspace Explorer（已有）：**
- 文件树浏览（懒加载）
- 文件预览（代码/图片/音频/视频/Markdown）
- 代码编辑（CodeMirror 6）
- 多 tab + 搜索 + Git 面板
- **没有 Terminal 组件**

**当前不具备的：**
- 没有 xterm.js / node-pty / 任何 terminal 相关依赖
- Agent 进程没有 PTY，是纯 pipe
- 没有持久 shell session

### 我们想探索的方向

#### 方向 A：在 Hub 里开独立 Terminal

最基本的需求——用户在浏览器里开一个 shell，跟 VSCode Terminal 一样。

#### 方向 B：tmux 集成

铲屎官提出的想法：不是直接开 terminal，而是用 tmux 管理所有 session：

1. **Agent 在 tmux session 中启动**：每个 agent 调用不是直接 `spawn()`，而是 `tmux new-session -d -s agent-xxx -- claude -p "..."`,这样每个 agent 的完整 I/O（包括它 spawn 的子进程的输出）都在 tmux 窗口里
2. **用户可以 attach**：Hub 前端通过 xterm.js + WebSocket attach 到 tmux session，实时观看 agent 的操作
3. **事故恢复**：agent 挂了，tmux session 还在，可以看到最后的输出，甚至手动接管
4. **多窗口**：tmux 的 window/pane 天然支持多 terminal 并排

#### 方向 C：监控 Agent 子进程

能看到 agent 当前 spawn 了哪些子进程、它们在执行什么命令、CPU/内存占用。类似 `htop` 但聚焦在 agent 的进程树上。我们曾经遇到过 agent 卡死的情况，当时是另一个 agent 用 `ps` 命令手动排查救活的。

### 具体问题

1. **tmux 集成的架构方案**：如果要把 agent 启动从 `spawn()` 改为 tmux session，最佳实践是什么？需要注意什么坑？（比如 NDJSON 输出解析还能正常工作吗？能否同时 pipe 和 attach？）

2. **xterm.js + tmux 的前端方案**：业界有没有成熟的 web terminal + tmux 集成案例？（比如 Wetty、ttyd、GoTTY 等）哪种方案最适合我们的 Fastify + socket.io 栈？

3. **Agent PTY vs Pipe 的权衡**：把 agent 从 pipe 改为 PTY 运行，有什么利弊？会不会影响 NDJSON 解析（PTY 可能插入 ANSI escape codes）？

4. **进程监控方案**：怎么优雅地实现 agent 进程树监控？是轮询 `ps` 还是用 Linux 的 cgroups/proc？有没有 Node.js 库推荐？

5. **安全考虑**：Web terminal 接入本地 shell 的安全最佳实践？（我们是本地开发环境，不是生产服务器，但还是想了解）

6. **渐进式实施路线**：如果我们想分阶段做，你建议怎么排优先级？哪些是快速出效果的，哪些是长期投入的？

### 额外请求

- 如果你知道有开源项目做了类似的事（Web UI 管理多个 AI agent + terminal），请推荐
- 如果 tmux 方案有根本性的坑，请直接告诉我们，我们可以换方向
- 我们的后端是 Node.js/TypeScript，前端是 React/Next.js，请基于这个技术栈给建议

---

## Part 2: 云端模型回答（待回填）

> **⚠️ 不采纳项备注（布偶猫 2026-03-09）**：
> GPT Pro 建议"长期可以把 Claude 侧逐步换到 Agent SDK"——**我们不采纳**。
> 铲屎官明确：CLI spawn（Claude Code CLI / Codex CLI / Gemini CLI）就是终态 agent 入口，不会被 Agent SDK 替代。
> GPT Pro 的 5 阶段渐进路线也不采纳（先纯 PTY 再叠 tmux = 绕路，违反 P1），已在 Part 3 修正为直线版。
> 其余架构建议（双轨制、workspace 级 tmux server、control mode、xterm.js + plain WS）采纳。

结论先摆桌上：我建议你们做**双轨制**，别一上来把所有 agent 调用都改成 tmux/PTY。机器轨继续保留现在的 `spawn + pipe + 结构化输出`，甚至长期可以把 Claude 侧逐步换到 Agent SDK，或者至少继续用 CLI 的 `--output-format stream-json` / `--input-format stream-json`；人类轨再补一条独立 terminal/tmux 观测通道。Claude 官方 CLI 现在明确支持 `text/json/stream-json` 输出和 `stream-json` 输入，而 Agent SDK 也提供 TypeScript 可编程的同款 agent loop。PTY/node-pty 会让程序把自己当成真正终端，tmux control mode 的 `%output` 还会对控制字符做八进制转义，并且输出可能不是合法 UTF-8，所以把 tmux/PTY 当成机器解析的唯一来源，后面很容易把 NDJSON 泡成 ANSI 火锅。这个判断是我的架构推断，依据是这些工具的已定义行为。 ([Claude][1])

我会把 Hub 拆成这样：

```text
Hub UI
├─ socket.io
│  ├─ agent_message / cancel / process_tree / tmux_state
│  └─ 结构化元数据、房间广播、状态同步
└─ plain WebSocket
   └─ xterm.js 终端字节流
      └─ TerminalGateway
         ├─ node-pty        -> 用户 shell / 临时命令
         └─ TmuxGateway     -> tmux control mode (-CC)

AgentRunner
├─ 机器轨: spawn + pipe / SDK / stream-json
└─ 人类轨: tmux pane / PTY / watch + takeover
```

**1. tmux 集成怎么做最稳**

tmux 可做，但我建议“**每个 workspace 一个 tmux server / 一个主 session**”，而不是“每次 invocation 一个独立 tmux session”。tmux 本来就支持用 `-L` 或 `-S` 起多个独立 server，并且 socket 默认在 `/tmp`/`TMUX_TMPDIR` 下，目录权限必须严格；Anthropic 自己的 agent teams 文档也直接支持 tmux split panes，同时提醒有 orphaned tmux sessions 等限制。用 workspace 级 server 可以避免 session 爆炸、清理困难和恢复逻辑四处散落。 ([man7.org][2])

Hub 后端我会加一个 **`TmuxGateway` 常驻服务**，后端持有唯一的 tmux control-mode client，前端永远不要直接碰 tmux socket。tmux control mode 本来就是给集成场景设计的文本协议，能发 `%output`、`%window-add`、`%window-close`、`%session-window-changed` 这类事件，还能用 `refresh-client -C` 同步尺寸；如果只是把 `tmux attach` 套进一个 PTY，POC 很快，但 UI 会变成“tmux 画自己的界面，你们的 Hub 只是个玻璃罩子”。想做自定义 tab/pane 布局，control mode 更对味。 ([GitHub][3])

“**能不能同时 pipe 和 attach**？”能，但别把显示流和机器协议流混成一锅。tmux 的 `pipe-pane` 可以把 pane 输出接到外部命令，`-O` 是把 pane 输出送到 shell-command，`-I` 则可把 shell-command 的 stdout 写回 pane，而且同一 pane 一次只能连一个 pipe。比较稳的做法是：agent pane 默认 watch-only，`select-pane -d` 关输入，`pipe-pane -O` 单独 tee 一份给解析器/日志；需要人工接管时，再切到 takeover，`select-pane -e` 开输入，并把这次运行从“结构化可解析”降级成“人工会话”。否则用户一敲键，NDJSON 就会被人肉插针。 ([man7.org][2])

事故恢复这块，tmux 其实很香：`remain-on-exit` 能让 pane 在进程退出后保留现场，`respawn-pane` 能原地拉起，`capture-pane -p` 能抓滚动历史，hooks 里还有 `pane-died` 和 `pane-exited`。这几样拼起来，基本就是“崩了别擦黑板，先保留尸体，再决定复盘还是复活”。 ([man7.org][2])

**2. xterm.js + tmux 前端方案**

前端我建议 A 和 B 分开做。A，独立 Terminal：`@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-search` 起步，后面再加 `@xterm/addon-serialize` 做会话快照/恢复。xterm.js 官方就是给浏览器里的完整终端用的，能跑 `bash`、`vim`、`tmux`，这些 addon 也都是官方维护。 ([GitHub][4])

传输层不要把 raw terminal bytes 塞进你们现有 Socket.IO 通道里硬拧到天明。Socket.IO 官方明确说它**不是** WebSocket 实现，和 plain WebSocket 客户端/服务端不能直接互连，而 `@xterm/addon-attach` 也是按 plain WebSocket 设计的。对你们的栈，最顺手的形态是：**socket.io 继续负责 room、agent 状态和结构化事件；另开一条 `@fastify/websocket` 路由专门跑 terminal byte stream**。Fastify 这边还有个细节坑：message handler 要同步挂上，再做异步鉴权/查库，不然消息可能在 handler 未就绪时被静默丢掉。 ([socket.io][5])

高流量别忽略。xterm.js 的 `write` 是非阻塞的，输入缓冲有硬编码 50MB 上限，超出会直接丢；WebSocket 本身也没有内建回压钩子。后端最好配合 node-pty 的 `pause/resume` 或 `handleFlowControl`，前后端再加一层 ACK/水位协议；如果是 tmux control mode，还可以用 `refresh-client -f pause-after=...`，掉队时再用 `capture-pane -p` 补历史。 ([Xterm.js][6])

所以就你们的栈，我会给一句定案：**Direction A 用 `xterm.js + @fastify/websocket + node-pty`，Direction B 的产品化版本再叠 `tmux control mode`，Socket.IO 继续做结构化消息总线，不做 raw terminal 主干。** ([socket.io][5])

**3. Agent PTY vs Pipe 的权衡**

我会很直白地画线：凡是“要让系统可靠解析、可回放、可审计”的 agent run，优先 **pipe**；凡是“要让人看、要 TUI、要手动接管”的会话，优先 **PTY**。Node 的普通 `spawn` 默认就是 stdin/stdout/stderr pipe；这条路字节更干净，最适合 NDJSON/stream-json。PTY/node-pty 的价值在于让程序把自己当终端，从而 `bash`、`vim`、`tmux` 这类交互工具都正常工作，但代价就是 ANSI、进度条、光标控制和 `TERM=screen/tmux` 语义都会掺进来。 ([Node.js][7])

顺手一提，你们现在把 stdin 关了；如果未来想给机器轨增加“受控交互”，不一定要切 PTY，直接把 `stdio[0]` 打开为 pipe，再配合 Claude CLI 的 `--input-format stream-json` / `--output-format stream-json`，会比从 terminal 流里反解析稳很多。 ([Node.js][7])

**4. 进程监控方案**

进程监控我会分两层。先上最快见效版：记录每个 agent/terminal 的 root PID，用 `pidtree` 拿整棵子进程树，再用 `pidusage` 拉 CPU/内存；如果你们想顺带看网络连接或做 host 级 overlay，`systeminformation` 的 `processes()` 和 `networkConnections()` 也够用。tmux 侧还能通过格式字段拿到 `pane_pid`、`pane_current_command`、`pane_current_path`，但要注意 `pane_pid` 只是 pane 里第一个进程，不等于整棵树。 ([GitHub][8])

Linux 上更优雅、更耐打的长期方案是每个 agent 一个 **cgroup v2**。cgroup 的 `cgroup.procs` 能列出组内进程，`cpu.stat` 给 usage/user/system 微秒统计，`memory.current` 给当前内存，`pids.current` 给当前进程数；子进程天生跟着父进程进组，做聚合监控、整组 kill、资源限额都很顺手。若你们本机是 systemd 环境，`systemd-run --scope` 是很省力的落地方式，它会把命令放进 transient scope unit 里让 systemd 管理。 ([Linux内核文档][9])

**5. 安全考虑**

安全上，哪怕只是本地开发，我也会把 terminal 当“高压线”对待。xterm.js 官方明确提醒：只要能摸到 terminal 组件的 JS 代码，就能操纵 terminal I/O，所以终端页最好独立成单独子页面甚至单独子域；别在旁边塞第三方脚本、广告、动态加载 JS，也别拿 terminal 数据去碰 `innerHTML`。如果用 WebSocket 驱动终端，官方还特别提醒不要直接拿 demo/attach 示例上生产，必须自己补 `wss`、鉴权和授权协议。 ([Xterm.js][10])

后端侧，PTY/tmux/agent 一律跑非 root 用户，浏览器永远只连 Hub 后端，不要暴露 tmux socket。tmux 自己也强调 socket 默认只允许 owner/root 访问，别把权限放松给不可信用户，哪怕只读都危险；node-pty 也提醒它启动的进程继承父进程权限，面向互联网时最好放进容器。顺便，WeTTY 文档里甚至举了把密码放 URL 参数做 auto-login 的例子，这种图省事的路子别学。 ([man7.org][2])

**6. 渐进式实施路线**

实施顺序我会这样排。第一阶段，先做独立 Terminal：xterm.js + plain WS + node-pty，给 Workspace Explorer 补终端 tab，这是最快出效果的。第二阶段，上 agent 进程树面板：PID 树、CPU、内存、命令、cwd、网络连接。第三阶段，再给“用户 shell”接入 tmux，先做 workspace 级 tmux 会话和 watch/takeover。第四阶段，只把少数长跑、调试价值高的 agent run 放进 tmux pane，继续保留 pipe/SDK 作为机器轨。第五阶段，再评估是否值得把更多 agent 场景迁过去。换句话说，先让猫看见厨房，再决定要不要把整家餐馆都改成明档。 ([GitHub][4])

**7. 可参考的开源/现成项目**

我会分三类看。AI agent + Web UI 参考：**OpenHands**，CLI 同时支持 Terminal、Headless、Web Interface（浏览器终端 UI）和 GUI Server，是最接近你们“agent + web cockpit”气质的开源样本之一。终端网关参考：**WeTTY** 是 Node/TypeScript 栈、用 xterm.js + websockets；**ttyd** 是更独立的“把终端分享到 Web”的 sidecar；两者都更像 standalone gateway，不太像你们这种深嵌 Hub 的产品形态。行业信号参考：Anthropic 自己的 **Claude Code agent teams** 已经支持 tmux split panes，但官方也明确标成 experimental 并列出 orphaned sessions 等限制。 ([OpenHands Docs][11])

一句话总判决：**tmux 方案没有根本性死刑，但“tmux = 运行时真相来源”这条路坑深；“tmux = 可视化/接管/恢复层”则非常值得做。** 先上独立 terminal 和进程树监控，再把 tmux 接进来，Hub 会立刻从“会说话的文件管理器”进化成真正的多 agent 驾驶舱。 ([GitHub][3])

下一条最值得做的是把 `TerminalGateway / TmuxGateway / ProcessMonitor` 的 TypeScript 接口和 WS 事件协议直接定出来。

[1]: https://code.claude.com/docs/en/cli-reference "https://code.claude.com/docs/en/cli-reference"
[2]: https://man7.org/linux/man-pages/man1/tmux.1.html "https://man7.org/linux/man-pages/man1/tmux.1.html"
[3]: https://github.com/tmux/tmux/wiki/Control-Mode "https://github.com/tmux/tmux/wiki/Control-Mode"
[4]: https://github.com/xtermjs/xterm.js/ "https://github.com/xtermjs/xterm.js/"
[5]: https://socket.io/docs/v4/ "https://socket.io/docs/v4/"
[6]: https://xtermjs.org/docs/guides/flowcontrol/ "https://xtermjs.org/docs/guides/flowcontrol/"
[7]: https://nodejs.org/api/child_process.html "https://nodejs.org/api/child_process.html"
[8]: https://github.com/simonepri/pidtree "https://github.com/simonepri/pidtree"
[9]: https://docs.kernel.org/admin-guide/cgroup-v2.html "https://docs.kernel.org/admin-guide/cgroup-v2.html"
[10]: https://xtermjs.org/docs/guides/security/ "https://xtermjs.org/docs/guides/security/"
[11]: https://docs.openhands.dev/openhands/usage/cli/quick-start "https://docs.openhands.dev/openhands/usage/cli/quick-start"

---

## Part 3: 布偶猫综合（对照 codebase 验证）

> 综合人：布偶猫/宪宪 (Opus 4.6)  日期：2026-03-08
> 方法：对照实际 codebase 验证 GPT Pro 每条建议的可行性

### 总判：GPT Pro 方案质量很高，核心架构建议直接可用

"双轨制"（机器轨 pipe + 人类轨 tmux/PTY）是正确的架构判断。我验证后的修正和补充如下。

---

### 1. Codebase 验证结果

| GPT Pro 说的 | 实际情况 | 状态 |
|---|---|---|
| stdio 是 `['ignore', 'pipe', 'pipe']` | `cli-spawn.ts:83` 确认 | ✅ 准确 |
| NDJSON 解析 | `parseNDJSON(child.stdout)` at `cli-spawn.ts:180` | ✅ 准确 |
| SIGTERM → 3s grace → SIGKILL | `cli-spawn.ts:113-123`, KILL_GRACE_MS=3000 | ✅ 准确 |
| 建议用 `--output-format stream-json` | **我们当前用 `--json` flag，不是 `--output-format`**。Claude CLI 确实支持 stream-json，但我们没用。这是升级路径不是现状 | ⚠️ 未来可选，非现状 |
| 建议用 `--input-format stream-json` 开 stdin | **我们 stdin 是 `'ignore'`**。打开 stdin pipe + stream-json input 是一个显著的架构变更，需要单独评估 | ⚠️ 大改动，需独立 feature |
| `@fastify/websocket` + socket.io 可共存 | `package.json` 两者都装了。**但 `@fastify/websocket` 目前未被任何代码 import**——是"有但没用"的状态。加 plain WS 路由零冲突 | ✅ 直接可用 |
| socket.io room: `thread:{id}`, `user:{id}` | `SocketManager.ts:74,94,118,128` 确认 | ✅ 准确 |
| pidtree / pidusage | **未安装**，需要新增依赖 | ✅ 需新增 |
| cgroup v2 建议 | **我们是 macOS (Darwin)**，没有 cgroup。这条建议仅适用于 Linux 部署 | ❌ macOS 不适用 |

### 2. 关键修正

**修正 1：macOS 优先**
GPT Pro 提了 cgroup v2 + systemd-run，这是 Linux 方案。我们开发环境是 **macOS (Darwin 25.2.0)**。进程监控应优先用跨平台方案：
- `pidtree`（跨平台，用 `ps` on macOS / `/proc` on Linux）
- `pidusage`（跨平台，用 `ps -o %cpu,%mem` on macOS）
- macOS 没有 cgroup，资源限制可以考虑 `launchd` 或暂时不做

**修正 2：CLI spawn 就是终态，不是过渡方案**
GPT Pro 提到 Agent SDK 作为长期替代。但铲屎官明确：我们的终态就是 CLI spawn（Claude Code CLI / Codex CLI / Gemini CLI）。这些 CLI 就是 agent 入口，不会被 SDK 替代。Phase 4 的 stdin pipe 是 takeover 的程序化升级，不是 SDK 迁移的前置步骤。

**修正 3：`@fastify/websocket` 是白送的**
已经在 `package.json` 里了，只是没人用。加 terminal WS 路由不需要装新依赖，直接 `import` 就行。这让 Phase 1 更简单。

### 3. 实施路线（面向终态直线版）

> **反思**：GPT Pro 建议的 5 阶段路线是"先做纯 PTY terminal → 再叠 tmux"，这违反了我们的第一性原理——面向终态不绕路。Phase 1 纯 PTY 在 Phase 3 tmux 化时会被推翻重做，是脚手架不是基座。
>
> 铲屎官指出：终态就是 tmux 管理所有 session，那从 Day 1 底层就应该是 tmux。xterm.js 不关心后面是裸 PTY 还是 tmux pane，用户体验完全一样。

#### Phase 1：tmux 基础设施 + 用户 Shell（终态基座）

**后端**：
- TmuxGateway 服务：一个 worktree = 一个 tmux server（`tmux -L catcafe-{worktreeId}`）
- tmux session 创建/销毁/resize 管理
- `@fastify/websocket` 路由 `ws://host/api/terminal/:sessionId`（已有依赖）
- 用户 shell = tmux 里的一个 window/pane

**前端**：
- `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-attach`
- WorkspacePanel 新增 Terminal tab
- tmux window/pane 列表 UI

**价值**：铲屎官在浏览器里开 terminal，底层就是 tmux。后续加 agent pane 零重构。

#### Phase 2：Agent Watch Pane

- Agent 启动时在 tmux 里自动开 pane（`select-pane -d` watch-only）
- `remain-on-exit` 保留崩溃现场
- 前端：点 pane 即可 attach 观看 agent 操作
- `pipe-pane -O` tee 一份给日志/解析器

**价值**：实时观看猫猫操作 + 崩溃现场保留

#### Phase 3：Takeover + 进程监控

- `select-pane -e` 开启输入（watch → takeover 切换）
- takeover 时暂停机器轨解析（防 NDJSON 干扰）
- `pidtree` + `pidusage` 进程树监控
- 前端 ProcessTree 组件

**价值**：agent 卡了能手动接管 + 诊断子进程

#### Phase 4（远期）：stdin pipe + stream-json 双向通信

- 打开 `stdio[0]` 为 pipe
- `--input-format stream-json` / `--output-format stream-json`
- 程序化交互（Hub UI 直接给 CLI 发结构化指令）

### 4. 技术栈选型确认

| 组件 | 选型 | 理由 |
|------|------|------|
| 前端 terminal | `@xterm/xterm` + addons | 业界标准，VSCode 也用 |
| terminal 传输 | `@fastify/websocket`（plain WS） | 已有依赖 + xterm addon-attach 原生支持 |
| 结构化事件 | `socket.io`（不变） | 现有基础设施，room/broadcast 成熟 |
| 后端 PTY | `node-pty` | 跨平台，xterm.js 生态配套 |
| tmux 集成 | control mode (`-CC`) | GPT Pro 推荐，优于套 PTY attach |
| 进程监控 | `pidtree` + `pidusage` | 跨平台，macOS 兼容 |
| 进程监控（远期 Linux） | cgroup v2 | 仅 Linux 部署时考虑 |

### 5. 最大风险

| 风险 | 缓解 |
|------|------|
| node-pty 在 macOS 需要编译原生模块 | `pnpm install` 时确认 Xcode CLI tools |
| tmux control mode 解析复杂 | Phase 1 就要面对，但 GPT Pro 给了详细的 control mode 协议说明，有路可走 |
| terminal 安全 | 本地环境风险低，但仍然：不暴露 tmux socket、WS 路由加 session token 校验 |
| NDJSON 被 PTY ANSI 污染 | 双轨制已规避——机器轨永远走 pipe，不碰 PTY |

### 6. 下一步行动

- [x] 立 Feature → **F089** (`docs/features/F089-hub-terminal-tmux.md`)
- [ ] Phase 1 可以立即开工——tmux 基础设施 + 用户 shell

---

*综合完成。GPT Pro 的双轨制架构判断正确，但渐进路线违反了我们的第一性原理"面向终态不绕路"。已修正为直线版：从 Day 1 底层就是 tmux，每一步都是终态的基座。*

*第一性原理"面向终态不绕路"已沉淀到 `shared-rules.md` Rule 12 + `F059` 核心哲学章节。*
