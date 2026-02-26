结论先摆上桌 🐾

### 1) Codex 支不支持“项目级别 MCP 配置”？

**支持。**Codex 的 MCP 配置默认在 `~/.codex/config.toml`，但**也支持在仓库里放 `.codex/config.toml` 做项目级别覆盖**（而且可以从项目根目录一路往下叠加，离当前工作目录更近的覆盖更高优先级）。([OpenAI Developers][1])
注意：**项目级 `.codex/config.toml` 只有在项目被标记为 trusted 时才会加载**。([OpenAI Developers][2])

Codex 的配置优先级大概是：**CLI 覆盖** > profile > 项目 `.codex/config.toml` > 用户 `~/.codex/config.toml` …([OpenAI Developers][2])

---

### 2) Codex 支不支持像 Claude Code 那种 `--mcp-config` “动态挂载”？

**没有同名的 `--mcp-config` 这种“给一个外部 MCP 配置文件路径然后临时挂载”的模式**（Codex 的路子是统一走 `config.toml` 分层）。CLI 侧提供的是通用 `-c/--config key=value` 覆盖，不是专门的 `--mcp-config`。([OpenAI Developers][3])

但 Codex 也有两种“等价替代玩法”，看你要的“动态”是哪一种：

#### A. “动态启用/禁用已存在的 MCP server”（单次运行切换）

可以先把 server 定义写在配置里，然后默认 `enabled=false`，需要时用 `-c` 临时打开：

```bash
codex -c mcp_servers.context7.enabled=true
```

官方文档明确提到 `-c` 支持点号路径设置嵌套键，比如 `mcp_servers.context7.enabled=false` 这种。([OpenAI Developers][4])

#### B. “动态切换一整套配置”（类似多套挂载方案）

用 **profiles**：在 `~/.codex/config.toml` 里放 `[profiles.xxx]`，然后 `codex --profile xxx` 切换。Profiles 是 CLI 能用、IDE 扩展暂不支持的实验特性。([OpenAI Developers][4])

---

### 3) 推荐我们怎么配，才能“全局 + 项目”都舒服？

我会建议这样分层，像猫窝分区一样清爽 🧶

#### 全局 `~/.codex/config.toml`：放“通用定义”，默认不开

```toml
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
enabled = false
```

MCP server 的配置就是放在 `[mcp_servers.<name>]` 下面。([OpenAI Developers][1])

#### 项目内 `.codex/config.toml`：只在这个 repo 里打开它

```toml
[mcp_servers.context7]
enabled = true
```

如果你希望某个项目用完全不同的 server，**也可以直接在项目的 `.codex/config.toml` 里新增一个 `[mcp_servers.xxx]` 定义**，只要项目被 trusted 就会生效。([OpenAI Developers][2])

---

### 4) 一个容易踩的点

`codex mcp add/list/get/remove` 这套命令，文档写的是管理存到 `~/.codex/config.toml` 的条目。([OpenAI Developers][3])
所以“用 CLI 命令把 server 加到项目级配置文件”这件事，目前看起来**更像是手动编辑 `.codex/config.toml`** 这一派。

---

如果你告诉我你说的“动态挂载”更偏向哪一种：

1. 单次运行临时加一个从没配过的新 server
2. 在不同 repo 之间自动切换不同 server 集合
   我就给你一套更贴近你工作流的“最佳实践模板”（含目录结构 + 可复制 TOML 段落 + 一条命令开关）。

[1]: https://developers.openai.com/codex/mcp/ "Model Context Protocol"
[2]: https://developers.openai.com/codex/config-basic/ "Config basics"
[3]: https://developers.openai.com/codex/cli/reference/ "Command line options"
[4]: https://developers.openai.com/codex/config-advanced/ "Advanced Configuration"
