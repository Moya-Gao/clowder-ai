---
feature_ids: []
topics: [env, reference]
doc_kind: reference
created: 2026-06-11
---

# Cat Cafe 环境变量参考

> 自动生成于 2026-06-11，真相源：`packages/api/src/config/env-registry.ts`
> 
> 运行 \`pnpm gen:env-reference\` 重新生成。

共 223 个变量，21 个分类。

## 服务器 (`server`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `API_SERVER_PORT` | 3002 | API 服务端口 |  |
| `PREVIEW_GATEWAY_PORT` | 4100 | Preview Gateway 端口（F120 独立 origin 反向代理） |  |
| `REDIS_PORT` | 6399 | Redis 端口（governance pack 用于生成外部项目规则） |  |
| `REDIS_DEV_PORT` | 6398 | Redis 开发/测试端口（governance pack 用于生成外部项目规则） |  |
| `API_SERVER_HOST` | 127.0.0.1 | API 监听地址（改为 0.0.0.0 可让手机/平板通过局域网或 Tailscale 访问） |  |
| `CORS_ALLOW_PRIVATE_NETWORK` | false | 允许局域网/Tailscale 设备访问（手机、平板等）。开启后，来自 192.168.x.x / 10.x.x.x / Tailscale 100.x.x.x 的浏览器可以正常连接。注意：会信任整个私网内的所有设备。修改后需重启服务生效 |  |
| `UPLOAD_DIR` | ./uploads | 文件上传目录 |  |
| `PROJECT_ALLOWED_ROOTS` | (未设置 — 使用 denylist 模式，仅拦截系统目录) | Legacy allowlist 模式：设置后切换为 allowlist，仅允许列出的根目录（按系统路径分隔符分隔；配合 PROJECT_ALLOWED_ROOTS_APPEND=true 可追加默认 roots）。未设置时使用 denylist 模式（见 PROJECT_DENIED_ROOTS）。 |  |
| `PROJECT_ALLOWED_ROOTS_APPEND` | false | 设为 true 则将 PROJECT_ALLOWED_ROOTS 追加到默认根目录（home, /tmp, /workspace 等）而非覆盖 |  |
| `PROJECT_DENIED_ROOTS` | (平台默认系统目录) | Denylist 模式下额外拦截的目录（按系统路径分隔符分隔，会合并到平台默认拦截列表）。仅在未设置 PROJECT_ALLOWED_ROOTS 时生效。 |  |
| `FRONTEND_URL` | (自动检测) | 前端固定地址（有反向代理或固定域名时设置，如 https://cafe.example.com）。本机和局域网直连通常不需要改 |  |
| `FRONTEND_PORT` | 3000 | 前端端口 |  |
| `DEFAULT_OWNER_USER_ID` | (未设置) | 默认所有者用户 ID（信任锚点，不可从 Hub 修改） |  |
| `CAT_CAFE_USER_ID` | default-user | 当前用户 ID |  |
| `CAT_CAFE_HOME` | <repoRoot>/.cat-cafe | Service install data root (Python interpreter, per-service venvs, Piper voice models, etc.). Honored by scripts/services/* and the venv-probe path in service-registry — override to share install state across users / containers / mounts. |  |
| `CAT_CAFE_INVOCATION_REGISTRY` | (自动：有 Redis 用 redis，否则 memory) | F174-B InvocationRegistry 后端选择：redis（重启不丢 callback 鉴权）/ memory（fallback / 测试） |  |
| `CAT_CAFE_AGENT_KEY_SECRET` | (空) | F178 Persistent MCP Agent-Key Auth — 共享密钥（直接环境变量提供） | 🔒 |
| `CAT_CAFE_AGENT_KEY_FILE` | (空) | F178 Persistent MCP Agent-Key Auth — 密钥文件路径（CAT_CAFE_AGENT_KEY_SECRET 的备选） | 🔒 |
| `CAT_CAFE_AGENT_KEY_FILES` | (空) | F178 Persistent MCP Agent-Key Auth — catId 到密钥文件路径的 JSON 映射（Antigravity variants） | 🔒 |
| `CAT_CAFE_PROVISION_GLOBAL_SIDECAR` | 0 | F178 Persistent MCP Agent-Key Auth — 仅全局 sidecar owner（runtime 主实例）设为 1；alpha/dev 不得设置，避免覆盖 ~/.cat-cafe/agent-keys。 |  |
| `CAT_CAFE_AGENT_KEY_ALLOW_MEMORY_SIDECAR` | 0 | F178 Persistent MCP Agent-Key Auth — 本地降级开发开关；仅在 CAT_CAFE_PROVISION_GLOBAL_SIDECAR=1 且无 Redis 时允许 memory backend 写 sidecar。 |  |
| `CAT_CAFE_AGENT_KEY_SIDECAR_DISABLED` | 0 | F178 Persistent MCP Agent-Key Auth — 强制关闭全局 sidecar provisioning，优先级高于 owner 标记。 |  |
| `CAT_CAFE_HOOK_TOKEN` | (空) | Hook 回调鉴权 token | 🔒 |
| `CAT_CAFE_TEST_SANDBOX` | (未设置) | 测试沙盒写保护开关（仅测试/门禁使用） |  |
| `CAT_CAFE_TEST_SANDBOX_ALLOW_UNSAFE_ROOT` | (未设置) | 测试沙盒临时允许写入非隔离根目录（仅测试调试使用） |  |
| `CAT_CAFE_TEST_REAL_HOME` | (未设置) | 测试真实 HOME 路径快照（用于阻止测试写回宿主 HOME） |  |
| `CAT_CAFE_SERVICES_CONFIG` | (自动：~/.cat-cafe/services.json) | 服务 lifecycle UI 的启用状态配置文件路径（测试/隔离环境可覆盖） |  |
| `RUNTIME_REPO_PATH` | (未设置) | Runtime 仓库路径（自动更新用） |  |
| `WORKSPACE_LINKED_ROOTS` | (未设置) | 工作区关联的项目根（冒号分隔） |  |
| `HYPERFOCUS_THRESHOLD_MS` | 5400000 (90分钟) | Hyperfocus 健康提醒阈值 |  |
| `ANTHROPIC_API_KEY` | (未设置 → 由 accounts/credentials 系统注入) | Anthropic API Key（#340 P6: 由统一账户系统管理，不再从 .env 读取） | 🔒 |
| `LOG_LEVEL` | info | 日志级别（debug / info / warn / error） |  |
| `LOG_DIR` | ./data/logs/api | API 日志目录（Pino 滚动日志写入路径） |  |
| `DEBUG` | false | 调试模式开关（详细日志，非生产环境用） |  |
| `MCP_SERVER_PORT` | 3011 | MCP Server 监听端口 |  |
| `PREVIEW_GATEWAY_ENABLED` | 1（启用） | 设为 0 禁用 Preview Gateway（F120） |  |
| `CHROME_EXECUTABLE_PATH` | (未设置 → 自动检测系统 Chrome/Edge/Chromium) | 对话导出截图使用的 Chromium 系浏览器路径。未设置时按 Chrome > Edge > Chromium 优先级自动检测 |  |
| `GAME_NARRATOR_ENABLED` | (未设置 → 不启用) | 设为 true 启用游戏叙述者模式 |  |
| `WEB_PUBLIC_DIR` | ../web/public | Web 前端静态文件目录（connector gateway 静态资源服务） |  |
| `CAT_CAFE_CONFIG_ROOT` | (未设置 → 使用 cwd) | 平台配置根目录（与 cwd 解耦，平台启动脚本设置） |  |
| `CAT_CAFE_GLOBAL_CONFIG_ROOT` | (未设置 → homedir()) | 全局配置根目录（accounts / credentials 查找路径的父目录，实际路径为 <ROOT>/.cat-cafe/） |  |
| `CAT_CAFE_SKIP_HOMEDIR_MIGRATION` | 0 | 跳过 homedir credentials / legacy provider profiles 迁移（新安装或 opensource profile 可显式关闭） |  |
| `ALLOWED_WORKSPACE_DIRS` | (未设置) | MCP Server 允许访问的工作目录列表（逗号分隔） |  |
| `CAT_CAFE_RUNTIME_ROOT` | (未设置 → process.cwd()) | F061: Cat Café runtime 二进制根目录（runtime startup 自动 export 为 $RUNTIME_DIR），优先级高于 capability orchestrator 的 auto-detection，用于 Antigravity MCP config args 路径 |  |
| `CAT_CAFE_WORKSPACE_ROOT` | (未设置 → process.cwd()) | F061: Bengal MCP 工具的 workspace 根目录（runtime startup 自动 export 为 $PROJECT_DIR），用于 Antigravity MCP config 的 ALLOWED_WORKSPACE_DIRS env 注入 |  |

## 存储 (`storage`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `REDIS_URL` | (未设置 → 内存模式) | Redis 连接地址 |  |
| `REDIS_KEY_PREFIX` | cat-cafe: | Redis key 命名空间前缀，用于多实例隔离 |  |
| `MEMORY_STORE` | (未设置) | 设为 1 显式允许内存模式 |  |
| `MESSAGE_TTL_SECONDS` | 604800 (7天) | 消息过期时间（秒）。默认 604800（7天）。设为 0 或负数 → 消息永不过期。注意：过期的 Redis 消息不影响已索引的 evidence_passages（Phase I 保证永久性）。 |  |
| `THREAD_TTL_SECONDS` | 604800 (7天) | 对话过期时间 |  |
| `TASK_TTL_SECONDS` | 604800 (7天) | 任务过期时间 |  |
| `SUMMARY_TTL_SECONDS` | 604800 (7天) | 摘要过期时间 |  |
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
| `CAT_CAFE_SUPERVISOR_PARENT_PID` | (内部注入) | CLI supervisor 内部父进程 PID，不需要手动设置 |  |
| `CAT_CAFE_SUPERVISOR_POLL_MS` | 1000 | CLI supervisor 内部父进程存活检查间隔 |  |
| `CAT_CAFE_SUPERVISOR_KILL_GRACE_MS` | 3000 | CLI supervisor 内部 SIGTERM 到 SIGKILL 的等待时间 |  |
| `CAT_TEMPLATE_PATH` | (repo 根 cat-template.json) | 猫猫模板文件路径 |  |
| `DEFAULT_CAT_ID` | (cat-config 第一个 breed) | 默认猫猫 ID（覆盖 cat-config 里的顺序） |  |
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
| `CAT_CAFE_CALLBACK_FETCH_TIMEOUT_MS` | 10000 | Callback fetch 每次尝试超时（毫秒，防 hung socket 永久挂起，照 #1368） |  |
| `CDP_DEBUG` | (未设置) | CDP Bridge 调试模式 |  |
| `CODEX_HOME` | ~/.codex | Codex CLI home 目录 |  |
| `ANTIGRAVITY_BRAIN_HOME` | ~/.gemini/antigravity/brain | Antigravity built-in generate_image brain dir (F172 Phase G scanner) |  |
| `CAT_CAFE_API_URL` | http://localhost:3002 | API 服务地址（由 API 进程注入 MCP Server 子进程 env） |  |
| `CAT_CAFE_INVOCATION_ID` | (运行时注入) | 当前 invocation ID（由 API 进程注入 MCP Server 子进程 env） |  |
| `CAT_CAFE_THREAD_ID` | (运行时注入) | 当前 thread ID（由 API 进程注入 MCP Server 子进程 env，用于跨线程 affordance 抑制本 thread 提示） |  |
| `CAT_CAFE_CAT_ID` | (运行时注入) | 当前猫 ID（由 API 进程注入 MCP Server 子进程 env） |  |
| `CAT_CAFE_DIAGNOSTICS` | (未设置) | 设为 1 启用 /api/diagnostics/* 端点（调试用，默认关闭） |  |
| `CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT` | (未设置) | 设为 1 跳过 shared state preflight 检查（CI / 调试用） |  |
| `CAT_CAFE_PREFLIGHT_TIMEOUT_MS` | 30000 | Pre-flight 操作（Redis/store 读取）的超时毫秒数，超时后降级到无 session 模式 |  |

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
| `CONNECTOR_GATEWAY_AUTOSTART` | runtime-production-only | 预配置 IM connector 自动接入开关：默认仅 runtime production（NODE_ENV=production + CAT_CAFE_RUNTIME_ROOT）启用；start:direct/alpha/dev 默认禁用。需在启动前通过 env/.env 设置，设 1 强制启用，0 强制禁用 |  |
| `TELEGRAM_BOT_TOKEN` | (未设置 → 不启用) | Telegram Bot Token | 🔒 |
| `FEISHU_APP_ID` | (未设置 → 不启用) | 飞书应用 App ID |  |
| `FEISHU_APP_SECRET` | (未设置) | 飞书应用 App Secret | 🔒 |
| `FEISHU_VERIFICATION_TOKEN` | (未设置) | 飞书 webhook 验证 token（仅 webhook 模式需要） | 🔒 |
| `FEISHU_CONNECTION_MODE` | webhook | 飞书连接模式：webhook（需公网 URL）或 websocket（长连接，无需公网） |  |
| `DINGTALK_APP_KEY` | (未设置 → 不启用) | 钉钉应用 AppKey |  |
| `DINGTALK_APP_SECRET` | (未设置) | 钉钉应用 AppSecret | 🔒 |
| `XIAOYI_AK` | (未设置 → 不启用) | 华为小艺 OpenClaw Access Key |  |
| `XIAOYI_SK` | (未设置) | 华为小艺 OpenClaw Secret Key | 🔒 |
| `XIAOYI_AGENT_ID` | (未设置) | 华为小艺 Agent ID |  |
| `FEISHU_BOT_OPEN_ID` | (未设置) | 飞书机器人 Open ID（接收消息的 bot 身份标识） |  |
| `FEISHU_ADMIN_OPEN_IDS` | (未设置) | 飞书管理员 Open ID 列表（逗号分隔） |  |
| `WEIXIN_VOICE_ITEM_MODE` | minimal | 微信语音消息 voice_item 模式（minimal/playtime/playtime-sec，危险实验模式见 WEIXIN_ENABLE_UNSAFE_VOICE_MODES） |  |
| `WEIXIN_ENABLE_UNSAFE_VOICE_MODES` | 0 | 是否允许危险语音实验模式（1=允许 playtime-encode/metadata，0=自动回退 playtime，避免“语音完全收不到”） |  |
| `WEIXIN_CAPTURE_INBOUND_VOICE_MEDIA` | 0 | 是否抓取入站微信语音媒体（1=把 voice media 当文件附件落盘，便于 SILK 二进制对比；0=保持当前行为） |  |
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
| `GITHUB_AUTHORITATIVE_REVIEW_LOGINS` | chatgpt-codex-connector[bot] | [DEPRECATED] F140 Phase E.2 cutover (2026-04-24): Rule B authoritative-source skip removed; this var now only serves as backward-compat fallback for GITHUB_SETUP_NOISE_BOT_LOGINS. Will be removed in a follow-up release. |  |
| `GITHUB_SETUP_NOISE_BOT_LOGINS` | chatgpt-codex-connector[bot] | Comma-separated GitHub bot logins whose conversation comments may contain Codex setup-only guidance. F140 polling-side setup-noise filter skips those (bot + conversation + setup-only body, no codex review content). Falls back to GITHUB_AUTHORITATIVE_REVIEW_LOGINS for backward compat. |  |
| `GITHUB_SELF_LOGIN` | (未设置 → gh api /user 自动解析) | F140 echo filter: GitHub 登录名，用于过滤自己发的 PR comment 避免回流消息总线。设置后跳过 gh api /user 解析，适用于 gh CLI 不可用的环境 |  |
| `GITHUB_TOKEN` | (未设置) | GitHub Personal Access Token（Scheduler 仓库活跃度模板 HTTP 请求鉴权） | 🔒 |
| `CONNECTOR_MEDIA_DIR` | ./data/connector-media | 连接器媒体下载目录 |  |

## 缅因猫 (Codex) (`codex`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `CAT_CODEX_SANDBOX_MODE` | danger-full-access | 缅因猫沙箱模式 |  |
| `CAT_CODEX_APPROVAL_POLICY` | on-request | 缅因猫审批策略 |  |
| `CODEX_AUTH_MODE` | oauth | 缅因猫认证方式 (oauth/api_key) |  |
| `OPENAI_API_KEY` | (未设置 → 由 accounts/credentials 系统注入) | OpenAI API Key（#340 P6: 由统一账户系统管理，子进程通过 callbackEnv 注入） | 🔒 |

## 狸花猫 (Dare) (`dare`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `DARE_ADAPTER` | openrouter | 狸花猫适配器 |  |
| `DARE_PATH` | (未设置) | Dare CLI 路径 |  |

## 暹罗猫 (Gemini) (`gemini`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `GOOGLE_API_KEY` | (未设置 → 由 accounts/credentials 系统注入) | Google API Key（#340 P6: 由统一账户系统管理，子进程通过 callbackEnv 注入） | 🔒 |
| `GEMINI_ADAPTER` | antigravity-cli | 暹罗猫适配器 (antigravity-cli/gemini-cli/antigravity) |  |
| `CAT_CAFE_AGY_PROFILE_ROOT` | ~/.cat-cafe/agy-profiles | F210 Phase G：隔离 AGY profile HOME 根目录；每只 AGY profile 猫会在此目录下创建独立 HOME。 |  |
| `CAT_CAFE_AGY_CWD_ROOT` | ~/.cat-cafe/agy-cwd | F210 cache-leak fix：无 agyProfile 时 AGY spawn cwd sandbox 根目录（每只 AGY 猫在此创建 <catId> 子目录），让 agy cwd-relative cache（cache/projects.json）落 sandbox 而非 repo root。 |  |

## Kimi (`kimi`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `MOONSHOT_API_KEY` | (未设置) | Kimi / Moonshot API Key（官方 kimi-cli API Key 模式用） | 🔒 |
| `KIMI_SHARE_DIR` | ~/.kimi | 官方 kimi-cli 共享目录（session / mcp / logs） |  |
| `KIMI_CONFIG_FILE` | ~/.kimi/config.toml | 官方 kimi-cli 配置文件路径（覆盖默认 ~/.kimi/config.toml） |  |

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
| `THEME_CONFIG` | (未设置) | OKLCH 主题配置 JSON（清浏览器缓存后可从此恢复） |  |

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
| `EMBED_MODE` | off | 向量检索模式 (off/shadow/on)。留空时由 console 上 Embedding 服务的开关决定（启用 → on）。 |  |
| `F102_ABSTRACTIVE` | off | Phase G 摘要调度器 (off/on)，on = 定时调用 Opus API 做 thread 摘要 |  |
| `F102_DURABLE_CANDIDATES` | off | Phase G candidate 提取 (off/on)，on = 摘要时提取 durable knowledge 候选到 MarkerQueue |  |
| `F102_TOPIC_SEGMENTS` | off | Phase G topic 分段 (off/on)，on = 摘要按话题切分多个 segment |  |
| `F200_CONSUMPTION_RERANK` | off | F200 consumption-weighted rerank (off/shadow/on) |  |
| `F163_AUTHORITY_BOOST` | off | F163 authority 加权 rerank (off/shadow/on) |  |
| `F163_ALWAYS_ON_INJECTION` | off | F163 constitutional 物理注入 (off/shadow/on) |  |
| `F163_RETRIEVAL_RERANK` | off | F163 多轴元数据 rerank (off/shadow/on) |  |
| `F163_COMPRESSION` | off | F163 非替代式压缩 (off/suggest/apply) |  |
| `F163_PROMOTION_GATE` | off | F163 晋升门禁 (off/suggest/apply) |  |
| `F163_CONTRADICTION_DETECTION` | off | F163 矛盾检测 (off/suggest/apply) |  |
| `F163_REVIEW_QUEUE` | off | F163 审计 review queue (off/suggest/apply) |  |
| `EMBED_URL` | http://127.0.0.1:9880 | Embedding 服务地址（独立 Python GPU 进程 scripts/embed-api.py） |  |
| `GLOBAL_KNOWLEDGE_DB` | ~/.cat-cafe/global_knowledge.sqlite | F-4: 全局知识 SQLite 路径（Skills + MEMORY.md 编译产物） |  |
| `F102_API_BASE` | (未设置 → 摘要调度器不启用) | Phase G 摘要调度用的反代 API 地址（不是猫猫自己的 provider profile） |  |
| `F102_API_KEY` | (未设置) | Phase G 摘要调度用的反代 API Key | 🔒 |
| `EMBED_PORT` | 9880 | Embedding 服务端口（仅在 EMBED_URL 未设置时使用） |  |

## 额度监控 (`quota`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `KIMI_AUTH_TOKEN` | (未设置) | Kimi 官方额度抓取用的 kimi-auth token（来自 kimi.com） | 🔒 |
| `KIMI_QUOTA_API_FALLBACK_ENABLED` | 0（默认关闭） | 设为 1 允许 Kimi 额度在 CLI /usage 失败时降级到 API（仍需 KIMI_AUTH_TOKEN） |  |
| `QUOTA_OFFICIAL_REFRESH_ENABLED` | 0（默认关闭） | 设为 1 允许官方额度抓取（Claude/Codex OAuth + Kimi auth token） |  |
| `CLAUDE_CREDENTIALS_PATH` | ~/.claude/.credentials.json | Claude OAuth credentials 文件路径（官方额度刷新用） |  |
| `CODEX_CREDENTIALS_PATH` | (未设置 → ~/.codex/credentials) | Codex OAuth credentials 文件路径（官方额度刷新用） |  |

## 可观测性 (OTel) (`telemetry`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `TELEMETRY_DEBUG` | (未设置 → 关闭) | 设为 true 启用 ConsoleSpanExporter（UNREDACTED）。仅 NODE_ENV=development/test 生效，其他环境需额外设 TELEMETRY_DEBUG_FORCE=true |  |
| `TELEMETRY_DEBUG_FORCE` | (未设置 → 关闭) | 生产环境强制启用 TELEMETRY_DEBUG 的安全覆写开关。仅限紧急排障 |  |
| `TELEMETRY_HMAC_SALT` | (dev/test 自动 fallback) | HMAC salt — 遥测系统 ID 伪名化用。生产环境必设，缺失则禁用 OTel | 🔒 |
| `TELEMETRY_EXPORT_RAW_SYSTEM_IDS` | (未设置 → HMAC 伪名化) | 设为 1 跳过 HMAC，导出原始系统 ID（仅限自托管受控环境） |  |
| `PROMETHEUS_PORT` | 9464 | Prometheus /metrics 抓取端口 |  |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (未设置 → 仅 Prometheus) | OTLP 导出端点（设置后同时推送 traces/metrics/logs 到该端点） |  |
| `OTEL_SDK_DISABLED` | (未设置 → 启用) | 设为 true 完全禁用 OTel SDK |  |
| `TELEMETRY_ALERT_ERROR_RATE` | 0.3 | Burn-rate 告警：错误率阈值（0-1） |  |
| `TELEMETRY_ALERT_P95_LATENCY_S` | 120 | Burn-rate 告警：P95 延迟阈值（秒） |  |
| `TELEMETRY_ALERT_ACTIVE_INVOCATIONS` | 50 | Burn-rate 告警：活跃 invocation 数阈值 |  |
| `PROMPT_CAPTURE` | off | Prompt X-Ray 开关（on=启用 canonical prompt 捕获） |  |
| `PROMPT_CAPTURE_CATS` | (未设置 → 全部猫) | Prompt X-Ray 白名单：逗号分隔 catId（空=全部） |  |

## 孟加拉猫 (Antigravity) (`antigravity`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `ANTIGRAVITY_PORT` | (未设置 → 自动发现) | Antigravity Language Server ConnectRPC 端口（覆盖自动发现） |  |
| `ANTIGRAVITY_CSRF_TOKEN` | (未设置 → 自动发现) | Antigravity Language Server CSRF Token（覆盖自动发现） | 🔒 |
| `ANTIGRAVITY_TLS` | true | Antigravity ConnectRPC 是否使用 TLS（默认 true） |  |
| `ANTIGRAVITY_AUTO_APPROVE` | true | YOLO 模式：自动批准 Antigravity 待审批交互（设 false 关闭） |  |
| `ANTIGRAVITY_AUTO_RESUME` | true | AC-G6 自动续跑：按 resume tier 在 fresh cascade 注入 resumeContext（设 false 关闭） |  |
| `ANTIGRAVITY_YOLO_RUN_COMMAND` | true | YOLO 模式：run_command 即使 SafeToAutoRun=false/missing 也走 native execution + writeback（设 false 回退 approval_pending） |  |
| `ANTIGRAVITY_RUN_COMMAND_TIMEOUT_MS` | 600000 | 受控 YOLO run_command 单次原生命令执行超时（毫秒，1..3600000）；无效值回退默认值 |  |
| `ANTIGRAVITY_TRACE_RAW` | (未设置 → 关闭) | 设为 1 启用 Antigravity 原始轨迹 dump（rpc raw response + step shape snapshot） |  |
| `ANTIGRAVITY_NATIVE_EXECUTOR` | (未设置 → 开启) | 设为 0 关闭 Antigravity 原生 executeAndPush（回落到通用 submit 路径） |  |
| `CAT_CAFE_RIPGREP_PATH` | (未设置 → 使用内置 @vscode/ripgrep，失败时回落 PATH rg) | Antigravity grep_search native executor 的 ripgrep 二进制路径覆盖（异常部署/调试用） |  |
| `CAT_CAFE_READONLY` | (未设置 → 全量注册) | MCP Server 只读模式：跳过 post_message 等写操作工具注册（Antigravity 持久 MCP 用） |  |
| `CAT_CAFE_RUNTIME_SESSION_SEAL_REAPER_INTERVAL_MS` | 30000 | F211 runtime session pending seal reaper 轮询间隔（毫秒，启动时读取） |  |

## 会中实时智囊 (F195) (`audio`)

| 变量 | 默认值 | 说明 | 敏感 |
|------|--------|------|------|
| `AUDIO_SERVICE_URL` | http://127.0.0.1:9881 | F195 Audio Capture Service 地址（Python aiohttp，管理音频采集 + ASR 转录） |  |
| `TRANSCRIPT_DIR` | scripts/meeting-copilot/transcripts | F195 Phase D 转写持久化目录（Python 写 MD + meta.json，Node 读 meta 做路径注入） |  |
