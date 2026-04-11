---
feature_ids: []
topics: [env, reference]
doc_kind: reference
created: 2026-03-28
---

# Cat Cafe 环境变量参考

> 自动生成于 2026-03-28，真相源：`packages/api/src/config/env-registry.ts`
> 
> 运行 \`pnpm gen:env-reference\` 重新生成。

共 137 个变量，17 个分类。

## 服务器 (`server`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `API_SERVER_PORT` | 3002 | API 服务端口 |  |
| `PREVIEW_GATEWAY_PORT` | 4100 | Preview Gateway 端口（F120 独立 origin 反向代理） |  |
| `API_SERVER_HOST` | 127.0.0.1 | API 监听地址 |  |
| `UPLOAD_DIR` | ./uploads | 文件上传目录 |  |
| `PROJECT_ALLOWED_ROOTS` | (未设置 — 使用 denylist 模式，仅拦截系统目录) | Legacy allowlist 模式：设置后切换为 allowlist，仅允许列出的根目录（按系统路径分隔符分隔；配合 PROJECT_ALLOWED_ROOTS_APPEND=true 可追加默认 roots）。未设置时使用 denylist 模式（见 PROJECT_DENIED_ROOTS）。 |  |
| `PROJECT_ALLOWED_ROOTS_APPEND` | false | 设为 true 则将 PROJECT_ALLOWED_ROOTS 追加到默认根目录（home, /tmp, /workspace 等）而非覆盖 |  |
| `PROJECT_DENIED_ROOTS` | (平台默认系统目录) | Denylist 模式下额外拦截的目录（按系统路径分隔符分隔，会合并到平台默认拦截列表）。仅在未设置 PROJECT_ALLOWED_ROOTS 时生效。 |  |
| `FRONTEND_URL` | (自动检测) | 前端 URL（导出长图用） |  |
| `FRONTEND_PORT` | 3000 | 前端端口（导出长图用） |  |
| `DEFAULT_OWNER_USER_ID` | (未设置) | 默认所有者用户 ID |  |
| `CAT_CAFE_USER_ID` | default-user | 当前用户 ID |  |
| `CAT_CAFE_HOOK_TOKEN` | (空) | Hook 回调鉴权 token | 🔒 |
| `RUNTIME_REPO_PATH` | (未设置) | Runtime 仓库路径（自动更新用） |  |
| `WORKSPACE_LINKED_ROOTS` | (未设置) | 工作区关联的项目根（冒号分隔） |  |
| `HYPERFOCUS_THRESHOLD_MS` | 5400000 (90分钟) | Hyperfocus 健康提醒阈值 |  |
| `ANTHROPIC_API_KEY` | (未设置 → 使用 proxy profile) | Anthropic API Key（直连模式；proxy 模式由 provider profile 注入） | 🔒 |
| `LOG_LEVEL` | info | 日志级别（debug / info / warn / error） |  |
| `DEBUG` | false | 调试模式开关（详细日志，非生产环境用） |  |
| `MCP_SERVER_PORT` | 3011 | MCP Server 监听端口 |  |
| `PREVIEW_GATEWAY_ENABLED` | 1（启用） | 设为 0 禁用 Preview Gateway（F120） |  |
| `GAME_NARRATOR_ENABLED` | (未设置 → 不启用) | 设为 true 启用游戏叙述者模式 |  |
| `WEB_PUBLIC_DIR` | ../web/public | Web 前端静态文件目录（connector gateway 静态资源服务） |  |
| `CAT_CAFE_CONFIG_ROOT` | (未设置 → 使用 cwd) | 平台配置根目录（与 cwd 解耦，平台启动脚本设置） |  |
| `CAT_CAFE_GLOBAL_CONFIG_ROOT` | (未设置 → homedir()) | 全局配置根目录（cat catalog / credentials / provider profiles 查找路径） |  |
| `ALLOWED_WORKSPACE_DIRS` | (未设置) | MCP Server 允许访问的工作目录列表（逗号分隔） |  |

## 存储 (`storage`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `REDIS_URL` | (未设置 → 内存模式) | Redis 连接地址 |  |
| `REDIS_KEY_PREFIX` | cat-cafe: | Redis key 命名空间前缀，用于多实例隔离 |  |
| `MEMORY_STORE` | (未设置) | 设为 1 显式允许内存模式 |  |
| `MESSAGE_TTL_SECONDS` | 0 (永久) | 消息过期时间（>0 启用自动过期，单位秒） |  |
| `THREAD_TTL_SECONDS` | 0 (永久) | 对话过期时间（>0 启用自动过期，单位秒） |  |
| `TASK_TTL_SECONDS` | 0 (永久) | 任务过期时间（>0 启用自动过期，单位秒） |  |
| `SUMMARY_TTL_SECONDS` | 0 (永久) | 摘要过期时间（>0 启用自动过期，单位秒） |  |
| `BACKLOG_TTL_SECONDS` | (无过期) | Backlog 过期时间 |  |
| `DRAFT_TTL_SECONDS` | (无过期) | 草稿过期时间 |  |
| `TRANSCRIPT_DATA_DIR` | ./data/transcripts | Session transcript 存储目录 |  |

## 猫猫预算 (`budget`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `MAX_PROMPT_CHARS` | (per-cat 默认) | 全局 prompt 字符上限 |  |
| `CAT_OPUS_MAX_PROMPT_CHARS` | 150000 | 布偶猫 prompt 上限 |  |
| `CAT_CODEX_MAX_PROMPT_CHARS` | 80000 | 缅因猫 prompt 上限 |  |
| `CAT_GEMINI_MAX_PROMPT_CHARS` | 150000 | 暹罗猫 prompt 上限 |  |
| `MAX_CONTEXT_MSG_CHARS` | 1500 | 单条消息上下文截断 |  |
| `MAX_A2A_DEPTH` | 15 | A2A 猫猫互调最大深度 |  |
| `MAX_PROMPT_TOKENS` | (未设置) | 全局 prompt token 上限 |  |
| `WEB_PUSH_TIMEOUT_MS` | (未设置) | Web Push 超时时间 |  |

## CLI (`cli`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `CLI_TIMEOUT_MS` | — | CLI 调用超时 |  |
| `CAT_TEMPLATE_PATH` | (repo 根 cat-template.json) | 猫猫模板文件路径 |  |
| `CAT_CAFE_MCP_SERVER_PATH` | (自动检测) | MCP Server 路径 |  |
| `AUDIT_LOG_DIR` | ./data/audit-logs | 审计日志目录 |  |
| `CLI_RAW_ARCHIVE_DIR` | ./data/cli-raw-archive | CLI 原始日志归档目录 |  |
| `AUDIT_LOG_INCLUDE_PROMPT_SNIPPETS` | false | 审计日志包含 prompt 片段 |  |
| `CAT_BRANCH_ROLLBACK_RETRY_DELAYS_MS` | 1000,2000,4000 | Branch 回滚重试间隔 |  |
| `MODE_SWITCH_REQUIRES_APPROVAL` | true | 模式切换需要确认 |  |
| `CAT_CAFE_TMUX_AGENT` | (未设置) | 设为 1 启用 tmux agent 模式 |  |
| `CAT_CAFE_TMUX_PATH` | (未设置) | Tmux 可执行文件路径 |  |
| `CAT_CAFE_DATA_DIR` | (未设置) | 数据目录根路径 |  |
| `CAT_CAFE_CALLBACK_TOKEN` | (未设置) | Callback 鉴权 token | 🔒 |
| `CAT_CAFE_CALLBACK_OUTBOX_ENABLED` | true | Callback outbox 是否启用 |  |
| `CAT_CAFE_CALLBACK_OUTBOX_DIR` | (自动) | Callback outbox 目录 |  |
| `CAT_CAFE_CALLBACK_OUTBOX_MAX_ATTEMPTS` | (默认) | Outbox 最大重试次数 |  |
| `CAT_CAFE_CALLBACK_OUTBOX_MAX_FLUSH_BATCH` | (默认) | Outbox 单次 flush 批量 |  |
| `CAT_CAFE_CALLBACK_RETRY_DELAYS_MS` | (默认) | Callback 重试间隔（逗号分隔） |  |
| `CDP_DEBUG` | (未设置) | CDP Bridge 调试模式 |  |
| `CODEX_HOME` | ~/.codex | Codex CLI home 目录 |  |
| `CAT_CAFE_API_URL` | http://localhost:3002 | API 服务地址（由 API 进程注入 MCP Server 子进程 env） |  |
| `CAT_CAFE_INVOCATION_ID` | (运行时注入) | 当前 invocation ID（由 API 进程注入 MCP Server 子进程 env） |  |
| `CAT_CAFE_CAT_ID` | (运行时注入) | 当前猫 ID（由 API 进程注入 MCP Server 子进程 env） |  |
| `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT` | (未设置) | 设为 1 跳过 shared state preflight 检查（CI / 调试用） |  |

## Anthropic 代理网关 (`proxy`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `ANTHROPIC_PROXY_ENABLED` | 1 | Anthropic 代理网关开关（0 关闭） |  |
| `ANTHROPIC_PROXY_PORT` | 9877 | 代理网关监听端口 |  |
| `ANTHROPIC_PROXY_DEBUG` | (未设置) | 设为 1 启用代理调试日志 |  |
| `ANTHROPIC_PROXY_UPSTREAMS_PATH` | .cat-cafe/proxy-upstreams.json | upstream 配置文件路径（解决 runtime 与源码分离问题） |  |
| `HTTPS_PROXY` | (未设置) | HTTPS 代理地址（Web Push / 外部 HTTP 请求用） |  |
| `HTTP_PROXY` | (未设置) | HTTP 代理地址 |  |
| `ALL_PROXY` | (未设置) | 通用代理地址（HTTP/HTTPS/SOCKS 通用 fallback） |  |

## 平台接入 (Telegram/飞书) (`connector`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `TELEGRAM_BOT_TOKEN` | (未设置 → 不启用) | Telegram Bot Token | 🔒 |
| `FEISHU_APP_ID` | (未设置 → 不启用) | 飞书应用 App ID |  |
| `FEISHU_APP_SECRET` | (未设置) | 飞书应用 App Secret | 🔒 |
| `FEISHU_VERIFICATION_TOKEN` | (未设置) | 飞书 webhook 验证 token（仅 webhook 模式需要） | 🔒 |
| `FEISHU_CONNECTION_MODE` | webhook | 飞书连接模式：webhook（需公网 URL）或 websocket（长连接，无需公网） |  |
| `DINGTALK_APP_KEY` | (未设置 → 不启用) | 钉钉应用 AppKey |  |
| `DINGTALK_APP_SECRET` | (未设置) | 钉钉应用 AppSecret | 🔒 |
| `FEISHU_BOT_OPEN_ID` | (未设置) | 飞书机器人 Open ID（接收消息的 bot 身份标识） |  |
| `FEISHU_ADMIN_OPEN_IDS` | (未设置) | 飞书管理员 Open ID 列表（逗号分隔） |  |
| `WEIXIN_BOT_TOKEN` | (未设置 → 不启用) | 微信机器人 Token（F137 微信个人网关） | 🔒 |
| `WECOM_BOT_ID` | (未设置 → 不启用智能机器人模式) | 企业微信智能机器人 Bot ID（WebSocket 长连接模式） |  |
| `WECOM_BOT_SECRET` | (未设置) | 企业微信智能机器人 Bot Secret | 🔒 |
| `WECOM_CORP_ID` | (未设置 → 不启用自建应用模式) | 企业微信企业 ID（自建应用 HTTP 回调模式） |  |
| `WECOM_AGENT_ID` | (未设置) | 企业微信自建应用 AgentId |  |
| `WECOM_AGENT_SECRET` | (未设置) | 企业微信自建应用 Secret | 🔒 |
| `WECOM_TOKEN` | (未设置) | 企业微信回调 Token（HTTP 模式验签） | 🔒 |
| `WECOM_ENCODING_AES_KEY` | (未设置) | 企业微信回调 EncodingAESKey（43字符，HTTP 模式解密用） | 🔒 |
| `GITHUB_WEBHOOK_SECRET` | (未设置 → 不启用) | GitHub webhook HMAC-SHA256 shared secret（F141 Repo Inbox） | 🔒 |
| `GITHUB_REPO_ALLOWLIST` | (未设置) | 允许的仓库列表，逗号分隔（如 zts212653/clowder-ai） |  |
| `GITHUB_REPO_INBOX_CAT_ID` | (未设置) | 接收 Repo Inbox 事件的猫 ID |  |
| `GITHUB_AUTHORITATIVE_REVIEW_LOGINS` | chatgpt-codex-connector[bot] | Comma-separated GitHub logins whose review feedback is handled by the email channel (authoritative source). F140 API polling skips these to avoid double-delivery. |  |
| `GITHUB_TOKEN` | (未设置) | GitHub Personal Access Token（Scheduler 仓库活跃度模板 HTTP 请求鉴权） | 🔒 |
| `CONNECTOR_MEDIA_DIR` | ./data/connector-media | 连接器媒体下载目录 |  |

## 缅因猫 (Codex) (`codex`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `CAT_CODEX_SANDBOX_MODE` | danger-full-access | 缅因猫沙箱模式 |  |
| `CAT_CODEX_APPROVAL_POLICY` | on-request | 缅因猫审批策略 |  |
| `CODEX_AUTH_MODE` | oauth | 缅因猫认证方式 (oauth/api_key) |  |
| `OPENAI_API_KEY` | (未设置) | OpenAI API Key (api_key 模式用) | 🔒 |

## 狸花猫 (Dare) (`dare`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `DARE_ADAPTER` | openrouter | 狸花猫适配器 |  |
| `DARE_PATH` | (未设置) | Dare CLI 路径 |  |

## 暹罗猫 (Gemini) (`gemini`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `GOOGLE_API_KEY` | (未设置) | Google API Key（暹罗猫 Gemini 直连用） | 🔒 |
| `GEMINI_ADAPTER` | gemini-cli | 暹罗猫适配器 (gemini-cli/antigravity) |  |

## 语音合成 (TTS) (`tts`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `TTS_URL` | http://localhost:9879 | TTS 服务地址 (Qwen3-TTS) |  |
| `TTS_CACHE_DIR` | ./data/tts-cache | TTS 音频缓存目录 |  |
| `GENSHIN_VOICE_DIR` | ~/projects/.../genshin | GPT-SoVITS 角色模型目录 |  |
| `CHARACTER_VOICE_DIR` | (未设置 → dirname(GENSHIN_VOICE_DIR)) | 角色语音模型根目录（优先级高于 GENSHIN_VOICE_DIR） |  |

## 语音识别 (STT) (`stt`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `WHISPER_URL` | http://localhost:9876 | Whisper STT 服务地址（服务端） |  |

## 前端 (`frontend`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `NEXT_PUBLIC_API_URL` | http://localhost:3002 | 前端连接的 API 地址 |  |
| `NEXT_PUBLIC_WHISPER_URL` | http://localhost:9876 | Whisper ASR 服务地址 |  |
| `NEXT_PUBLIC_LLM_POSTPROCESS_URL` | http://localhost:9878 | LLM 后处理服务地址 |  |
| `NEXT_PUBLIC_PROJECT_ROOT` | (空) | 前端项目根路径 |  |
| `NEXT_PUBLIC_DEBUG_SKIP_FILE_CHANGE_UI` | (未设置) | 设为 1 跳过文件变更 UI |  |

## 推送通知 (`push`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `VAPID_PUBLIC_KEY` | (未设置 → 推送不可用) | VAPID 公钥 (Web Push) |  |
| `VAPID_PRIVATE_KEY` | (未设置) | VAPID 私钥 (Web Push) | 🔒 |
| `VAPID_SUBJECT` | mailto:cat-cafe@localhost | VAPID 联系方式 (mailto: 或 URL) |  |

## Signal 信号源 (`signal`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `SIGNALS_ROOT_DIR` | (未设置) | Signal 信号源数据目录 |  |
| `CAT_CAFE_SIGNAL_USER` | codex | Signal 默认执行猫 |  |

## GitHub Review 监控 (`github_review`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `GITHUB_REVIEW_IMAP_USER` | (未设置 → 监控不启用) | QQ 邮箱地址 (xxx@qq.com) |  |
| `GITHUB_REVIEW_IMAP_PASS` | (未设置) | QQ 邮箱授权码 (非登录密码) | 🔒 |
| `GITHUB_REVIEW_IMAP_HOST` | imap.qq.com | IMAP 服务器地址 |  |
| `GITHUB_REVIEW_IMAP_PORT` | 993 | IMAP 端口 (SSL) |  |
| `GITHUB_REVIEW_POLL_INTERVAL_MS` | 120000 | 邮件轮询间隔 (毫秒) |  |
| `GITHUB_MCP_PAT` | (未设置) | GitHub Personal Access Token (MCP 用) | 🔒 |
| `GITHUB_REVIEW_IMAP_PROXY` | (未设置) | IMAP 连接代理地址（如 socks5://127.0.0.1:1080） |  |

## F102 记忆系统 (`evidence`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `EMBED_MODE` | off | 向量检索模式 (off/shadow/on)，on = 开启 Qwen3 embedding rerank |  |
| `F102_ABSTRACTIVE` | off | Phase G 摘要调度器 (off/on)，on = 定时调用 Opus API 做 thread 摘要 |  |
| `EMBED_URL` | http://127.0.0.1:9880 | Embedding 服务地址（独立 Python GPU 进程 scripts/embed-api.py） |  |
| `F102_API_BASE` | (未设置 → 摘要调度器不启用) | Phase G 摘要调度用的反代 API 地址（不是猫猫自己的 provider profile） |  |
| `F102_API_KEY` | (未设置) | Phase G 摘要调度用的反代 API Key | 🔒 |
| `EMBED_PORT` | 9880 | Embedding 服务端口（仅在 EMBED_URL 未设置时使用） |  |

## 额度监控 (`quota`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `QUOTA_OFFICIAL_REFRESH_ENABLED` | 0（默认关闭） | 设为 1 允许官方额度抓取（需要 Chrome OAuth cookie） |  |
| `CLAUDE_CREDENTIALS_PATH` | ~/.claude/.credentials.json | Claude OAuth credentials 文件路径（官方额度刷新用） |  |
| `CODEX_CREDENTIALS_PATH` | (未设置 → ~/.codex/credentials) | Codex OAuth credentials 文件路径（官方额度刷新用） |  |
