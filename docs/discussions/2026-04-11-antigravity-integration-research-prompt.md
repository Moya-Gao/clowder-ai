---
feature_ids: [F061]
topics: [antigravity, integration, mcp, research]
doc_kind: research
created: 2026-04-11
---

# Antigravity IDE Integration Research: CLI Chat Bug + Programmatic Access

> Date: 2026-04-11
> Requester: 布偶猫（Opus）
> Target: GPT Pro / Gemini Deep Think
> Purpose: Research only — investigate Antigravity CLI behavior and integration paths

---

## 0) Global Constraints

1. We run **Cat Café**, a multi-AI-agent collaboration system (Claude Opus, Codex/GPT, Gemini + more) on a shared codebase. Node.js + Fastify + TypeScript.
2. **Antigravity** (by Google) is one of our agent hosts — we call the agents running inside it "Bengal cats" (孟加拉猫).
3. Our current integration uses a **CDP (Chrome DevTools Protocol) WebSocket bridge** to scrape Antigravity's DOM — injecting messages and polling responses. This is inherently fragile and breaks on UI updates.
4. We want to find a **more elegant, stable integration path** that leverages Antigravity's native capabilities instead of DOM scraping.
5. Research only — design and evidence, no code.

---

## 1) The Bug: `antigravity chat` Prompt Not Delivered

### Environment

- **Antigravity version**: 1.107.0
- **OS**: macOS Darwin 25.2.0 (Apple Silicon)
- **Binary**: `/Applications/Antigravity.app/Contents/Resources/app/bin/antigravity`

### CLI Help Says

```
Usage: antigravity chat [options] [prompt]

To read from stdin, append '-' (e.g. 'ps aux | grep code | antigravity chat <prompt> -')

Options:
  -m --mode <mode>        'ask', 'edit', 'agent', or custom mode ID. Default: 'agent'
  -a --add-file <path>    Add files as context
  --maximize              Maximize the chat session view
  -r --reuse-window       Reuse last active window
  -n --new-window         Open empty window for chat
```

### Actual Behavior

1. `antigravity chat "hello" --mode agent` → Opens GUI chat panel, process exits with code 0
2. **But the prompt text is NOT submitted to the chat** — panel opens empty, no message, no agent response
3. Same behavior across: `--mode ask`, `--mode agent`, with/without `--reuse-window`/`--new-window`
4. No stdout, no stderr
5. This has been observed for **at least 2 months** (since ~Feb 2026, version ~1.100+)

### Research Questions

- **Q1.1**: Is this a known bug? Search discuss.ai.google.dev (Google Antigravity category), GitHub (google-gemini/gemini-cli), Stack Overflow, Reddit (r/antigravity, r/GoogleDev, r/vscode).
- **Q1.2**: What is the intended behavior? Should `chat [prompt]` auto-submit the message, or just pre-fill the input box? What does the official documentation at antigravity.google/docs/command say?
- **Q1.3**: Is there a known workaround? (e.g., specific flags, version pinning, environment variables)
- **Q1.4**: Is there an internal VS Code command `antigravity.sendTextToChat` or similar that could be triggered externally?
- **Q1.5**: Has anyone successfully used `antigravity chat "<prompt>"` with the prompt actually being executed? If so, what version/platform?

---

## 2) MCP Integration Path

### What We Know

Antigravity's top-level CLI supports:
```
--add-mcp <json>   Adds a Model Context Protocol server definition to the user profile.
                    Accepts JSON input: '{"name":"server-name","command":...}'
```

Our Cat Café MCP server is **stdio-based** (Node.js, `@modelcontextprotocol/sdk`, `StdioServerTransport`):
```json
{"name":"cat-cafe","command":"node","args":["/path/to/packages/mcp-server/dist/index.js"]}
```

### Research Questions

