/**
 * Connector Types — 外部信息源抽象
 *
 * Connector 是从外部系统（GitHub、iMessage、Slack 等）
 * 进入 Cat Cafe 的消息来源。每个 connector 有固定的视觉标识
 * （icon、颜色），在前端以独立气泡样式展示。
 *
 * BACKLOG #97
 */

// ── Connector Source (附加到 StoredMessage) ──

/** Source metadata attached to messages from external connectors. */
export interface ConnectorSource {
  /** Stable connector identifier (used for routing + styling) */
  readonly connector: string;
  /** Human-readable display name */
  readonly label: string;
  /** Emoji or icon URL for avatar position */
  readonly icon: string;
  /** Link to original source (e.g., PR URL) */
  readonly url?: string;
  /** Connector-specific metadata (not rendered, for debugging/routing) */
  readonly meta?: Readonly<Record<string, unknown>>;
}

// ── Connector Definition (registry entry) ──

/** Static definition of a connector type for frontend rendering. */
export interface ConnectorDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly icon: string;
  readonly color: {
    /** Primary accent color (border, label) */
    readonly primary: string;
    /** Secondary background color (bubble fill) */
    readonly secondary: string;
  };
  readonly description: string;
}

// ── Connector Registry ──

const CONNECTOR_DEFINITIONS: readonly ConnectorDefinition[] = [
  {
    id: 'github-review',
    displayName: 'GitHub Review',
    icon: '🔔',
    color: { primary: '#2563EB', secondary: '#EFF6FF' },
    description: 'GitHub PR review 邮件通知',
  },
  {
    id: 'vote-result',
    displayName: '投票结果',
    icon: '🗳️',
    color: { primary: '#7C3AED', secondary: '#F5F3FF' },
    description: '投票系统自动汇总结果',
  },
] as const;

const connectorMap = new Map<string, ConnectorDefinition>(
  CONNECTOR_DEFINITIONS.map((d) => [d.id, d]),
);

/** Look up a connector definition by ID. */
export function getConnectorDefinition(connectorId: string): ConnectorDefinition | undefined {
  return connectorMap.get(connectorId);
}

/** Get all registered connector definitions. */
export function getAllConnectorDefinitions(): readonly ConnectorDefinition[] {
  return CONNECTOR_DEFINITIONS;
}
