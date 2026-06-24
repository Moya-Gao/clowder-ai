---
title: CodexPro 拆解 — "用户当路由器" 问题的真相
date: 2026-06-20
authors: [opus-47]
type: deep-dive
status: teardown-complete
related: [F-cloud-cat-family-strawman]
source_repo: https://github.com/rebel0789/codexpro
source_commit: 03556103b3dc6de2e67e6e64835a72363c3a71a1
source_date: 2026-06-20
local_path: /Users/lysander/projects/ref/codexpro
---

# CodexPro 拆解 — "用户当路由器" 问题的真相

> **铲屎官原始问题**：CodexPro 怎么解决"用户 24h 当路由器"？ChatGPT 主动通知用户？双向通信？走 OpenAI ToS 灰色地带？核心 features 都是啥？
>
> **TL;DR**：**CodexPro 完全没解决"路由器"问题，他们明示拒绝解决**。他们的核心设计就是 user-driven + `.ai-bridge` 文件桥做异步握手。"不绕 ToS" 是他们 README §Status 和 §Compliance boundary 公开写的边界。
>
> 但他们的 3 个工程手法值得我们学，能把铲屎官的"24h 路由器"压缩成**"被动通知 + 一键启动" 每次 ~10 秒**。

## 1. CodexPro 不是什么

| 铲屎官期望 | CodexPro 实际 |
|---|---|
| ChatGPT 主动通知用户 | ❌ 没有任何机制 |
| ChatGPT ↔ 本地真双向 | ❌ 完全 user-driven |
| 自动召唤云端 LLM | ❌ README §Status 明确拒绝 |
| 走 OpenAI ToS 灰色地带 | ❌ §Compliance boundary 明确"不 bypass" |

**README §Status 原话**（粘贴避免我转述偏差）：
> "CodexPro does not bypass, avoid, increase, pool, resell, or modify ChatGPT, Codex, OpenAI, or third-party model limits."

**§Compliance boundary 关键 3 条**：
> - It does not scrape or act as pass-through middleware for third-party services
> - It does not automate ChatGPT, Codex, or terminal approval flows to bypass product security, rate limits, quota limits, account access, or review prompts
> - **Remote MCP tools do not execute Codex/OpenCode/Pi/local agents. Agent execution is a separate user-started CLI/watch process on the user's machine.**

**grep 全 src/ 验证**：没有 `poll` / `notification` / `webhook` / `cron` / `websocket` / `sse` 任何 push 机制（src/http.ts 里只有 button onClick 等 UI listener，不算）。

## 2. CodexPro 真正解决的问题

不是 "ChatGPT 找你"，而是 **"ChatGPT 在被你召唤时能看到完整 repo + 调本地工具"**。它的 5 个核心 features：

### F1. Stdio + Remote HTTP 双 MCP entry
- `src/stdio.ts` — Claude Desktop / Cursor 类 stdio client
- `src/http.ts` — Streamable HTTP，配合 cloudflared quick tunnel / ngrok / cloudflared named tunnel 暴露公网（让 ChatGPT Web Developer Mode 接入）
- 同套 tool 实现，两个 transport

### F2. 高质量小数量工具集（standard mode 推荐）
README §Tools 原话：
> "ChatGPT behaves better when routine work goes through a few high-signal tools instead of a large action catalog."

Standard mode 14 工具：`server_config / codexpro_self_test / open_current_workspace / open_workspace / tree / search / load_skill / read / write / edit / bash / show_changes / read_handoff / handoff_to_agent`。**对应我们 fable-phase0 / cloud-pro-phase0 的 10 工具白名单设计哲学一致——不堆量，给少而精**。

### F3. `.ai-bridge/` 文件桥（这是真"双向"）

