type TurnBoundaryPoint = {
  type?: string;
  catId?: string;
  timestamp?: number;
  deliveredAt?: number;
  extra?: {
    systemKind?: string;
    a2aRouting?: {
      invocationId?: string;
    };
    stream?: {
      invocationId?: string;
    };
  };
};

function getTurnBoundaryTimestamp(point: TurnBoundaryPoint): number | undefined {
  const timestamp = point.deliveredAt ?? point.timestamp;
  return typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : undefined;
}

/**
 * Legacy Antigravity payloads can reuse the parent invocation id across
 * multiple same-cat turns. A user message between two assistant records is the
 * hard boundary that keeps those turns from being reconciled as one bubble.
 */
export function crossesUserTurnBoundary(
  messages: TurnBoundaryPoint[],
  left: TurnBoundaryPoint,
  right: TurnBoundaryPoint,
): boolean {
  const leftTs = getTurnBoundaryTimestamp(left);
  const rightTs = getTurnBoundaryTimestamp(right);
  if (leftTs === undefined || rightTs === undefined || leftTs === rightTs) return false;

  const earlier = Math.min(leftTs, rightTs);
  const later = Math.max(leftTs, rightTs);
  return messages.some((message) => {
    if (message.type !== 'user') return false;
    const ts = getTurnBoundaryTimestamp(message);
    return ts !== undefined && ts > earlier && ts <= later;
  });
}

function getResidueBoundaryParentInvocationId(point: TurnBoundaryPoint): string | undefined {
  return point.extra?.stream?.invocationId ?? point.extra?.a2aRouting?.invocationId;
}

function isA2ARoutingBoundary(point: TurnBoundaryPoint): boolean {
  return point.type === 'system' && (point.extra?.systemKind === 'a2a_routing' || Boolean(point.extra?.a2aRouting));
}

function isOtherCatAssistantBoundary(point: TurnBoundaryPoint, residueCatId: string): boolean {
  return point.type === 'assistant' && Boolean(point.catId) && point.catId !== residueCatId;
}

export function crossesResidueTurnBoundary(
  messages: TurnBoundaryPoint[],
  left: TurnBoundaryPoint,
  right: TurnBoundaryPoint,
  residueCatId: string,
  parentInvocationId: string,
): boolean {
  if (crossesUserTurnBoundary(messages, left, right)) return true;

  const leftTs = getTurnBoundaryTimestamp(left);
  const rightTs = getTurnBoundaryTimestamp(right);
  if (leftTs === undefined || rightTs === undefined || leftTs === rightTs) return false;

  const earlier = Math.min(leftTs, rightTs);
  const later = Math.max(leftTs, rightTs);
  return messages.some((message) => {
    if (!isA2ARoutingBoundary(message) && !isOtherCatAssistantBoundary(message, residueCatId)) return false;
    if (getResidueBoundaryParentInvocationId(message) !== parentInvocationId) return false;
    const ts = getTurnBoundaryTimestamp(message);
    return ts !== undefined && ts > earlier && ts <= later;
  });
}
