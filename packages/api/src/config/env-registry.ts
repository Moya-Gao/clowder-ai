/**
 * Environment variable registry — single source of truth for all user-configurable env vars.
 * Used by GET /api/config/env-summary to report current values to the frontend.
 *
 * To add a new env var:
 * 1. Add an EnvDefinition here
 * 2. Use process.env[name] in your code as usual
 * The "环境 & 文件" tab picks it up automatically.
 */

export type EnvCategory =
  | 'server'
  | 'storage'
  | 'budget'
  | 'cli'
  | 'hindsight'
  | 'codex'
  | 'gemini'
  | 'frontend';

export interface EnvDefinition {
  /** The env var name, e.g. 'REDIS_URL' */
  name: string;
  /** Default value description (for display, not logic) */
  defaultValue: string;
  /** Human-readable description (Chinese) */
  description: string;
  /** Grouping category */
  category: EnvCategory;
  /** If true, current value is masked as '***' in API response */
  sensitive: boolean;
  /** If 'url', credentials in URL are masked but host/port/db preserved */
  maskMode?: 'url';
}

export const ENV_CATEGORIES: Record<EnvCategory, string> = {
  server: '服务器',
  storage: '存储',
  budget: '猫猫预算',
  cli: 'CLI',
  hindsight: 'Hindsight 长期记忆',
  codex: '缅因猫 (Codex)',
  gemini: '暹罗猫 (Gemini)',
  frontend: '前端',
};

