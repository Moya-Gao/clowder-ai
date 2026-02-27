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
}

/** PATCH request body for toggling capabilities */
export interface CapabilityPatchRequest {
  /** Capability ID to modify */
  capabilityId: string;
  /** Scope: global toggle or per-cat override */
  scope: 'global' | 'cat';
  /** Required when scope is 'cat' */
  catId?: string;
  /** New enabled state */
  enabled: boolean;
}