- **Q2.1**: Once an MCP server is registered via `--add-mcp`, how does it appear in Antigravity's chat UI? Can the agent use `@server-name` syntax to call MCP tools? Is there official documentation for this?
- **Q2.2**: Can MCP servers be configured **per-workspace** (in `.antigravity/` or `.vscode/` workspace config), not just user-level? This matters because different projects need different MCP servers.
- **Q2.3**: Does Antigravity's agent automatically discover and use MCP tools, or does the user need to explicitly mention them? How does tool selection work?
- **Q2.4**: Are there any known issues with stdio-based MCP servers in Antigravity? (connection lifecycle, timeout, crash recovery)
- **Q2.5**: What is the MCP server configuration schema? Does it support `env`, `cwd`, `args` like Claude Code's MCP config?

---

## 3) Agent Modes & Custom Modes

### What We Know

`antigravity chat --mode <custom>` accepts a custom mode identifier beyond the built-in `ask`/`edit`/`agent`.

### Research Questions

- **Q3.1**: How are custom modes defined? Where is the configuration? (workspace settings? extension contribution? `.antigravity/modes/`?)
- **Q3.2**: Can a custom mode include: pre-loaded MCP servers, system instructions (persona), tool restrictions, file context rules?
- **Q3.3**: Is there official documentation for custom mode creation? Any community examples?
- **Q3.4**: Could we create a `cat-cafe` custom mode that pre-configures the Bengal cat's collaboration persona + our MCP tools?

---

## 4) Extension API for Chat Interaction

### Research Questions