**真正的 ChatGPT ↔ 本地猫双向是通过文件做异步握手**：
```
ChatGPT 启对话 → 调 MCP 工具看 repo → 写 plan → handoff_to_codex 把 plan 写到 .ai-bridge/current-plan.md
                                                                      ↓
本地 IDE Codex 启动 → 读 .ai-bridge/current-plan.md → 实施 → 写 .ai-bridge/codex-status.md
                                                                      ↓
ChatGPT 下次启对话 → 调 read_handoff → 看到 codex-status.md → 知道进展
```

**关键**：这是 **async pull 模式**，不要求 ChatGPT 端常驻 / 不要求即时通信。文件桥做缓冲。

### F4. CHATGPT_PROMPT.md（"教 ChatGPT 怎么用我们家"）

这是 CodexPro 的 **invisible 神器** —— 用户粘贴到 ChatGPT 对话开头，让 ChatGPT 自动知道：
```
Use CodexPro.
Call server_config first, then open_current_workspace with include_tree=false.
Do not call open_workspace after open_current_workspace unless I ask you to switch roots.
Call codexpro_inventory only when you need local skill or MCP server names.
Act as a coding agent. Inspect the relevant files, make the requested source edits with write/edit, then verify with search/read/bash and git_diff or git_status when useful.
Keep changes scoped to the request. Do not use handoff_to_codex unless I explicitly ask for planning-only handoff.
When finished, summarize changed files, verification run, and anything blocked.
```

**学到的关键**：与其在 server 端做 routing 魔法，不如**给 ChatGPT 一个"开机指令"**，让它自己知道每次启动先调什么。这把"用户教 ChatGPT 怎么用"压缩成一次性 copy-paste。

### F5. 安全沙盒（值得我们继承）
- `workspace-only writes`（PathGuard 阻止越界写）
- `blocked secret/build/cache paths`（默认 deny secret 文件读）
- `safe bash mode`（allowlist 命令）
- `token-protected public URLs`（HTTP entry 强制 token）
- `redact module`（`src/redact.ts` 在所有 output 前过滤敏感字符串）

## 3. CodexPro 没解决但你想要的：解法清单

铲屎官期望"不当 24h 路由器"。**ChatGPT Web 的硬约束让"真主动通知"不可能**（除非走 ToS 灰色地带，CodexPro 拒绝走我们也拒绝）。但有 3 条工程手法能把"24h 路由器"压缩成 **"被动通知 + 一键启动" 每次 ~10 秒**：

### S1. 角色收窄 — 砚砚不当 24h 聊天猫

让砚砚定位为**高阶判断席位**（Design Gate / Architecture Review / Risk Audit），不是日常聊天猫。日常对话用本地 opus/codex/gemini，他们能 cron 触发常驻。

→ "找砚砚" 的频率从"每条消息" 降到"真重要决策时"。

### S2. 通知触发 — 邮件 / iMessage / Slack

猫咖 server 检测到：
- 铲屎官 @yanyan-cloud
- 本地猫调 `request_cloud_review` 工具
- 触发 design gate 阶段

→ 推**邮件/iMessage/Slack** 给铲屎官手机（带 thread context + deep link 到 ChatGPT）。

铲屎官投入：**收通知 ~5 秒 + 点 link ~3 秒**。

### S3. CHATGPT_PROMPT 教砚砚 self-poll

借鉴 CodexPro 的 CHATGPT_PROMPT.md，给砚砚写一份 system prompt：
```
Use cat-cafe-toolkits.
Call get_pending_mentions first to check if anyone @yanyan-cloud since you last responded.
Call get_thread_context for each pending mention to get full conversation.
Read the @user's question, think, then post_message to reply.
For architecture decisions, use publish_verdict (when authorized).
```

铲屎官每次跳 ChatGPT 启对话，第一句粘 prompt（或粘可复用的 alias）。砚砚自检 → 拉 context → 回复。

铲屎官投入：**粘 prompt ~5 秒**。

### S4. 异步任务桥（CodexPro `.ai-bridge` 启发）

实现 `.cloud-cat-bridge/` 目录：
- 本地猫写 `request-yanyan-review.md`（描述要 review 的 spec / decision）
- 砚砚下次启对话调 `read_pending_reviews` → 看到 → 写 verdict 到 `verdicts/<id>.md`
- 本地猫定期 pull verdicts 看回复

