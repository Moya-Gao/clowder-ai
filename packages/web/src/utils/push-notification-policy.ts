export interface PushNotificationPayload {
  title?: string;
  body?: string;
  icon?: string;
  tag?: string;
  data?: {
    threadId?: string;
    url?: string;
    forceSystemNotification?: boolean;
    requiresDecision?: boolean;
  };
}

const DECISION_TEXT_RE =
  /(请确认|请批准|审批|需要你(决策|确认|批准|拍板)|是否允许|是否合入|可以合入|请你决定|请你拍板)/i;

function isDecisionLikeText(payload: PushNotificationPayload): boolean {
  const title = payload.title ?? '';
  const body = payload.body ?? '';
  return DECISION_TEXT_RE.test(`${title}\n${body}`);
}

export function shouldForceSystemNotification(payload: PushNotificationPayload): boolean {
  if (payload.data?.forceSystemNotification) return true;
  if (payload.data?.requiresDecision) return true;

  const tag = payload.tag ?? '';
  if (tag === 'push-test') return true;
  if (tag.startsWith('auth-')) return true;
  if (tag.startsWith('cat-decision-')) return true;

  return isDecisionLikeText(payload);
}

export function shouldShowSystemNotification(
  payload: PushNotificationPayload,
  hasFocusedClient: boolean,
): boolean {
  if (!hasFocusedClient) return true;
  return shouldForceSystemNotification(payload);
}

