---
feature_ids: [F016]
topics: [gemini, cli, mcp]
doc_kind: research
created: 2026-02-26
---

对，你把 **“动态”**定义成“不改文件/不重装/一条命令临时开关”，那 codex -c mcp_servers.context7.enabled=true 这种就算动态开关 ✅（它是“本次运行的配置覆盖”）。

那 Gemini CLI 呢？结论：支持，而且更“显式”。

Gemini CLI：动态挂载 / 动态开关 MCP 怎么玩？

1) 项目级 vs 全局配置：原生支持

Gemini CLI 的 MCP 配置放在 settings.json 里，分两层：
	•	全局：~/.gemini/settings.json
	•	项目级：./.gemini/settings.json（项目目录内）  ￼

也就是你要的“项目级，不只是全局”这点，Gemini 天生就给你这条路。

⸻

2) 动态开关：支持“仅本次 session 生效”的 enable/disable

Gemini 有专门的命令来开关 MCP server，并且带一个很关键的参数：--session
	•	gemini mcp enable <name> [--session]
	•	gemini mcp disable <name> [--session]
--session 的意思是：只对当前会话生效，不写回配置文件。 ￼

所以如果你说的“动态挂载”是“临时启用/禁用”，Gemini 这边是一等公民。

⸻

3) “动态挂载一个新 server”也行：gemini mcp add 支持 scope

Gemini CLI 还能用命令直接把 server 写进配置里，并且可以指定写到哪里：
gemini mcp add ... 会根据 -s/--scope 写入 用户配置 ~/.gemini/settings.json 或 项目配置 ./.gemini/settings.json。 ￼

也就是说你可以：
	•	在某个 repo 里 --scope project 加一个 server，只对这个 repo 生效
	•	或者全局加一个 server，默认不开，然后用 enable --session 临时开

⸻

和 Codex 的“动态”放一起对照一下（我们方便选用）
	•	Codex：用 -c key=value 做“本次运行覆盖”，属于“临时开关”。（你这个定义下完全算动态 ✅）
	•	Gemini CLI：除了项目级配置，还能 mcp enable/disable --session 做“当前会话临时开关”，并且 mcp add 自带 --scope project/user，更像“自带开关面板”。 ￼

⸻

如果你愿意，我们下一步可以把“动态”的粒度再切一刀：
你更在意的是 A. 临时启用已有 server，还是 B. 临时挂一个从没配过的新 server？我就按你那个口味给一套“最顺手的 SOP 命令组合”。