→ **批量异步**模式，不强求即时响应。砚砚一次启动能处理 5 个 pending review。

### S5. 不去触碰的 灰色地带

⚠️ **不做**：
- Browser automation 替铲屎官在 ChatGPT 自动 enter
- OpenAI API 假装"砚砚 daemon"（API ≠ ChatGPT Pro 订阅 + 走 API 不算 ChatGPT Pro 用户体验）
- 任何"突破 ChatGPT Web rate limit / approval flow"

→ 同 CodexPro 一样守住 ToS 边界。

## 4. 给铲屎官的诚实回答 - 三件套

| 你的问题 | 答案 |
|---|---|
| **"砚砚怎么主动找我？"** | **不能**，ChatGPT Web 硬约束。但可以让通知系统替砚砚"喊你"（S2 邮件 / iMessage） |
| **"我得 24h 当路由器？"** | **不用**，压缩成"收通知 → 点 link → 粘 prompt → 砚砚自检处理" 总时间 ~10 秒/次 |
| **"砚砚回的消息能出现在猫咖前端？"** | **能**，spike 已 PoC（砚砚 ChatGPT 调 post_message MCP 工具 → 直推猫咖 thread → 前端渲染气泡）|

## 5. F-cloud-cat-family strawman 更新

原 strawman §2.3 "多 provider 接入框架"加：

- **召唤路径**：邮件/iMessage 通知 + deep link to ChatGPT + 自动复制 prompt 到剪贴板
- **自检 prompt**：每个云端猫接入时一并生成 system prompt（教 ChatGPT 启动时调啥工具）
- **异步任务桥**：`.cloud-cat-bridge/` 文件协议（reuse CodexPro `.ai-bridge` 设计）
- **不去触碰**：明示哲学边界（不 automate ChatGPT，不假装"砚砚 daemon"）

## 6. 学 / 不学 / Gap

### 学
- ✅ Stdio + HTTP 双 entry（cat-cafe MCP 已有 stdio，HTTP 是 spike 验证过的）
- ✅ 高质量小数量工具集（fable-phase0 / cloud-pro-phase0 已有此哲学）
- ✅ `.ai-bridge` 文件桥设计（用于跨 ChatGPT 启动会话的异步握手）
- ✅ CHATGPT_PROMPT.md 模式（教 ChatGPT 自检 + self-poll）
- ✅ redact 模块在所有 output 前过滤敏感字符串（**我们 spike server 还没做，48 R2 P0 暴露面风险减一档**）

### 不学
- ❌ "ChatGPT 当 IDE 远程助手" 这个定位（我们是"砚砚当家庭成员"，scope 不同）
- ❌ 工作流以 `git status / git diff / show_changes` 为中心（我们的中心是 thread message / memory recall）

### Gap（我们要做但他们没做）
- ❗ **前端气泡 / avatar / 多 provider 配置 UI**（我们要做，CodexPro 不需要，他们是 CLI 工具）
- ❗ **猫咖现有的 thread / memory / task 系统**集成（CodexPro 是 repo-centric，没 thread）
- ❗ **本地猫主动 request review**（CodexPro 是用户直接对 ChatGPT 说，我们是本地猫委托）

## 7. 候选 lessons / 沉淀

| Lesson | 来源 |
|---|---|
| 学：把"教 LLM 用我们家"做成 copy-paste prompt | CodexPro CHATGPT_PROMPT.md |
| 学：异步文件桥 > 强求即时双向 | CodexPro `.ai-bridge/` |
| 学：redact 模块在所有 output 前过滤 secret | CodexPro `src/redact.ts` |
| 边界：守住 ToS，不 automate 用户已订阅服务 | CodexPro §Compliance boundary |
| 实测：grep 全 src 无 polling / webhook / push 机制 | 本拆解 §1 |

[宪宪/Opus-4.7🐾]