- **Q4.1**: Does Antigravity expose a Chat Participant API (like VS Code's `vscode.chat.createChatParticipant`)? Can extensions programmatically send/receive chat messages?
- **Q4.2**: Can a VS Code/Antigravity extension register custom tools that appear in the agent's tool palette?
- **Q4.3**: Is there a way to programmatically trigger chat from an extension (e.g., `vscode.commands.executeCommand('antigravity.sendTextToChat', text)`)?
- **Q4.4**: What extension APIs are Antigravity-specific (not in standard VS Code)?

---

## 5) Alternative Programmatic Interfaces

### Research Questions

- **Q5.1**: Does `serve-web` expose any REST/WebSocket API for chat interaction, or is it purely a UI server?
- **Q5.2**: Does `tunnel` enable any remote API access to Antigravity's agent capabilities?
- **Q5.3**: Is there a headless or CLI-only mode for running Antigravity's agent without GUI? (Similar to `claude --print` or `codex --quiet`)
- **Q5.4**: Does Antigravity support ACP (Agent Communication Protocol) or any hosted-agent lifecycle protocol (initialize/newSession/prompt)?
- **Q5.5**: Is there a REST API, gRPC endpoint, or any programmatic interface for interacting with Antigravity's AI agent outside the GUI?

---

## 6) Competitive Context

For perspective, here's how our other agent hosts integrate:

| Host | Integration | Stability |
|------|------------|-----------|
| Claude Code CLI | Subprocess spawn, stdin/stdout streaming, `--print` mode | Very stable |
| Codex CLI | Subprocess spawn, stdout NDJSON streaming | Stable |
| Gemini CLI | ACP hosted-agent protocol (initialize/newSession/prompt) | Stable (F149) |
| Antigravity | CDP WebSocket + DOM scraping | **Fragile** |

We want Antigravity to reach at least the same stability tier as the CLI-based integrations.

---

## Hard Requirements for Response

1. Every claim must cite a **specific source** (URL, doc page, forum post, issue number).
2. Clearly distinguish between **confirmed facts** (official docs, official responses) and **inferred/speculative** conclusions.
3. If `antigravity chat` is buggy, suggest the **best workaround available today**.
4. Rank integration paths by **practicality** (can we do it today with current Antigravity version?).
5. Output must end with:
   - **What**: Summary of findings
   - **Why**: Why these findings matter for our integration
   - **Tradeoff**: What we gain vs. lose with each integration path
   - **Open Questions**: What remains unknown
   - **Next Action**: Concrete steps we should take

---

## GPT Pro / Gemini Deep Think Response

> (Paste the response below this line)
>
> 【gemini】
> Based on an investigation of official Google documentation, community discussions on the Google AI Developers Forum (`discuss.ai.google.dev`), open-source GitHub repositories, and Reddit (`r/google_antigravity`) as of April 2026, here is the complete report regarding the Antigravity `chat` CLI bug and your programmatic integration options.

### 1\. Bug Status: Known Issue

**Status:** **Known Bug (Unresolved)**
The behavior where `antigravity chat "msg"` opens the IDE but silently drops the prompt is a known Inter-Process Communication (IPC) bug, not by-design.

  * **The Issue:** On the `r/google_antigravity` subreddit (Thread: *"AntiGravity CLI Issues"*), developers report the exact behavior you observed. When running `antigravity chat "msg" --reuse-window --mode agent`, the CLI correctly finds the active IPC socket (e.g., `/run/user/.../vscode-*-main.sock`), sends the data, and exits with code `0`. However, the React/Electron-based Agent Manager UI drops the payload instead of populating the input box.
  * **Workarounds:** Using the `--new-window` flag bypasses the IPC bug by forcing a completely fresh initialization sequence, but this opens an entirely new workspace, which breaks single-window workflows.

### 2\. Correct Usage & Official Documentation

**Intended Behavior:** Google's official documentation currently avoids CLI prompt injection entirely.

  * In the official **Firebase Studio Migration** and **Design-to-Code with Stitch MCP** codelabs, users are explicitly instructed to open the Agent Manager panel (CMD+E/CTRL+E) and manually type natural language instructions (e.g., `Publish my app`) or specific slash commands (e.g., `@fbs-to-agy-export` or `@workflows <name>`).
  * The `chat` CLI subcommand is structurally intended to pre-fill the agent's chat, but because it is broken, the GUI or alternative programmatic interfaces are currently the only reliable methods.

### 3\. Integration Options Ranked (Most to Least Practical)

Since the native CLI and internal command routing are bugged, the developer community relies on several workarounds to interact with Antigravity programmatically:

#### 🥇 1. Chrome DevTools Protocol / CDP Bridge (Most Reliable)

Because Antigravity runs on an Electron host, you can bypass the broken IPC layer completely by directly controlling the DOM via a debug port.

  * **How it works:** Launch the IDE with `antigravity . --remote-debugging-port=9000`. You can then use WebSockets (or tools like Puppeteer) to connect to the IDE, inject text securely into the Lexical editor input box, and simulate an "Enter" keypress.
  * **Prior Art:** This is the exact architecture used by popular open-source companion apps like **`antigravity_phone_chat`** (which achieves sub-100ms real-time chat bridging) and **`Antigravity-Shit-Chat`**.

#### 🥈 2. The Unofficial `antigravity-sdk` (For VS Code Extensions)

Unlike VS Code’s robust `vscode.chat` API, Antigravity does not expose a clean, public Chat API for extension developers yet.

  * **How it works:** A community developer created the [**`antigravity-sdk`**](https://www.google.com/search?q=%5Bhttps://github.com/Kanezal/antigravity-sdk%5D\(https://github.com/Kanezal/antigravity-sdk\)) (TypeScript). It avoids Antigravity's strict Trusted Types Content Security Policy by communicating directly with the local Language Server on `127.0.0.1` (using ConnectRPC) and reading the IDE's local SQLite state database (`state.vscdb`) via pure JS/WASM `sql.js`.
  * **Capabilities:** It provides reliable programmatic access to list sessions, focus chats, and send prompts (e.g., `sdk.cascade.sendPrompt('Analyze this file')`).

#### 🥉 3. Internal Extension Command: `antigravity.sendTextToChat` (Not Recommended)

You can trigger the internal command via an extension script: `vscode.commands.executeCommand('antigravity.sendTextToChat', true, query)`.

  * **Why it's ranked last:** On the Google AI Dev Forum, extension authors (like the team behind *Spring Boot Tools* and the *spin-the-wheel* extension) report this command is heavily bugged. Depending on string parsing, it often injects the text as an `@mention` (like `@prompt`) or prints `@[object Object]` in the chatbox rather than plain text.

### 4\. MCP Integration Details

The **Model Context Protocol (MCP)** acts as a bridge between your AI agent and the outside world, but servers act as *tools*, not conversation initiators.

  * **Configuration:** You add an MCP server via the GUI (Agent Panel `...` dropdown -\> *MCP Servers*) or by modifying `mcp-settings.json`.
  * **Usage in Chat:** Once connected with a token (e.g., to a PostgreSQL DB or GitHub), the agent evaluates the tool descriptions and autonomously queries them when your prompt conceptually demands it.

### 5\. Agent Mode / Custom Workspace Modes

Rather than using the CLI's `--mode <custom>`, Antigravity relies heavily on a "Fractal Memory System" and **Spec-Driven Development**.

  * **How they work:** You define custom contexts and instructions by dropping specific Markdown files (`DESIGN.md`, `PLAN.md`, or `CONTEXT.md`) into your workspace root.
  * **Execution:** You can define complex, multi-agent pipelines as workflows and trigger them simply by typing `@workflows <workflow_name>` inside the GUI chat.

### 6\. Alternative Programmatic Interfaces (Web & Headless)

  * **`serve-web` Bug:** The `antigravity serve-web` CLI command is intended to run a server displaying the editor UI in browsers. However, as reported on the AI Dev Forums, it currently crashes with an `ENOENT` error because the `antigravity-tunnel` binary is missing from recent installation packages.
  * **Headless WebSocket API:** There is currently no native remote/headless API. However, there is massive community demand for this. A proposal for a "Stateful Remote WebSocket API for Interactive Control" currently exists as a feature request (Issue \#21559 and \#20782) on the open-source `gemini-cli` GitHub repository.

-----

### Sources

  * **Bug Reports:** [AntiGravity CLI Issues (Reddit)](https://www.reddit.com/r/google_antigravity/comments/1qr2f5h/antigravity_cli_issues/)
  * **Internal API Discussions:** [Antigravity Built-in Command for sending a query via a chat to the model](https://discuss.ai.google.dev/t/antigravity-built-in-command-for-sending-a-query-via-a-chat-to-the-model/120211) & [Pushing prompt without sending it to AI chatbox](https://discuss.ai.google.dev/t/pushing-prompt-without-sending-it-to-ai-chatbox/119858)
  * **Official Docs:** [Firebase Studio Migration](https://antigravity.google/docs/firebase-studio-migration) | [Design-to-Code with Antigravity and Stitch MCP](https://codelabs.developers.google.com/design-to-code-with-antigravity-stitch)
  * **Community SDKs & CDP Tools:** [`krishnakanthb13/antigravity_phone_chat`](https://www.google.com/search?q=%5Bhttps://github.com/krishnakanthb13/antigravity_phone_chat%5D\(https://github.com/krishnakanthb13/antigravity_phone_chat\)) | [`Kanezal/antigravity-sdk`](https://www.google.com/search?q=%5Bhttps://github.com/Kanezal/antigravity-sdk%5D\(https://github.com/Kanezal/antigravity-sdk\))
  * **`serve-web` Bug:** [How to use `antigravity serve-web`?](https://www.google.com/search?q=%5Bhttps://discuss.ai.google.dev/t/how-to-use-antigravity-serve-web/132619%5D\(https://discuss.ai.google.dev/t/how-to-use-antigravity-serve-web/132619\))


## gpt的回复

I traced the wires through official docs, Google’s forum, public issues, and community threads. My best read: `antigravity chat [prompt]` is not a stable supported automation surface right now. It is publicly known to fail, not publicly documented as by-design, and I did not find a public fix note for it. ([Google AI Developers Forum][1])

## 1. Bug status

**Verdict:** publicly known, unofficially acknowledged, not publicly resolved, and not documented as intended behavior. Treat it as a bug or at minimum a broken/underdocumented feature, not a reliable API. ([Google AI Developers Forum][1])

On **January 24, 2026**, a Google AI Developers Forum thread reported essentially your exact repro on macOS: `agy chat --mode agent --reuse-window "test"` activates Antigravity, but no conversation starts. On **March 28, 2026**, another user replied that they had the same issue. Google’s only public response in that thread was to update to the latest version and retest. There was no public statement that this behavior is expected. ([Google AI Developers Forum][1])

There is also community corroboration outside the forum. A Reddit report shows `antigravity chat "msg" --reuse-window --mode agent` returning exit code 0 with no visible effect in an existing window. ([Reddit][2])

In `google-gemini/gemini-cli` issues, I did **not** find an exact public issue for this precise CLI-to-empty-chat failure, but I did find adjacent Antigravity input/submit bugs: a sidebar paste bug that auto-submits and can hang, and a Windows locale bug where prompt submission can hang indefinitely. That makes the whole prompt-delivery plumbing look a little rickety, like a tube with two missing bolts. ([GitHub][3])

**Workarounds I could actually defend:**

* Use the Antigravity UI and submit manually.
* For automation, use **Gemini CLI headless** or **ACP** instead of `antigravity chat`.
* If you need Antigravity itself to become more capable, use **MCP + rules/workflows/skills**, not chat-text injection.
* File the bug through Antigravity’s in-app **Provide Feedback / Report Issue** flow, which is the official reporting path. ([Gemini CLI][4])

## 2. Correct usage

The official docs say something narrower than the CLI syntax suggests.

The page at `/docs/command` is **not** a CLI reference. It documents the in-editor **Command** feature: press **Cmd/Ctrl+I**, get a text box at the cursor, and ask for inline completions or terminal commands. ([Google Antigravity][5])

The official getting-started docs describe agent chat as a **UI feature**: open the side panel with **Cmd/Ctrl+L** or work in Agent Manager, type your prompt there, use `@` for files/directories/MCP servers, and `/` for workflows. They also document the conversation modes **Fast** and **Planning**. ([Google Codelabs][6])

What I **did not** find is a public web doc that explains the behavior contract for `antigravity chat [prompt]`. I found no official statement saying the positional prompt should auto-submit, only prefill, or behave in some third way. So the “right way” that is actually documented today is:

* **Interactive Antigravity chat:** open the UI chat and send there. ([Google Codelabs][6])
* **Programmatic non-GUI execution:** use **Gemini CLI** with `-p/--prompt` or `--acp`. ([Gemini CLI][4])

## 3. Surface-by-surface findings

### Internal command API

I found evidence for `antigravity.prioritized.chat.openNewConversation` and `antigravity.sendTextToChat`, but only in forum discussions, not in public documentation. Community testing says:

* `openNewConversation` just opens the chat UI.
* `sendTextToChat` can push text into the chat box, but as an `@...` mention-like token rather than plain text.
* Passing an object can render as `@[object Object]`.
* At least two extension authors still could not inject plain text cleanly or actually send the message. ([Google AI Developers Forum][7])

A separate thread from the Spring Tools authors asked Google for the command ID and parameter schema needed to send a query into chat. Google forwarded that internally on **March 9, 2026**, and as of **March 23, 2026** there was still no public answer with command docs or a supported schema. ([Google AI Developers Forum][8])

I found **no** public documentation for an external `antigravity --command` style trigger. The only invocation pattern I found was from inside an extension via `vscode.commands.executeCommand(...)`. ([Google AI Developers Forum][7])

### MCP integration path

This area is much better documented.

Official docs say Antigravity supports MCP, lets you manage servers from the agent panel, and stores raw MCP config in `~/.gemini/antigravity/mcp_config.json`. The config supports local stdio servers via `command`/`args` and remote servers via `serverUrl`. ([Google Antigravity][9])

Once an MCP server is registered, **yes**, the agent can use it from chat. The official getting-started guide says `@` can include **MCP servers** as chat context, and the MCP docs say connected servers can inform suggestions with live data such as Neon or Supabase schema information. ([Google Codelabs][6])

On **per-workspace MCP**, the answer today is effectively **no**. An official forum reply on **December 30, 2025** says a feature request would be filed, and on **April 9, 2026** the public response was still just “shared with our internal team,” while users reported having to keep editing a global config. ([Google AI Developers Forum][10])

On **remote/OAuth MCP**, the situation is still awkward. A March 28 guide says Antigravity does not currently support the MCP OAuth spec, and the Supabase maintainer reported that while `serverUrl` exists, native OAuth-based remote connection was not working for them, with `mcp-remote` used as the workaround. ([Google AI Developers Forum][11])

### Extension API for chat

For extension authors, the closest documented surface is the **standard VS Code AI extensibility API**, not an Antigravity-specific one.

VS Code documents:

* the `vscode.chat` namespace,
* custom chat participants via `vscode.chat.createChatParticipant`,
* language model tools,
* language model chat providers. ([Visual Studio Code][12])

VS Code also documents that MCP tools can be configured programmatically by extensions. ([Visual Studio Code][13])

Antigravity is explicitly described in Google’s own getting-started material as a fork of VS Code and supports extensions, so the VS Code extension model is the nearest public, documented API surface I found. ([Google Codelabs][6])

What I **did not** find is a documented `antigravity.chat` API that lets an extension:

* send arbitrary text into the built-in Antigravity agent panel,
* read arbitrary chat responses from that native panel,
* control the native panel the way `vscode.chat` lets you build **your own** participant/tool/model experience. ([Visual Studio Code][14])

So the clean answer is:

* **Register custom chat participants?** Yes, at the VS Code-compatible extension layer. ([Visual Studio Code][14])
* **Register tools?** Yes, via language model tools or MCP. ([Visual Studio Code][13])
* **Read/write the built-in Antigravity chat panel?** No public supported API found. ([Google AI Developers Forum][8])

### Agent mode / custom modes

Public Antigravity docs I found only document **Fast** and **Planning** as conversation-level modes. ([Google Codelabs][6])

I found **no public documentation** explaining where CLI “custom mode identifiers” are defined or how to author them. The documented customization primitives are instead:

* **Rules**, which the docs explicitly compare to system-instruction-like guidance. ([Google Codelabs][6])
* **Workflows**, which are saved prompts invoked with `/`. ([Google Codelabs][6])
* **Skills**, which are on-demand capability packages with global and workspace locations. ([Google Codelabs][6])

So today you can absolutely preload behavior and guardrails, but the public docs support that through **rules/workflows/skills**, not through a documented custom `--mode <id>` schema that bundles MCP servers, system instructions, and tool sets. ([Google Codelabs][6])

### Alternative programmatic interfaces

I found **no public Antigravity REST, WebSocket, or gRPC chat API**.

The only public `serve-web` reference I found describes it as **“Run a server that displays the editor UI in browsers.”** The related forum thread treats it as browser UI remoting and discusses a missing binary, not a programmable chat endpoint. ([Google AI Developers Forum][15])

The clearly documented non-GUI/programmatic interfaces are in **Gemini CLI**:

* **Headless mode** with `gemini -p`, including text/JSON/JSONL outputs. ([Gemini CLI][4])
* **ACP mode** with `gemini --acp`, using JSON-RPC over stdio for programmatic control. ([GitHub][16])
* **IDE integration** through the Gemini CLI Companion / ACP route. ([Gemini CLI][17])
* **Custom system prompt override** via `GEMINI_SYSTEM_MD`, plus project/user settings layering. ([Gemini CLI][18])

## 4. Integration options ranked

If your goal is **programmatic interaction that is practical today**, I would rank the options like this:

1. **Gemini CLI headless (`gemini -p`)**. Best for scripts, CI, structured output, and non-GUI automation. It is explicitly documented, supports stdout/JSON/JSONL, and can be combined with project settings and `GEMINI_SYSTEM_MD`. ([Gemini CLI][4])

2. **Gemini CLI ACP (`gemini --acp`)**. Best if you are building an IDE/plugin/orchestrator and want a documented machine-control protocol. This is the cleanest officially documented “programmatic control” path I found. ([GitHub][16])

3. **VS Code-compatible extension APIs**. Good if you want your own participant/tool/model flow inside a VS Code-like editor. Strong option for extension authors, but this is **not** the same as driving Antigravity’s built-in native agent panel. ([Visual Studio Code][14])

4. **Antigravity MCP + rules/workflows/skills**. Best if the real goal is “make the built-in Antigravity agent more useful” rather than “inject text into its chat box.” This is documented and relatively natural inside Antigravity, but it does not solve prompt auto-send. ([Google Antigravity][9])

5. **Undocumented internal commands like `antigravity.sendTextToChat`**. Only for experiments. Public evidence says the behavior is brittle and incomplete. ([Google AI Developers Forum][7])

6. **`antigravity chat [prompt]` as an automation surface**. Bottom of the list. Publicly flaky, not properly documented, and matching reports show the prompt can simply evaporate on arrival. ([Google AI Developers Forum][1])

7. **`serve-web` / `tunnel` as an API substitute**. Not recommended. Public references describe browser UI display/remote access, not a chat API. ([Google AI Developers Forum][15])

**If your hard requirement is specifically “open Antigravity and auto-send a prompt into its built-in agent from a script,” I do not see a stable, supported public method today.** The best supported alternatives are Gemini CLI headless/ACP, or extending Antigravity with MCP/rules/workflows/skills instead of trying to poke its chat input from the outside. ([Google AI Developers Forum][1])

## Sources

**Official Antigravity docs / official Google material**

* Antigravity docs home / product overview. ([Google Antigravity][19])
* Antigravity `Command` page. ([Google Antigravity][5])
* Official getting-started codelab: UI chat, `@` for MCP, `/` workflows, Fast/Planning, rules/workflows paths, skills paths, feedback/report issue. ([Google Codelabs][6])
* Antigravity MCP docs: config path, raw config, `command`/`args`, `serverUrl`, MCP-backed suggestions. ([Google Antigravity][9])

**Official Google AI Developers Forum threads**

* “Agy is not sending the chat message to antigravity.” ([Google AI Developers Forum][1])
* “Pushing prompt without sending it to AI chatbox.” ([Google AI Developers Forum][7])
* “Antigravity Built-in Command for sending a query via a chat to the model.” ([Google AI Developers Forum][8])
* “Support for per-workspace MCP config on Antigravity.” ([Google AI Developers Forum][10])
* “[Guide] Fixing Authentication for the Google Developer Knowledge MCP Server…” ([Google AI Developers Forum][11])
* “[MCP Store] Update Supabase MCP listing to use remote server.” ([Google AI Developers Forum][20])
* “How to use `antigravity serve-web`?” ([Google AI Developers Forum][15])

**Official Gemini CLI docs / repo docs**

* Headless automation tutorial. ([Gemini CLI][4])
* Headless mode reference. ([Gemini CLI][21])
* ACP mode docs. ([GitHub][16])
* IDE integration and companion spec. ([Gemini CLI][17])
* System prompt override and configuration layering/flags. ([Gemini CLI][18])

**Official VS Code API docs**

* Chat Participant API. ([Visual Studio Code][14])
* `vscode.chat` namespace. ([Visual Studio Code][12])
* AI extensibility overview. ([Visual Studio Code][13])
* Language Model Tool API. ([Visual Studio Code][22])
* Language Model Chat Provider API. ([Visual Studio Code][23])

**Public issues / community corroboration**

* `google-gemini/gemini-cli` issue: sidebar paste auto-exec + chat hang. ([GitHub][3])
* `google-gemini/gemini-cli` issue: prompt submission hang on Windows/Korean locale. ([GitHub][24])
* Reddit corroboration of `antigravity chat` returning 0 and doing nothing. ([Reddit][2])

I did not find a directly relevant public Stack Overflow thread or Anthropics repo issue for this exact Antigravity `chat [prompt]` failure in this pass.

[1]: https://discuss.ai.google.dev/t/agy-is-not-sending-the-chat-message-to-antigravity/118255 "https://discuss.ai.google.dev/t/agy-is-not-sending-the-chat-message-to-antigravity/118255"
[2]: https://www.reddit.com/r/google_antigravity/comments/1qr2f5h/antigravity_cli_issues/ "https://www.reddit.com/r/google_antigravity/comments/1qr2f5h/antigravity_cli_issues/"
[3]: https://github.com/google-gemini/gemini-cli/issues/23346 "https://github.com/google-gemini/gemini-cli/issues/23346"
[4]: https://geminicli.com/docs/cli/tutorials/automation/ "https://geminicli.com/docs/cli/tutorials/automation/"
[5]: https://antigravity.google/docs/command "https://antigravity.google/docs/command"
[6]: https://codelabs.developers.google.com/getting-started-google-antigravity "https://codelabs.developers.google.com/getting-started-google-antigravity"
[7]: https://discuss.ai.google.dev/t/pushing-prompt-without-sending-it-to-ai-chatbox/119858 "https://discuss.ai.google.dev/t/pushing-prompt-without-sending-it-to-ai-chatbox/119858"
[8]: https://discuss.ai.google.dev/t/antigravity-built-in-command-for-sending-a-query-via-a-chat-to-the-model/120211 "https://discuss.ai.google.dev/t/antigravity-built-in-command-for-sending-a-query-via-a-chat-to-the-model/120211"
[9]: https://antigravity.google/docs/mcp?utm_source=chatgpt.com "Antigravity Editor: MCP Integration"
[10]: https://discuss.ai.google.dev/t/support-for-per-workspace-mcp-config-on-antigravity/111952 "https://discuss.ai.google.dev/t/support-for-per-workspace-mcp-config-on-antigravity/111952"
[11]: https://discuss.ai.google.dev/t/guide-fixing-authentication-for-the-google-developer-knowledge-mcp-server-and-other-cloud-servers-in-antigravity/136601 "https://discuss.ai.google.dev/t/guide-fixing-authentication-for-the-google-developer-knowledge-mcp-server-and-other-cloud-servers-in-antigravity/136601"
[12]: https://code.visualstudio.com/api/references/vscode-api "VS Code API | Visual Studio Code Extension
API"
[13]: https://code.visualstudio.com/api/extension-guides/ai/ai-extensibility-overview "AI extensibility in VS Code | Visual Studio Code Extension
API"
[14]: https://code.visualstudio.com/api/extension-guides/ai/chat "Chat Participant API | Visual Studio Code Extension
API"
[15]: https://discuss.ai.google.dev/t/how-to-use-antigravity-serve-web/132619 "How to use `antigravity serve-web`? - Google Antigravity - Google AI Developers Forum"
[16]: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/acp-mode.md "https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/acp-mode.md"
[17]: https://geminicli.com/docs/ide-integration/ide-companion-spec/ "https://geminicli.com/docs/ide-integration/ide-companion-spec/"
[18]: https://geminicli.com/docs/cli/system-prompt/ "https://geminicli.com/docs/cli/system-prompt/"
[19]: https://antigravity.google/docs/home "https://antigravity.google/docs/home"
[20]: https://discuss.ai.google.dev/t/mcp-store-update-supabase-mcp-listing-to-use-remote-server/118196 "https://discuss.ai.google.dev/t/mcp-store-update-supabase-mcp-listing-to-use-remote-server/118196"
[21]: https://geminicli.com/docs/cli/headless/ "https://geminicli.com/docs/cli/headless/"
[22]: https://code.visualstudio.com/api/extension-guides/ai/tools "Language Model Tool API | Visual Studio Code Extension
API"
[23]: https://code.visualstudio.com/api/extension-guides/ai/language-model-chat-provider "Language Model Chat Provider API | Visual Studio Code Extension
API"
[24]: https://github.com/google-gemini/gemini-cli/issues/23428 "https://github.com/google-gemini/gemini-cli/issues/23428"