export const ENV_VARS: EnvDefinition[] = [
  // --- server ---
  { name: 'API_SERVER_PORT', defaultValue: '3002', description: 'API 服务端口', category: 'server', sensitive: false },
  { name: 'API_SERVER_HOST', defaultValue: '127.0.0.1', description: 'API 监听地址', category: 'server', sensitive: false },
  { name: 'UPLOAD_DIR', defaultValue: './uploads', description: '文件上传目录', category: 'server', sensitive: false },
  { name: 'PROJECT_ALLOWED_ROOTS', defaultValue: '~ (用户目录)', description: '允许访问的项目根目录（冒号分隔）', category: 'server', sensitive: false },
  { name: 'FRONTEND_URL', defaultValue: '(自动检测)', description: '前端 URL（导出长图用）', category: 'server', sensitive: false },
  { name: 'FRONTEND_PORT', defaultValue: '3000', description: '前端端口（导出长图用）', category: 'server', sensitive: false },

  // --- storage ---
  { name: 'REDIS_URL', defaultValue: '(未设置 → 内存模式)', description: 'Redis 连接地址', category: 'storage', sensitive: false, maskMode: 'url' },
  { name: 'MEMORY_STORE', defaultValue: '(未设置)', description: '设为 1 显式允许内存模式', category: 'storage', sensitive: false },
  { name: 'MESSAGE_TTL_SECONDS', defaultValue: '604800 (7天)', description: '消息过期时间', category: 'storage', sensitive: false },
  { name: 'THREAD_TTL_SECONDS', defaultValue: '604800 (7天)', description: '对话过期时间', category: 'storage', sensitive: false },
  { name: 'TASK_TTL_SECONDS', defaultValue: '604800 (7天)', description: '任务过期时间', category: 'storage', sensitive: false },
  { name: 'SUMMARY_TTL_SECONDS', defaultValue: '604800 (7天)', description: '摘要过期时间', category: 'storage', sensitive: false },

  // --- budget ---
  { name: 'MAX_PROMPT_CHARS', defaultValue: '(per-cat 默认)', description: '全局 prompt 字符上限', category: 'budget', sensitive: false },
  { name: 'CAT_OPUS_MAX_PROMPT_CHARS', defaultValue: '150000', description: '布偶猫 prompt 上限', category: 'budget', sensitive: false },
  { name: 'CAT_CODEX_MAX_PROMPT_CHARS', defaultValue: '80000', description: '缅因猫 prompt 上限', category: 'budget', sensitive: false },
  { name: 'CAT_GEMINI_MAX_PROMPT_CHARS', defaultValue: '150000', description: '暹罗猫 prompt 上限', category: 'budget', sensitive: false },
  { name: 'MAX_CONTEXT_MSG_CHARS', defaultValue: '1500', description: '单条消息上下文截断', category: 'budget', sensitive: false },
  { name: 'MAX_A2A_DEPTH', defaultValue: '15', description: 'A2A 猫猫互调最大深度', category: 'budget', sensitive: false },

  // --- cli ---
  { name: 'CLI_TIMEOUT_MS', defaultValue: '300000 (5分钟)', description: 'CLI 调用超时', category: 'cli', sensitive: false },
  { name: 'CAT_CONFIG_PATH', defaultValue: '(repo 根 cat-config.json)', description: '猫猫配置文件路径', category: 'cli', sensitive: false },
  { name: 'CAT_CAFE_MCP_SERVER_PATH', defaultValue: '(自动检测)', description: 'MCP Server 路径', category: 'cli', sensitive: false },
  { name: 'AUDIT_LOG_DIR', defaultValue: './data/audit-logs', description: '审计日志目录', category: 'cli', sensitive: false },
  { name: 'CLI_RAW_ARCHIVE_DIR', defaultValue: './data/cli-raw-archive', description: 'CLI 原始日志归档目录', category: 'cli', sensitive: false },
  { name: 'AUDIT_LOG_INCLUDE_PROMPT_SNIPPETS', defaultValue: 'false', description: '审计日志包含 prompt 片段', category: 'cli', sensitive: false },
  { name: 'CAT_BRANCH_ROLLBACK_RETRY_DELAYS_MS', defaultValue: '1000,2000,4000', description: 'Branch 回滚重试间隔', category: 'cli', sensitive: false },
  { name: 'MODE_SWITCH_REQUIRES_APPROVAL', defaultValue: 'true', description: '模式切换需要确认', category: 'cli', sensitive: false },

  // --- hindsight ---
  { name: 'HINDSIGHT_ENABLED', defaultValue: 'true', description: '是否启用 Hindsight 检索/反思/写入', category: 'hindsight', sensitive: false },
  { name: 'HINDSIGHT_URL', defaultValue: 'http://localhost:18888', description: 'Hindsight 服务地址', category: 'hindsight', sensitive: false },
  { name: 'HINDSIGHT_REFLECT_DISPOSITION_MODE', defaultValue: '(默认)', description: 'Reflect 处置模式', category: 'hindsight', sensitive: false },
  { name: 'HINDSIGHT_RECALL_DEFAULT_BUDGET', defaultValue: 'mid', description: 'Recall 默认预算', category: 'hindsight', sensitive: false },
  { name: 'HINDSIGHT_RECALL_DEFAULT_TAGS_MATCH', defaultValue: 'all', description: 'Recall 标签匹配方式', category: 'hindsight', sensitive: false },
  { name: 'HINDSIGHT_RECALL_DEFAULT_LIMIT', defaultValue: '5', description: 'Recall 默认返回条数', category: 'hindsight', sensitive: false },
  { name: 'HINDSIGHT_P0_FAIL_CLOSED_ENABLED', defaultValue: 'true', description: 'freshness stale 时是否 fail-closed', category: 'hindsight', sensitive: false },
  { name: 'HINDSIGHT_P0_FAIL_CLOSED_STATUSES', defaultValue: 'stale', description: '触发 fail-closed 的 freshness 状态列表', category: 'hindsight', sensitive: false },
  { name: 'HINDSIGHT_P0_AUTO_REIMPORT_ENABLED', defaultValue: 'true', description: 'freshness stale 时是否自动触发 P0 re-import', category: 'hindsight', sensitive: false },
  { name: 'HINDSIGHT_P0_AUTO_REIMPORT_COOLDOWN_MS', defaultValue: '600000', description: '自动 re-import 冷却时间（毫秒）', category: 'hindsight', sensitive: false },
  { name: 'HINDSIGHT_P0_AUTO_REIMPORT_COMMAND', defaultValue: 'pnpm --filter @cat-cafe/api hindsight:import:p0 -- --all', description: '自动 re-import 执行命令', category: 'hindsight', sensitive: false },
  { name: 'HINDSIGHT_P0_REIMPORT_STATE_PATH', defaultValue: 'data/hindsight/p0-reimport-state.json', description: '自动 re-import 状态文件路径', category: 'hindsight', sensitive: false },

  // --- codex ---
  { name: 'CAT_CODEX_SANDBOX_MODE', defaultValue: 'danger-full-access', description: '缅因猫沙箱模式', category: 'codex', sensitive: false },
  { name: 'CAT_CODEX_APPROVAL_POLICY', defaultValue: 'on-request', description: '缅因猫审批策略', category: 'codex', sensitive: false },
  { name: 'CODEX_AUTH_MODE', defaultValue: 'oauth', description: '缅因猫认证方式 (oauth/api_key)', category: 'codex', sensitive: false },
  { name: 'OPENAI_API_KEY', defaultValue: '(未设置)', description: 'OpenAI API Key (api_key 模式用)', category: 'codex', sensitive: true },

  // --- gemini ---
  { name: 'GEMINI_ADAPTER', defaultValue: 'gemini-cli', description: '暹罗猫适配器 (gemini-cli/antigravity)', category: 'gemini', sensitive: false },

  // --- frontend ---
  { name: 'NEXT_PUBLIC_API_URL', defaultValue: 'http://localhost:3002', description: '前端连接的 API 地址', category: 'frontend', sensitive: false },
  { name: 'NEXT_PUBLIC_WHISPER_URL', defaultValue: 'http://localhost:9876', description: 'Whisper ASR 服务地址', category: 'frontend', sensitive: false },
];

/** Mask credentials in a URL while preserving host/port/db for debugging. */
export function maskUrlCredentials(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.username || url.password) {
      url.username = url.username ? '***' : '';
      url.password = '';
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    // Not a valid URL — mask entirely to be safe
    return '***';
  }
}

function maskValue(def: EnvDefinition, raw: string): string {
  if (def.sensitive) return '***';
  if (def.maskMode === 'url') return maskUrlCredentials(raw);
  return raw;
}

/**
 * Build env summary by reading current process.env values.
 * Sensitive values are masked. URL values have credentials masked.
 */
export function buildEnvSummary(): Array<EnvDefinition & { currentValue: string | null }> {
  return ENV_VARS.map((def) => {
    const raw = process.env[def.name];
    const currentValue = raw != null && raw !== ''
      ? maskValue(def, raw)
      : null;
    return { ...def, currentValue };
  });
}
