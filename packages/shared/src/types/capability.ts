/**
 * Capability Types — F041 统一能力模型
 *
 * 三猫的 MCP server 配置归一为统一内部表示。
 * 配置编排器从此格式生成三种 CLI 配置 (.mcp.json / .codex/config.toml / .gemini/settings.json)。
 */

/** MCP server descriptor — 统一内部模型 (不含 transport, YAGNI → TD104) */
export interface McpServerDescriptor {
  /** MCP server name (e.g. 'cat-cafe', 'filesystem') */
  name: string;
  /** Command to spawn (e.g. 'node') */
  command: string;
  /** Command arguments */
  args: string[];
  /** Optional environment variables */
  env?: Record<string, string>;
  /** Whether globally enabled */
  enabled: boolean;
  /** Optional working directory */
  workingDir?: string;
  /** Origin: Cat Cafe's own MCP or user-configured external */
  source: 'cat-cafe' | 'external';
}

/** Per-cat override for a capability */
export interface CatCapabilityOverride {
  /** Cat ID */
  catId: string;
  /** Whether enabled for this cat (overrides global) */
  enabled: boolean;
}

/** Single capability entry in capabilities.json */
export interface CapabilityEntry {
  /** Unique capability ID (usually MCP server name) */
  id: string;
  /** Type of capability */
  type: 'mcp' | 'skill';
  /** Global enabled state */
  enabled: boolean;
  /** Per-cat overrides (only stores differences from global) */
  overrides?: CatCapabilityOverride[];
  /** MCP server descriptor (only for type: 'mcp') */
  mcpServer?: Omit<McpServerDescriptor, 'name' | 'enabled' | 'source'>;
  /** Source origin */
  source: 'cat-cafe' | 'external';
}

/** Root schema for .cat-cafe/capabilities.json */
export interface CapabilitiesConfig {
  /** Schema version */
  version: 1;
  /** All registered capabilities */
  capabilities: CapabilityEntry[];
}

/** Capabilities board response — what the GET API returns */
export interface CapabilityBoardItem {
  id: string;
  type: 'mcp' | 'skill';
  source: 'cat-cafe' | 'external';
  enabled: boolean;
  /** Per-cat effective state (global + overrides resolved) */
  cats: Record<string, boolean>;
  /** Description if available */
  description?: string;
  /** Skill trigger keywords (from SKILL.md frontmatter) */
  triggers?: string[];
  /** Skill category (from BOOTSTRAP.md, e.g. '三猫协作规则') */
  category?: string;
  /** Skill mount status per provider (symlink correctness check) */
  mounts?: Record<string, boolean>;
  /** MCP tools discovered via probe (only when ?probe=true) */
  tools?: McpToolInfo[];
  /** MCP connection status (only when ?probe=true) */
  connectionStatus?: 'connected' | 'disconnected' | 'unknown';
}

/** Lightweight MCP tool info for board display */
export interface McpToolInfo {
  name: string;
  description?: string;
}

/** Cat family grouping for the capability board UI */
export interface CatFamily {
  /** Breed ID (e.g. 'ragdoll') */
  id: string;
  /** Display name (e.g. '布偶猫') */
  name: string;
  /** All catIds belonging to this family */
  catIds: string[];
}

/** Skill mount health summary */
export interface SkillHealthSummary {
  /** All Cat Cafe skills correctly symlinked to all providers */
  allMounted: boolean;
  /** No orphaned skills or phantom BOOTSTRAP entries */
  registrationConsistent: boolean;
  /** Skills in source dir but not in BOOTSTRAP.md */
  unregistered: string[];
  /** Skills in BOOTSTRAP.md but not in source dir */
  phantom: string[];
}

/** Full GET /api/capabilities response (F041 re-open: includes family + project metadata) */
export interface CapabilityBoardResponse {
  items: CapabilityBoardItem[];
  catFamilies: CatFamily[];
  /** The resolved project path this response pertains to */
  projectPath: string;
  /** Skill mount health (only for cat-cafe skills) */
  skillHealth?: SkillHealthSummary;
}

/** PATCH request body for toggling capabilities */
export interface CapabilityPatchRequest {
  /** Capability ID to modify */
  capabilityId: string;
  /** Capability type — required to disambiguate same-name MCP/skill entries */
  capabilityType: 'mcp' | 'skill';
  /** Scope: global toggle or per-cat override */
  scope: 'global' | 'cat';
  /** Required when scope is 'cat' */
  catId?: string;
  /** New enabled state */
  enabled: boolean;
  /** Target project path (multi-project support). If omitted, uses server default. */
  projectPath?: string;
}
