/**
 * Redis key patterns for connector thread bindings.
 * F088 Multi-Platform Chat Gateway — Redis persistence.
 */

export const ConnectorBindingKeys = {
  /** Hash with binding details: connector-binding:{connectorId}:{externalChatId} */
  detail: (connectorId: string, externalChatId: string) => `connector-binding:${connectorId}:${externalChatId}`,

  /** Set of forward keys per thread (reverse index): connector-binding-rev:{threadId} */
  byThread: (threadId: string) => `connector-binding-rev:${threadId}`,
} as const;
