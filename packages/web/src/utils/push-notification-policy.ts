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

export const PUSH_TEST_NOTIFICATION_TAG = 'push-test';

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
  if (tag === PUSH_TEST_NOTIFICATION_TAG) return true;
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

type NotificationCloser = { close(): void };

export interface NotificationRegistry {
  getNotifications(options?: { tag?: string }): Promise<NotificationCloser[]>;
}

/**
 * For repeated push-test sends, close previous test notifications so the next
 * showNotification is treated as a fresh entry instead of silent replacement.
 * Best effort only — failures must never block notification delivery.
 */
export async function resetPushTestNotification(
  registry: NotificationRegistry,
  tag: string | undefined,
): Promise<void> {
  if (tag !== PUSH_TEST_NOTIFICATION_TAG) return;
  try {
    const existing = await registry.getNotifications({ tag: PUSH_TEST_NOTIFICATION_TAG });
    for (const notification of existing) {
      notification.close();
    }
  } catch {
    // ignore: fallback is to still show the new notification
  }
}
